// connection.js
require('dotenv').config();
const mongoose = require('mongoose');

// Conexión a MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB');
  } catch (err) {
    console.error('Error al conectar a MongoDB:', err);
    // process.exit(1);  // Detiene el proceso si la conexión falla
  }
};

// Exportamos la función connectDB
module.exports = connectDB;
