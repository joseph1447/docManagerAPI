const allowedOrigins = ["http://localhost:5173", "https://doc-manager-front.vercel.app"];

module.exports = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
};
