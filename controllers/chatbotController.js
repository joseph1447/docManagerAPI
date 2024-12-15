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
