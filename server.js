require("dotenv").config()
const connectDB = require("./data/connection")
const app = require("./app")

const port = process.env.PORT || 3000

// Conexión a la base de datos
connectDB()

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`)
})
