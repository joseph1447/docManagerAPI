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
 *               conversationId:
 *                 type: string
 *                 description: ID de la conversación existente (opcional)
 *                 example: "5f56a01be4b0f5e6f826f99f"
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
 *                 conversationId:
 *                   type: string
 *                   description: ID de la conversación
 *                   example: "5f56a01be4b0f5e6f826f99f"
 *       400:
 *         description: El mensaje del usuario es requerido.
 *       500:
 *         description: Error al procesar la solicitud.
 */

const chatbotService = require("../services/chatbotService");

exports.handleChatRequest = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "El mensaje del usuario es requerido." });
    }

    const response = await chatbotService.getChatbotResponse(message, conversationId);
    res.json({ response: response.response, conversationId: response.conversationId });
  } catch (error) {
    console.error("Error en el controlador de chatbot:", error);
    res.status(500).json({ error: "Error al procesar la solicitud del chatbot." });
  }
};