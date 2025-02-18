require('dotenv').config();

let Conversation;

(async () => {
  Conversation = (await import('../data/models/messageSchema.js')).default;
})();

const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Función para obtener la fecha actual en formato Costa Rica
function getCurrentDate() {
  return new Date().toLocaleDateString('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

exports.getChatbotResponse = async (userMessage, conversationId = null) => {
  let messages = [];
  let newConversation = false;

  if (conversationId) {
    let conversation = await Conversation.findById(conversationId);
    if (conversation) messages = conversation.messages;
    else newConversation = true;
  } else {
    newConversation = true;
  }

  if (newConversation) {
    const systemPrompt = `Eres un experto en surf y oceanografía especializado en Santa Teresa, Costa Rica. Genera pronósticos detallados usando esta lógica:

    1. Playas a cubrir:
    - Santa Teresa (principal)
    - Playa Hermosa (norte de Santa Teresa)
    - Playa Carmen (sur de Santa Teresa)
    - Cedros
    - Lajas (Cabuya)

    2. Comportamiento de swells:
    - Swells SUR (dirección <200°): Mejoran en Cabuya (Lajas) con periodos >16s
    - Swells NORTE (dirección >200°): Mejores olas en Santa Teresa y Playa Hermosa


    3. Mareas:
    - Incluir tabla de mareas actuales

    Formato requerido:
    📅 [Fecha actual]
    🌊 Pronóstico próximos 16 días:
    - Día [X]: [Descripción técnica con dirección swell, periodo y tamaño]
    ...
    
    🏖 Recomendación diaria de playas
    📈 Mareas hoy (${getCurrentDate()}):
    - [Hora]: [Altura]m ([Tipo])
    `;

    const newConv = new Conversation({
      messages: [{ role: "system", content: systemPrompt }]
    });
    await newConv.save();
    conversationId = newConv._id;
    messages = newConv.messages;
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.3,
      max_tokens: 1500
    });

    const assistantResponse = completion.choices[0].message.content;
    
    messages.push({ role: "assistant", content: assistantResponse });
    await Conversation.findByIdAndUpdate(
      conversationId,
      { messages: messages, lastUpdated: Date.now() },
      { new: true }
    );

    return { response: assistantResponse, conversationId: conversationId };

  } catch (error) {
    console.error("Error en OpenAI API:", error);
    throw new Error("Error generando pronóstico. Intenta nuevamente.");
  }
};