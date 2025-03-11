require('dotenv').config();
const AI_PROVIDERS = require('../utils/AIProviderConfig.js'); // or import AI_PROVIDERS from './utils/AIProviderConfig.js'; if using ES modules

let Conversation;

(async () => {
  Conversation = (await import('../data/models/messageSchema.js')).default;
})();

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Get provider order from environment variable (comma-separated)
const PROVIDER_ORDER = process.env.AI_PROVIDER_ORDER?.split(',') || ['deepseek', 'openai'];

// Función para obtener la fecha actual en formato Costa Rica
function getCurrentDate() {
  return new Date().toLocaleDateString('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

async function callAIService(messages, providerName) {
  const provider = AI_PROVIDERS[providerName];
  if (!provider?.apiKey) {
    console.error(`${providerName} API key not configured`);
    return null;
  }

  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: provider.headers(provider.apiKey),
      body: JSON.stringify(provider.body(messages))
    });

    if (!response.ok) {
      throw new Error(`${providerName} API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return provider.responseParser(data);
  } catch (error) {
    console.error(`Error with ${providerName}:`, error.message);
    return null;
  }
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
    const systemPrompt = `Eres un experto en surf y oceanografía especializado en Santa Teresa, Costa Rica. La prioridad son los datos del forecast de surfline.com al respecto de santa teresa, Genera pronósticos detallados usando esta lógica:

    1. Playa a cubrir:
    - Santa Teresa costa rica

    3. Mareas:
    - Incluir tabla de mareas actuales para santa teresa

    Formato requerido:
    📅 [Fecha actual]
    🌊 Pronóstico para hoy y proximos 5 dias:
    - Día [X]: [Descripción técnica con dirección swell, periodo y tamaño]
    
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

  let assistantResponse = null;
  
  // Try providers in configured order
  for (const providerName of PROVIDER_ORDER) {
    assistantResponse = await callAIService(messages, providerName);
    if (assistantResponse) break;
  }

  if (!assistantResponse) {
    console.error("All AI providers failed");
    throw new Error("Error generando pronóstico. Intenta nuevamente.");
  }

  messages.push({ role: "assistant", content: assistantResponse });
  await Conversation.findByIdAndUpdate(
    conversationId,
    { messages: messages, lastUpdated: Date.now() },
    { new: true }
  );

  return { response: assistantResponse, conversationId: conversationId };
};
   