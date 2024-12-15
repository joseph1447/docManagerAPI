/**
 * @swagger
 * /chatbot:
 *   post:
 *     summary: Envía un mensaje al chatbot y recibe una respuesta
 *     tags: [Chatbot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Mensaje enviado por el usuario
 *                 example: "Hola, ¿cómo estás?"
 *     responses:
 *       200:
 *         description: Respuesta del chatbot.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: Respuesta generada por el chatbot
 *                   example: "Hola, ¿cómo puedo ayudarte?"
 *       400:
 *         description: El mensaje del usuario es requerido.
 *       500:
 *         description: Error al procesar la solicitud.
 */

  
const chatbotService = require("../services/chatbotService");

exports.handleChatRequest = async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: "El mensaje del usuario es requerido." });
    }

    const response = await chatbotService.getChatbotResponse(userMessage);
    res.json({ response });
  } catch (error) {
    console.error("Error en el controlador de chatbot:", error);
    res.status(500).json({ error: "Error al procesar la solicitud del chatbot." });
  }
};
