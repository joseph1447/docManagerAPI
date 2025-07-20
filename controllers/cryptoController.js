/**
 * @swagger
 * /top20-volatile:
 *   get:
 *     summary: Obtiene el top 20 de criptomonedas más volátiles desde la base de datos.
 *     tags: [Crypto]
 *     responses:
 *       200:
 *         description: Lista de las 20 criptomonedas más volátiles.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Mensaje informativo.
 *                   example: "Top 20 criptomonedas más volátiles (con volumen mayor a 1,000,000 USDT)"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       symbol:
 *                         type: string
 *                         description: Símbolo de la criptomoneda.
 *                         example: "BTC"
 *                       volatility:
 *                         type: number
 *                         description: Volatilidad de la criptomoneda.
 *                         example: 0.5
 *                       volume:
 *                         type: number
 *                         description: Volumen de la criptomoneda en las últimas 24 horas.
 *                         example: 1500000
 *                       currentPrice:
 *                         type: number
 *                         description: Precio actual de la criptomoneda.
 *                         example: 42000
 *                       imageUrl:
 *                         type: string
 *                         description: URL de la imagen de la criptomoneda.
 *                         example: "https://example.com/btc.png"
 *       404:
 *         description: No se encontraron datos en la base de datos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No se pudieron obtener datos."
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *            application/json:
 *              schema:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: "Error interno del servidor."
 * 
 * /api/loadCryptos:
 *   get:
 *     summary: Actualiza los datos desde Binance y almacena en la base de datos.
 *     tags: [Crypto]
 *     responses:
 *       200:
 *         description: Datos actualizados correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully updated and fetched top 20 volatile data"
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *            application/json:
 *              schema:
 *                 type: object
 *                 properties:
 *                   error:
 *                     type: string
 *                     example: "Failed to update volatile data"
 *
 * /api/top50-buy-opportunity:
 *   get:
 *     summary: Gets the top 50 cryptocurrencies with the best buy opportunity.
 *     tags: [Crypto]
 *     responses:
 *       200:
 *         description: A list of the top 50 cryptocurrencies with the best buy opportunity.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Top 50 cryptocurrencies with the best buy opportunity"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       symbol:
 *                         type: string
 *                         example: "BTC"
 *                       currentPrice:
 *                         type: number
 *                         example: 42000
 *                       volume:
 *                         type: number
 *                         example: 1500000
 *                       marketCap:
 *                         type: number
 *                         example: 800000000
 *                       rsi:
 *                         type: number
 *                         example: 25
 *                       imageUrl:
 *                         type: string
 *                         example: "https://example.com/btc.png"
 *       404:
 *         description: No data found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No data found."
 *       500:
 *         description: Internal server error.
 *         content:
 *            application/json:
 *              schema:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: "Internal server error."
 *
 * /api/top50-sell-opportunity:
 *   get:
 *     summary: Gets the top 50 cryptocurrencies with the best sell opportunity.
 *     tags: [Crypto]
 *     responses:
 *       200:
 *         description: A list of the top 50 cryptocurrencies with the best sell opportunity.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Top 50 cryptocurrencies with the best sell opportunity"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       symbol:
 *                         type: string
 *                         example: "BTC"
 *                       currentPrice:
 *                         type: number
 *                         example: 42000
 *                       volume:
 *                         type: number
 *                         example: 1500000
 *                       marketCap:
 *                         type: number
 *                         example: 800000000
 *                       rsi:
 *                         type: number
 *                         example: 75
 *                       imageUrl:
 *                         type: string
 *                         example: "https://example.com/btc.png"
 *       404:
 *         description: No data found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No data found."
 *       500:
 *         description: Internal server error.
 *         content:
 *            application/json:
 *              schema:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: "Internal server error."
 */

const express = require('express');
const { getTop20Volatile, getTop50BuyOpportunity, getTop50SellOpportunity } = require('../services/binanceService');
const router = express.Router();

router.get('/top20-volatile', async (req, res) => {
    try {
        const top20 = await getTop20Volatile(false);
        if (top20.length > 0) {
            res.json({
                message: "Top 20 criptomonedas más volátiles (con volumen mayor a 1,000,000 USDT)",
                data: top20
            });
        } else {
            res.status(404).json({ message: "No se pudieron obtener datos." });
        }
    } catch (error) {
        console.error("Error al obtener datos de Binance:", error.message);
        res.status(500).json({ message: "Error interno del servidor." });
    }
});

router.get('/top50-buy-opportunity', async (req, res) => {
    try {
        const top50Buy = await getTop50BuyOpportunity(false);
        if (top50Buy.length > 0) {
            res.json({
                message: "Top 50 cryptocurrencies with the best buy opportunity",
                data: top50Buy
            });
        } else {
            res.status(404).json({ message: "No data found." });
        }
    } catch (error) {
        console.error("Error getting top 50 buy opportunity:", error.message);
        res.status(500).json({ message: "Internal server error." });
    }
});

router.get('/top50-sell-opportunity', async (req, res) => {
    try {
        const top50Sell = await getTop50SellOpportunity(false);
        if (top50Sell.length > 0) {
            res.json({
                message: "Top 50 cryptocurrencies with the best sell opportunity",
                data: top50Sell
            });
        } else {
            res.status(404).json({ message: "No data found." });
        }
    } catch (error) {
        console.error("Error getting top 50 sell opportunity:", error.message);
        res.status(500).json({ message: "Internal server error." });
    }
});

// router.get('/api/loadCryptos', async (req, res) => {
//     try {
//         await updateDataFromBinance();
//         res.json({ message: 'Successfully updated and fetched top 20 volatile data' });
//     } catch (error) {
//         console.error('Error updating and fetching top 20 volatile:', error.message);
//         res.status(500).json({ error: 'Failed to update volatile data' });
//     }
// });

module.exports = router;
