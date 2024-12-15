require('dotenv').config();

let Conversation;

(async () => {
  Conversation = (await import('../data/messageSchema.js')).default;
})();

const apiKey = process.env.XAI_API_KEY;

exports.getChatbotResponse = async (userMessage, conversationId = null) => {
  let messages = [];
  let newConversation = false;

  if (conversationId) {
    // Si se proporciona un ID de conversación, intentamos encontrarla
    let conversation = await Conversation.findById(conversationId);
    if (conversation) {
      messages = conversation.messages;
    } else {
      // Si no se encuentra la conversación, creamos una nueva
      newConversation = true;
    }
  } else {
    // Si no se proporciona ID, siempre creamos una nueva conversación
    newConversation = true;
  }

  if (newConversation) {
    const newConv = new Conversation({ messages: [{ role: 'system', content: 'You are a test assistant.' }] });
    await newConv.save();
    conversationId = newConv._id;
    messages = newConv.messages;
  }

  // Añadimos el mensaje del usuario a los mensajes existentes
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      "messages": messages,
      "model": "grok-beta",
      "stream": false,
      "temperature": 0
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const assistantResponse = data.choices[0].message.content;

  // Guardamos la respuesta del asistente en la conversación existente o nueva
  messages.push({ role: 'assistant', content: assistantResponse });
  await Conversation.findByIdAndUpdate(conversationId, { messages: messages, lastUpdated: Date.now() }, { new: true });

  return { response: assistantResponse, conversationId: conversationId };
};