const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0", // Versión de OpenAPI
    info: {
      title: "API de Gestión de Documentos", // Título de tu API
      version: "1.0.0", // Versión de tu API
      description: "Documentación de la API para la gestión de documentos y chatbots.",
    },
    servers: [
      {
        url: "http://localhost:3000", // URL base de tu API
      },
    ],
  },
  apis: ["./controllers/*.js"], // Ruta a los archivos donde están tus comentarios Swagger
};

const specs = swaggerJsdoc(options);

module.exports = specs;
