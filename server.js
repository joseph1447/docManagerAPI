const express = require("express");
require("dotenv").config();
const cors = require("cors");
const multer = require("multer");
const connectDB = require("./data/connection");
const corsOptions = require("./utils/corsConfig");

// Controladores
const facturaController = require("./controllers/facturaController");
const chatbotController = require("./controllers/chatbotController");

const app = express();
const port = process.env.PORT || 3000;

// Conexión a la base de datos
connectDB();

// Configuración de middleware
app.use(cors(corsOptions));
app.use(express.json());

// Rutas
app.get("/", (req, res) => res.send("Hola Mundo"));

// Rutas de Facturas
app.post("/upload", multer({ dest: "uploads/" }).array("files", 100), facturaController.uploadFiles);

// Rutas de Chatbot
app.post("/chatbot", chatbotController.handleChatRequest);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
