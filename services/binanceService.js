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
      { symbol: symbol.replace('USDT','').toUpperCase(), interval: interval.toLowerCase() },
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


async function getKlinesForSymbols(symbols, interval, limit) {
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
async function getTop20Volatile() {
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
  
      const usdtSymbols = tickersData
        .filter(ticker => ticker.symbol.endsWith('USDT'))
        .map(ticker => ticker.symbol);
  
      const klinesData = await getKlinesForSymbols(usdtSymbols, '1h', 24);
  
      const volatileTickers = [];
  
      for (let i = 0; i < klinesData.length; i++) {
        const klines = klinesData[i];
        const symbol = usdtSymbols[i];
  
        if (!klines || klines.length < 24) {
          console.warn(`Skipping ${symbol} due to missing or insufficient kline data.`);
          continue;
        }
  
        const priceChanges = klines.map(kline => parseFloat(kline.close) - parseFloat(kline.open));
        const volatility = Math.max(...priceChanges.map(Math.abs));
  
        // Find the corresponding ticker from the 24hr data to get the volume
        const ticker = tickersData.find(t => t.symbol === symbol);
  
        if (ticker) {
          const currentPrice = parseFloat(ticker.lastPrice);
          const symbolNOUSDT = symbol.replace('USDT','');
          // Attempt to retrieve the coin's image URL (assuming Binance provides it)
          const imageUrl = ``; // Replace with correct URL format if needed
          const imageName = `${symbolNOUSDT.toLowerCase()}.png`;
  
          volatileTickers.push({
            symbol:symbolNOUSDT,
            volatility,
            volume: parseFloat(ticker.volume),
            currentPrice,
            imageUrl: `${imageUrl}${imageName}`, // Concatenate image URL
          });
        } else {
          console.warn(`Ticker data not found for ${symbol}`);
        }
      }
  
      volatileTickers.sort((a, b) => b.volatility - a.volatility);
      const top20VolatileWithVolume = volatileTickers.filter(ticker => ticker.volume > 1000000);
  
      return top20VolatileWithVolume.slice(0, 20);
    } catch (error) {
      console.error("Error in getTop20Volatile:", error);
      return [];
    }
  }
  
  module.exports = { getTop20Volatile };