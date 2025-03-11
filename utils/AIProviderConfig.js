// utils/AIProviderConfig.js
const AI_PROVIDERS = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    body: (messages) => ({
      model: 'deepseek-chat',
      messages,
      temperature: 0.3,
      max_tokens: 1500
    }),
    responseParser: (data) => data.choices[0].message.content
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    body: (messages) => ({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.3,
      max_tokens: 1500
    }),
    responseParser: (data) => data.choices[0].message.content
  }
};

module.exports = AI_PROVIDERS; // or export default AI_PROVIDERS; if using ES modules