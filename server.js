const express = require("express")
require("dotenv").config()
const cors = require("cors")
const multer = require("multer");
const connectDB = require("./data/connection")
const corsOptions = require("./utils/corsConfig")
const swaggerUi = require("swagger-ui-express")
const swaggerSpecs = require("./utils/swaggerConfig")
const {authenticateGoogleUser} = require("./controllers/userController")
const facturaController = require("./controllers/facturaController")
const chatbotController = require("./controllers/chatbotController")
const cryptoController = require('./controllers/cryptoController.js')

const app = express()
app.disabled('X-Powered-By')

const port = process.env.PORT || 3000

// Conexión a la base de datos
connectDB()

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs))

// Base route
app.get("/", (req, res) => res.json({API:'DocManagerAPI'}))

// Rutas de usuarios
app.post("/auth/google", authenticateGoogleUser)

// Rutas de facturas
app.post(
  "/upload",
  multer({ dest: "uploads/" }).array("files", 100),
  facturaController.uploadFiles
)

// Rutas de chatbot
app.post("/chatbot", chatbotController.handleChatRequest)
app.get("/forecast", chatbotController.handleChatRequest)

// **Mount the crypto controller**
app.use('/api', cryptoController);  // Mount under the "/api" path

//controlamos todas las peticiones en la ultima request
app.use((req,res)=>{

return res.status(404).send('<h1>Eror 404 Not Found</h1>')

})

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`)
})
