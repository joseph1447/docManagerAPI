

const express = require('express');
// Importa únicamente el nuevo método listCoins desde tu servicio
const { listCoins } = require('../services/binanceService');
const router = express.Router();

/**
 * Ruta para obtener una lista de criptomonedas fiables.
 * Responde con una lista de las 100 monedas más fiables por volumen y capitalización,
 * incluyendo stablecoins importantes, y su RSI.
 */
router.get('/list-reliable-coins', async (req, res) => {
    try {
        // Llama a la función del servicio para obtener la lista de monedas.
        const coins = await listCoins(); 

        if (coins.length > 0) {
            // Si se encuentran datos, envía una respuesta JSON con un mensaje y los datos.
            res.json({
                message: "Lista de las 100 criptomonedas más fiables.",
                data: coins
            });
        } else {
            // Si no se encuentran datos, envía un estado 404.
            res.status(404).json({ message: "No se encontraron datos." });
        }
    } catch (error) {
        // Captura cualquier error durante el proceso y envía un estado 500.
        console.error("Error al listar las monedas fiables:", error.message);
        res.status(500).json({ message: "Error interno del servidor al listar las monedas." });
    }
});

// Exporta el router para que pueda ser usado en tu aplicación Express principal.
module.exports = router;