const express = require("express")
const crypto = require("crypto")
const cors = require("cors")
const corsOptions = require("./utils/corsConfig")
const swaggerUi = require("swagger-ui-express")
const swaggerSpecs = require("./utils/swaggerConfig")
const {authenticateGoogleUser} = require("./controllers/userController")
const facturaController = require("./controllers/facturaController")
const chatbotController = require("./controllers/chatbotController")
const cryptoController = require('./controllers/cryptoController.js')
const { uploadXmlFiles } = require("./middleware/uploadXmlFiles")

// Express app without side effects (no DB connection, no listen) so tests can import it.
const app = express()
app.disable('x-powered-by')

// Middleware
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID().slice(0, 8)
  res.setHeader("X-Request-Id", req.requestId)
  next()
})
app.use(cors(corsOptions))
app.use(express.json())

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs))

// Base route
app.get("/", (req, res) => res.json({API:'DocManagerAPI'}))

// Rutas de usuarios
app.post("/auth/google", authenticateGoogleUser)

// Rutas de facturas
app.post("/upload", uploadXmlFiles, facturaController.uploadFiles)

// Rutas de chatbot
app.post("/chatbot", chatbotController.handleChatRequest)
app.get("/forecast", chatbotController.handleChatRequest)

// **Mount the crypto controller**
app.use('/api', cryptoController);  // Mount under the "/api" path

//controlamos todas las peticiones en la ultima request
app.use((req,res)=>{

return res.status(404).send('<h1>Eror 404 Not Found</h1>')

})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isCors = err.message === "No permitido por CORS"
  console.error(`[${req.requestId}] ${req.method} ${req.path}:`, err.message)
  res.status(isCors ? 403 : 500).json({
    error: {
      code: isCors ? "CORS_NOT_ALLOWED" : "INTERNAL_ERROR",
      message: isCors ? "Origen no permitido." : "Error interno del servidor.",
      details: { reason: err.message },
    },
    requestId: req.requestId,
  })
})

module.exports = app
