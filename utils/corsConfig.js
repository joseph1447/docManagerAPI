const allowedOrigins = [
    "http://localhost:5173", // Dominio local
    "https://doc-manager-front.vercel.app", // Tu dominio en producción
    "http://localhost:3000", //Swagger local
    "https://docmanagerapi.onrender.com",//Swagger Producción
  ];
  
  const corsOptions = {
    origin: function (origin, callback) {
      if (allowedOrigins.includes(origin) || !origin) {
        // Permite la solicitud si el origen está permitido o si es una herramienta como Postman (sin origen)
        callback(null, true);
      } else {
        console.log({origin})

        // Rechaza la solicitud si el origen no está permitido
        callback(new Error("No permitido por CORS"));
      }
    },
  };
  
  module.exports = corsOptions;
  