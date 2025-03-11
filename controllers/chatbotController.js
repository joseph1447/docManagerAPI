/**
 * @swagger
 * /chatbot:
 *   post:
 *     summary: Obtiene pronósticos de surf técnicos para Santa Teresa y playas aledañas
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
 *                 description: Consulta sobre condiciones de surf o mareas
 *                 example: "Pronóstico para mañana en Cabuya"
 *               conversationId:
 *                 type: string
 *                 description: ID de conversación existente (para contexto histórico)
 *                 example: "665f7b8b1d2cae8f8c8b4567"
 *     responses:
 *       200:
 *         description: Respuesta estructurada con datos técnicos de surf
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: |
 *                     Respuesta técnica formateada con:
 *                     - Análisis de swells
 *                     - Recomendación de playas
 *                     - Tabla de mareas
 *                   example: |
 *                     📅 25/07/2024
 *                     🌊 Condiciones actuales:
 *                     - Swell SSW (195°) 1.8m @18s
 *                     - Viento: Offshore 8-10kt
 *                     
 *                     🏖 Recomendación:
 *                     🔴 Santa Teresa: Cerrada por swell sur
 *                     🔵 Cabuya: Excelentes derechas con paredes limpias
 *                     
 *                     📈 Mareas hoy:
 *                     - 05:12: 0.3m (Baja)
 *                     - 11:45: 2.1m (Alta)
 *                 conversationId:
 *                   type: string
 *                   example: "665f7b8b1d2cae8f8c8b4567"
 *   get:
 *     summary: Obtiene el pronóstico automático desde el navegador
 *     tags: [Chatbot]
 *     parameters:
 *       - in: query
 *         name: message
 *         schema:
 *           type: string
 *         description: Mensaje opcional para el pronóstico
 *       - in: query
 *         name: conversationId
 *         schema:
 *           type: string
 *         description: ID de conversación existente
 *     responses:
 *       200:
 *         description: Pronóstico en formato HTML
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...pronóstico formateado...</html>"
 */

const chatbotService = require("../services/chatbotService");
const { getCurrentDate } = require('../utils/dateUtils');

const SURF_KEYWORDS = [
  'pronóstico', 'swell', 'marea', 
  'surf', 'olas', 'Santa teresa'
];

// Función para generar el HTML
const formatHTMLResponse = (response, isSurfQuery) => {
  return `
    <html>
      <head>
        <title>🏄 Surf Bot - Santa Teresa</title>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            padding: 20px; 
            background: #f0f8ff;
            max-width: 800px;
            margin: 0 auto;
          }
          .header { color: #1a237e; }
          .response { 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0 2px 15px rgba(0,0,0,0.1);
            white-space: pre-wrap;
          }
          .timestamp { 
            color: #666; 
            font-size: 0.9em;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h1 class="header">🌊 Pronóstico Surf Costa Rica</h1>
        <div class="response">
          ${isSurfQuery ? response.response.replace(/\n/g, '<br>') : response.response}
        </div>
        <p class="timestamp">
          Actualizado: ${new Date().toLocaleTimeString('es-CR', { timeZone: 'America/Costa_Rica' })}
        </p>
      </body>
    </html>
  `;
};

exports.handleChatRequest = async (req, res) => {
  try {
    let { message, conversationId } = req.method === 'POST' ? req.body : req.query;
    
    // Mensaje predeterminado si no se envía
    if (!message) {
      message = `Generar pronóstico completo para hoy en:
      - Santa Teresa
      Incluir detalles técnicos y mareas actuales`;
    }

    // Detección automática de consultas de surf
    const isSurfQuery = SURF_KEYWORDS.some(k => message.toLowerCase().includes(k));

    if (isSurfQuery) {
      message = `Como experto en surf con 15 años de experiencia en Santa Teresa, generar:
      ${message}
      
      Requerimientos técnicos:
      ✔ Dirección precisa del swell (grados)
      ✔ Periodo y tamaño de olas (metros)
      ✔ Tabla de mareas para el dia
      
      Formato requerido:
      📅 [Fecha] | 🌡 [Condiciones]
      🏄 [Tabla de mareas]
      ⚠️ [Reporte general de las condiciones para practicar surf]`;
    }

    const response = await chatbotService.getChatbotResponse(message, conversationId);

    // Post-procesamiento técnico
    if (isSurfQuery) {
      response.response = response.response
        .replace(/(\d{2}:\d{2})/g, '🕒 $1')
        .replace(/(\d+\.\d+m)/g, '🌊 $1')
        .replace(/(\d+°)/g, '🧭 $1')
        .replace(/(\d+s)/g, '⏱ $1');
    }

    // Determinar formato de respuesta

      // res.json({
      //   response: response.response,
      //   conversationId: response.conversationId
      // });
    

    if (req.accepts('html')) {
      res.send(formatHTMLResponse(response, isSurfQuery));
    } else {
      res.json({
        response: response.response,
        conversationId: response.conversationId
      });
    }

  } catch (error) {
    const statusCode = error.message.includes('API') ? 502 : 500;
    const errorMessage = req.accepts('html') 
      ? `<h1>⚠️ Error en pronóstico</h1><p>${error.message}</p>` 
      : { error: error.message };

    res.status(statusCode).send(errorMessage);
  }
};