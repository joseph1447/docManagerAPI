const express = require("express");
require("dotenv").config();
const cors = require("cors");
const multer = require("multer");
const connectDB = require("./data/connection");
const corsOptions = require("./utils/corsConfig");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./utils/swaggerConfig");
const userController = require("./controllers/userController");
const facturaController = require("./controllers/facturaController");
const chatbotController = require("./controllers/chatbotController");

const app = express();
const port = process.env.PORT || 3000;

// Conexión a la base de datos
connectDB();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Base route
app.get("/", (req, res) => res.send("Hola Mundo"));

// Rutas de usuarios
app.post("/auth/google", userController.authenticateGoogleUser);

// Rutas de facturas
app.post(
  "/upload",
  multer({ dest: "uploads/" }).array("files", 100),
  facturaController.uploadFiles
);

// Rutas de chatbot
app.post("/chatbot", chatbotController.handleChatRequest);

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
