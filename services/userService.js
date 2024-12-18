const User = require("../data/models/userSchema");
const { v4: uuidv4 } = require("uuid");

/**
 * Encuentra un usuario por su email.
 * @param {string} email - El email del usuario.
 * @returns {Promise<Object|null>} - El usuario encontrado o null si no existe.
 */
const findUserByEmail = async (email) => {
  try {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email provided');
    }
    return await User.findOne({ email });
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
};

/**
 * Crea un nuevo usuario en la base de datos.
 * @param {Object} userData - Datos del usuario.
 * @returns {Promise<Object>} - El usuario creado.
 */
const createUser = async (userData) => {
  try {
    if (!userData || typeof userData !== 'object') {
      throw new Error('Invalid user data provided');
    }

    const user = new User({
      id: uuidv4(),
      name: userData.name,
      lastName: userData.family_name,
      email: userData.email,
      picture: userData.picture,
      createdAt: new Date(),
      loginCount: 1 // Inicializamos loginCount en 1 para el primer login
    });

    const result = await user.save();
    return result;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Encuentra un usuario o lo crea si no existe, incrementando el contador de logins.
 * @param {Object} userData - Datos del usuario.
 * @returns {Promise<Object>} - El usuario existente o creado.
 */
const findOrCreateUser = async (userData) => {
  try {
    if (!userData || typeof userData !== 'object' || !userData.email) {
      throw new Error('Invalid user data provided');
    }

    let user = await findUserByEmail(userData.email);
    console.log('Usuario encontrado:', user);

    if (!user) {
      console.log('Creando nuevo usuario...');
      user = await createUser(userData);
    } else {
      // Incrementamos el contador de login si el usuario ya existe
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();
      console.log('Login count incremented for existing user:', user.loginCount);
    }
    return user;
  } catch (error) {
    console.error('Error en findOrCreateUser:', error);
    throw error;
  }
};

module.exports = {
  findUserByEmail,
  findOrCreateUser,
};