const { Kline } = require('../data/models/klineSchema');
const axios = require('axios');

const BASE_URL = 'https://api.binance.com/api/v3';

async function getKlinesFromCacheOrAPI(symbol, interval, limit) {
  try {
    console.log(`Querying cache for symbol: ${symbol}, interval: ${interval}`);
    const cachedData = await Kline.findOne({
      symbol: symbol.toUpperCase(),
      interval: interval.toLowerCase(),
    });

    if (cachedData && cachedData.lastUpdated && Date.now() - cachedData.lastUpdated < 15 * 15 * 1000) {
      console.log(`Using cached Kline data for ${symbol}-${interval}`);
      return cachedData.klines;
    }

    console.log(`Fetching Kline data from Binance for ${symbol}-${interval}`);
    const url = new URL(`${BASE_URL}/klines`);
    url.searchParams.append('symbol', symbol);
    url.searchParams.append('interval', interval);
    url.searchParams.append('limit', limit);

    const response = await axios.get(url.toString());
    if (response.status !== 200) {
      console.error(`Error fetching klines for ${symbol} (status: ${response.status})`);
      return null;
    }

    const klines = response.data;
    if (!Array.isArray(klines) || klines.length === 0) {
      console.warn(`No klines data for ${symbol}`);
      return null;
    }

    const processedKlines = klines.map(d => ({
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));

    console.log(`Saving Kline data for ${symbol}-${interval}`);
    await Kline.updateOne(
      { symbol: symbol.toUpperCase(), interval: interval.toLowerCase() },
      { $set: { klines: processedKlines, lastUpdated: Date.now() } },
      { upsert: true } // Esta opción crea la colección si no existe.
    );

    return processedKlines;
  } catch (error) {
    if (error.message.includes('collection does not exist')) {
      console.warn(`Collection does not exist, but it will be created automatically.`);
    } else {
      console.error(`Error in getKlinesFromCacheOrAPI for ${symbol}:`, error.message);
    }K
    return null;
  }
}

async function calculateRSI(klines, period = 14) {
  if (!klines || klines.length < period) {
    return null; // Not enough data to calculate RSI
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const priceChange = klines[i].close - klines[i - 1].close;
    if (priceChange > 0) {
      gains += priceChange;
    } else {
      losses -= priceChange; // losses are positive values
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate subsequent RS and RSI
  for (let i = period + 1; i < klines.length; i++) {
    const priceChange = klines[i].close - klines[i - 1].close;
    if (priceChange > 0) {
      avgGain = (avgGain * (period - 1) + priceChange) / period;
      avgLoss = (avgLoss * (period - 1)) / period; // No loss this period
    } else {
      avgLoss = (avgLoss * (period - 1) - priceChange) / period; // Add positive loss
      avgGain = (avgGain * (period - 1)) / period; // No gain this period
    }
  }

  const rs = avgLoss === 0 ? 200 : avgGain / avgLoss; // Prevent division by zero
  const rsi = 100 - (100 / (1 + rs));
  return rsi;
}



async function updateKlinesFromBinance(symbols, interval, limit) {
  try {
    const klinesPromises = symbols.map(symbol =>
      getKlinesFromCacheOrAPI(symbol, interval, limit).catch(error => {
        console.error(`Error fetching klines for ${symbol}:`, error.message);
        return null;
      })
    );
    const klinesResults = await Promise.all(klinesPromises);

    return klinesResults.filter(result => result !== null);

  } catch (error) {
    console.error("Error fetching multiple klines:", error);
    return [];
  }
}
async function getTop20Volatile(updateFromBinance = true) { // Default to true (update data)
  try {
    const tickersResponse = await axios.get(`${BASE_URL}/ticker/24hr`); // Use 24hr ticker endpoint

    if (tickersResponse.status !== 200) {
      console.error(`Error fetching tickers (status: ${tickersResponse.status})`);
      return [];
    }

    const tickersData = tickersResponse.data;

    if (!Array.isArray(tickersData)) {
      console.error("Unexpected tickers response:", tickersData);
      return [];
    }

    const usdtSymbols = tickersData.filter(ticker => ticker.symbol.endsWith('USDT')).map(ticker => ticker.symbol);

    // Update klines from Binance only if `updateFromBinance` is true
    if (updateFromBinance) {
      await updateKlinesFromBinance(usdtSymbols, '1h', 24);
    }

    const volatileTickers = [];

    for (const symbol of usdtSymbols) {
      const symbolNOUSDT = symbol.replace('USDT','');
      const cachedData = await Kline.findOne({ symbol: symbolNOUSDT.toUpperCase(), interval: '1h' });
      const ticker = tickersData.find(t => t.symbol === symbol);

      if (cachedData && ticker && cachedData.klines && cachedData.klines.length >= 24) {
          const priceChanges = cachedData.klines.map(kline => kline.close - kline.open);
          const volatility = Math.max(...priceChanges.map(Math.abs));
          const imageUrl = `https://assets.binance.com/asset/public/i30/`; // Replace with correct URL format if needed
          const imageName = `${symbolNOUSDT.toLowerCase()}.png`;

          volatileTickers.push({
              symbol: symbolNOUSDT,
              volatility,
              volume: parseFloat(ticker.volume),
              currentPrice: parseFloat(ticker.lastPrice),
              imageUrl: `${imageUrl}${imageName}`, // Concatenate image URL
          });
      } else {
          console.warn(`Skipping ${symbolNOUSDT} due to missing data.`);
      }
    }

    volatileTickers.sort((a, b) => b.volatility - a.volatility);
    const top20 = volatileTickers.filter(t => t.volume > 1000000).slice(0, 20);

    return top20;
  } catch (error) {
    console.error("Error in getTop20Volatile:", error);
    return [];
  }
}

async function getTop50BuyOpportunity(updateFromBinance = true) {
  try {
    const tickersResponse = await axios.get(`${BASE_URL}/ticker/24hr`);
    const exchangeInfoResponse = await axios.get(`${BASE_URL}/exchangeInfo`);

    if (tickersResponse.status !== 200 || exchangeInfoResponse.status !== 200) {
      console.error('Error fetching data from Binance');
      return [];
    }

    const tickersData = tickersResponse.data;
    const exchangeInfoData = exchangeInfoResponse.data;

    if (!Array.isArray(tickersData) || !Array.isArray(exchangeInfoData.symbols)) {
        console.error("Unexpected data format from Binance");
        return [];
    }

    const usdtTickers = tickersData.filter(ticker => ticker.symbol.endsWith('USDT'));
    const symbols = usdtTickers.map(ticker => ticker.symbol);

    if (updateFromBinance) {
        // Fetch 200 klines for RSI calculation (typically requires more data)
        await updateKlinesFromBinance(symbols, '1h', 200);
    }

    const buyOpportunities = [];

    for (const ticker of usdtTickers) {
      const symbol = ticker.symbol;
      const symbolNOUSDT = symbol.replace('USDT', '');
      const cachedData = await Kline.findOne({ symbol: symbolNOUSDT.toUpperCase(), interval: '1h' });

      if (cachedData && cachedData.klines && cachedData.klines.length >= 200) {
          const klines = cachedData.klines;
          const rsi = calculateRSI(klines);
          const volume = parseFloat(ticker.volume);
          const currentPrice = parseFloat(ticker.lastPrice);
          const marketCap = parseFloat(ticker.quoteVolume) * currentPrice; // Simplified market cap calculation
          const imageUrl = `https://assets.binance.com/asset/public/i30/${symbolNOUSDT.toLowerCase()}.png`;

          // Basic criteria for buy opportunity: low RSI (e.g., < 30) and high volume
          if (rsi !== null && rsi < 40 && volume > 1000000) {
            buyOpportunities.push({
                symbol: symbolNOUSDT,
                currentPrice,
                volume,
                marketCap,
                rsi,
                imageUrl,
            });
          }
      }
    }

    // Sort by RSI (lower is better for buying) and then volume (higher is better)
    buyOpportunities.sort((a, b) => {
        if (a.rsi !== b.rsi) {
            return a.rsi - b.rsi; // Ascending RSI
        } else {
            return b.volume - a.volume; // Descending volume
        }
    });

    return buyOpportunities.slice(0, 50);

  } catch (error) {
    console.error("Error in getTop50BuyOpportunity:", error);
    return [];
  }
}

async function getTop50SellOpportunity(updateFromBinance = true) {
  try {
    const tickersResponse = await axios.get(`${BASE_URL}/ticker/24hr`);
    const exchangeInfoResponse = await axios.get(`${BASE_URL}/exchangeInfo`);

    if (tickersResponse.status !== 200 || exchangeInfoResponse.status !== 200) {
      console.error('Error fetching data from Binance');
      return [];
    }

    const tickersData = tickersResponse.data;
    const exchangeInfoData = exchangeInfoResponse.data;

    if (!Array.isArray(tickersData) || !Array.isArray(exchangeInfoData.symbols)) {
        console.error("Unexpected data format from Binance");
        return [];
    }

    const usdtTickers = tickersData.filter(ticker => ticker.symbol.endsWith('USDT'));
    const symbols = usdtTickers.map(ticker => ticker.symbol);

    if (updateFromBinance) {
        // Fetch 200 klines for RSI calculation
        await updateKlinesFromBinance(symbols, '1h', 200);
    }

    const sellOpportunities = [];

    for (const ticker of usdtTickers) {
      const symbol = ticker.symbol;
      const symbolNOUSDT = symbol.replace('USDT', '');
      const cachedData = await Kline.findOne({ symbol: symbolNOUSDT.toUpperCase(), interval: '1h' });

      if (cachedData && cachedData.klines && cachedData.klines.length >= 200) {
          const klines = cachedData.klines;
          const rsi = calculateRSI(klines);
          const volume = parseFloat(ticker.volume);
          const currentPrice = parseFloat(ticker.lastPrice);
          const marketCap = parseFloat(ticker.quoteVolume) * currentPrice; // Simplified market cap calculation
          const imageUrl = `https://assets.binance.com/asset/public/i30/${symbolNOUSDT.toLowerCase()}.png`;

          // Basic criteria for sell opportunity: high RSI (e.g., > 70) and high volume
          if (rsi !== null && rsi > 60 && volume > 1000000) {
            sellOpportunities.push({
                symbol: symbolNOUSDT,
                currentPrice,
                volume,
                marketCap,
                rsi,
                imageUrl,
            });
          }
      }
    }

    // Sort by RSI (higher is better for selling) and then volume (higher is better)
    sellOpportunities.sort((a, b) => {
        if (a.rsi !== b.rsi) {
            return b.rsi - a.rsi; // Descending RSI
        } else {
            return b.volume - a.volume; // Descending volume
        }
    });

    return sellOpportunities.slice(0, 50);

  } catch (error) {
    console.error("Error in getTop50SellOpportunity:", error);
    return [];
  }
}


module.exports = { getTop20Volatile, getTop50BuyOpportunity, getTop50SellOpportunity };
