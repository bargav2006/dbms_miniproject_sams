const bcrypt = require('bcryptjs');
const SALT_ROUNDS = 10;

const hashPassword = async (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (rawPassword, storedPassword) => {
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    return false;
  }
  if (typeof storedPassword !== 'string' || storedPassword.length === 0) {
    return false;
  }

  const trimmedStored = storedPassword.trim();
  const isBcryptHash = trimmedStored.startsWith('$2a$') || trimmedStored.startsWith('$2b$') || trimmedStored.startsWith('$2y$');

  if (isBcryptHash) {
    return bcrypt.compare(rawPassword, trimmedStored);
  }

  return rawPassword === trimmedStored;
};

module.exports = { hashPassword, verifyPassword };
