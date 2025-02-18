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
    }
    return null;
  }
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

module.exports = { getTop20Volatile };
  
