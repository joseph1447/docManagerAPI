/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Autentica un usuario mediante Google OAuth
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               googleId:
 *                 type: string
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               picture:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario autenticado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *       500:
 *         description: Error interno del servidor.
 */

/**
 * Maneja la autenticación de usuarios mediante Google.
 * @param {Object} req - Objeto de solicitud.
 * @param {Object} res - Objeto de respuesta.
 */

const userService = require("../services/userService");

const authenticateGoogleUser = async (req, res) => {
const {userData} = req.body;
console.log( { userData});
  try {
    // Encuentra o crea el usuario
    const user = await userService.findOrCreateUser(userData);

    res.status(200).json({ message: "Usuario autenticado con éxito", user });
  } catch (error) {
    console.error("Error en autenticación de usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = {
  authenticateGoogleUser,
};
