/**
 * @swagger
 * /top20-volatile:
 *   get:
 *     summary: Obtiene el top 20 de criptomonedas más volátiles.
 *     tags: [Crypto] # Agrupa los endpoints relacionados con criptomonedas
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
 *                         example: "BTCUSDT"
 *                       volatility:
 *                         type: number
 *                         description: Volatilidad de la criptomoneda.
 *                         example: 0.5
 *                       volume:
 *                         type: number
 *                         description: Volumen de la criptomoneda en las últimas 24 horas.
 *                         example: 1500000
 *       404:
 *         description: No se pudieron obtener datos.
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
 */

const express = require('express');
const { getTop20Volatile } = require('../services/binanceService');
const router = express.Router();

router.get('/top20-volatile', async (req, res) => {
    try {
        const top20 = await getTop20Volatile();
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

module.exports = router;