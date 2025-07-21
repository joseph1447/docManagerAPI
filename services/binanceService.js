const axios = require('axios');

const BASE_URL = 'https://api.binance.com/api/v3';

// Caché en memoria para los datos de Klines
// Estructura: { 'SYMBOL_INTERVAL': { data: [], lastUpdated: timestamp } }
const klinesCache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos de duración de la caché

/**
 * Obtiene los datos de Klines (velas) de la caché o de la API de Binance.
 * Almacena en caché los datos para futuras solicitudes.
 * @param {string} symbol - El símbolo del par de trading (ej: 'BTCUSDT').
 * @param {string} interval - El intervalo de las velas (ej: '1h').
 * @param {number} limit - El número máximo de velas a obtener.
 * @returns {Array|null} Un array de objetos kline procesados o null si hay un error.
 */
async function getKlinesFromCacheOrAPI(symbol, interval, limit) {
    const cacheKey = `${symbol.toUpperCase()}_${interval.toLowerCase()}`;
    const cachedData = klinesCache[cacheKey];

    // Verificar si los datos están en caché y no están caducados
    if (cachedData && (Date.now() - cachedData.lastUpdated < CACHE_DURATION_MS)) {
        // console.log(`Usando datos de Kline en caché para ${symbol}-${interval}`);
        return cachedData.data;
    }

    // Si no hay caché o está caducada, obtener de Binance
    // console.log(`Obteniendo datos de Kline de Binance para ${symbol}-${interval}`);
    try {
        const url = new URL(`${BASE_URL}/klines`);
        url.searchParams.append('symbol', symbol);
        url.searchParams.append('interval', interval);
        url.searchParams.append('limit', limit);

        const response = await axios.get(url.toString());

        if (response.status !== 200) {
            console.error(`Error al obtener klines para ${symbol} (estado: ${response.status})`);
            return null;
        }

        const klines = response.data;
        if (!Array.isArray(klines) || klines.length === 0) {
            console.warn(`No se encontraron datos de klines para ${symbol}`);
            return null;
        }

        const processedKlines = klines.map(d => ({
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
        }));

        // Guardar en caché
        klinesCache[cacheKey] = {
            data: processedKlines,
            lastUpdated: Date.now(),
        };

        return processedKlines;
    } catch (error) {
        console.error(`Error en getKlinesFromCacheOrAPI para ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Calcula el Índice de Fuerza Relativa (RSI) para una serie de datos de Klines.
 * @param {Array} klines - Array de objetos kline con propiedades 'close'.
 * @param {number} period - El período del RSI (por defecto: 6, como usa Binance para 1h RSI).
 * @returns {number|null} El valor del RSI o null si no hay suficientes datos.
 */
async function calculateRSI(klines, period = 6) { // PERÍODO CAMBIADO A 6
    if (!klines || klines.length < period + 1) { // Necesitamos al menos period + 1 velas para calcular el primer cambio.
        return null;
    }

    let gains = 0;
    let losses = 0;

    // Cálculo inicial para el primer período
    for (let i = 1; i <= period; i++) {
        const priceChange = klines[i].close - klines[i - 1].close;
        if (priceChange > 0) {
            gains += priceChange;
        } else {
            losses -= priceChange; // Las pérdidas se tratan como valores positivos
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Cálculo de la media exponencial suavizada para los períodos siguientes (Método de Wilder)
    for (let i = period + 1; i < klines.length; i++) {
        const priceChange = klines[i].close - klines[i - 1].close;
        if (priceChange > 0) {
            avgGain = (avgGain * (period - 1) + priceChange) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgLoss = (avgLoss * (period - 1) - priceChange) / period;
            avgGain = (avgGain * (period - 1)) / period;
        }
    }

    const rs = avgLoss === 0 ? 200 : avgGain / avgLoss; // Evitar división por cero. Si avgLoss es 0, RSI es 100.
    const rsi = 100 - (100 / (1 + rs));
    return rsi;
}

/**
 * Obtiene una lista de las 100 criptomonedas más fiables de Binance,
 * basándose en su volumen de trading en USDT, e incluyendo stablecoins clave.
 * Incluye RSI.
 *
 * @returns {Promise<Array>} Un array de objetos de criptomonedas con su información relevante.
 */
async function listCoins() {
    try {
        // 1. Obtener todos los tickers de 24 horas de Binance
        const tickersResponse = await axios.get(`${BASE_URL}/ticker/24hr`);

        if (tickersResponse.status !== 200) {
            console.error(`Error al obtener tickers de Binance (estado: ${tickersResponse.status})`);
            return [];
        }

        const tickersData = tickersResponse.data;

        if (!Array.isArray(tickersData)) {
            console.error("Formato de datos inesperado de tickers de Binance:", tickersData);
            return [];
        }

        // 2. Definir stablecoins importantes que siempre deben incluirse
        const importantStablecoins = ['USDT', 'FDUSD', 'USDC', 'DAI', 'BUSD']; // Agregadas DAI y BUSD si son relevantes

        const selectedCoins = [];
        const addedSymbols = new Set(); // Para evitar duplicados

        // 3. Procesar y filtrar pares USDT, y recopilar datos para ordenar
        let usdtPairs = tickersData
            .filter(ticker => ticker.symbol.endsWith('USDT'))
            .map(ticker => {
                const symbolNOUSDT = ticker.symbol.replace('USDT', '');
                const tradeVolumeUSDT = parseFloat(ticker.quoteVolume); // Volumen en USDT
                const currentPrice = parseFloat(ticker.lastPrice);
                const volume = parseFloat(ticker.volume); // Volumen en la moneda base

                // Generar URL de la imagen del logo
                const imageUrl = `https://assets.binance.com/asset/public/i30/${symbolNOUSDT.toLowerCase()}.png`;

                return {
                    symbol: symbolNOUSDT,
                    currentPrice,
                    volume,
                    tradeVolumeUSDT,
                    imageUrl,
                    // Añadir una propiedad para priorizar stablecoins en el ordenamiento
                    isStablecoin: importantStablecoins.includes(symbolNOUSDT)
                };
            });

        // 4. Ordenar las monedas: primero stablecoins, luego por volumen de trading (descendente)
        usdtPairs.sort((a, b) => {
            // Priorizar stablecoins (true viene antes que false)
            if (a.isStablecoin && !b.isStablecoin) return -1;
            if (!a.isStablecoin && b.isStablecoin) return 1;
            
            // Si ambos son stablecoins o ninguno lo es, ordenar por volumen
            return b.tradeVolumeUSDT - a.tradeVolumeUSDT;
        });

        // 5. Añadir las stablecoins importantes al principio si no están ya
        for (const stablecoinSymbol of importantStablecoins) {
            const stablecoinTicker = usdtPairs.find(coin => coin.symbol === stablecoinSymbol);
            if (stablecoinTicker && !addedSymbols.has(stablecoinSymbol)) {
                selectedCoins.push(stablecoinTicker);
                addedSymbols.add(stablecoinSymbol);
            }
        }

        // 6. Añadir el resto de las monedas fiables hasta alcanzar 100
        for (const coin of usdtPairs) {
            if (!addedSymbols.has(coin.symbol) && selectedCoins.length < 100) {
                selectedCoins.push(coin);
                addedSymbols.add(coin.symbol);
            }
            if (selectedCoins.length >= 100) {
                break; // Detener si ya tenemos 100 monedas
            }
        }

        // 7. Para cada moneda seleccionada, obtener Klines (de caché o API) y calcular RSI
        // Se usan Promise.all para hacer las llamadas a Klines concurrentemente.
        const finalCoins = await Promise.all(selectedCoins.map(async (coin) => {
            // Se necesitan suficientes klines para el cálculo del RSI (periodo 6).
            // Un límite de 30 es seguro para un período de 6.
            const klines = await getKlinesFromCacheOrAPI(`${coin.symbol}USDT`, '1h', 30); 
            const rsi = klines ? await calculateRSI(klines, 6) : null; // Pasa el período 6 explícitamente

            return {
                symbol: coin.symbol,
                currentPrice: coin.currentPrice,
                volume: coin.volume,
                tradeVolumeUSDT: coin.tradeVolumeUSDT,
                rsi: rsi,
                imageUrl: coin.imageUrl,
            };
        }));

        console.log(`Se encontraron ${finalCoins.length} monedas fiables con RSI.`);
        return finalCoins;

    } catch (error) {
        console.error("Error en listCoins:", error);
        return [];
    }
}

// Exporta el único método público
module.exports = {
    listCoins
};
