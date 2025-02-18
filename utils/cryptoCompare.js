// cryptoCompare.js
const axios = require('axios');
const CRYPTOCOMPARE_API_URL = 'https://www.cryptocompare.com/api/data/coinlist';

async function getCoinImageUrl(symbol) {
  try {
    const response = await axios.get(CRYPTOCOMPARE_API_URL);
    const coinList = response.data.Data;

    if (coinList && coinList[symbol]) {
      return `https://www.cryptocompare.com${coinList[symbol].ImageUrl}`;
    }
    console.warn(`Image not found for symbol: ${symbol}`);
    return null;
  } catch (error) {
    console.error('Error fetching coin list from CryptoCompare:', error);
    return null;
  }
}

module.exports = { getCoinImageUrl }; // Export the function