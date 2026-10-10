// Small input checks shared by the register, login and password routes.

const MIN_PASSWORD_LENGTH = 8;

// Emails are stored and compared in lowercase so "A@x.com" and "a@x.com" are the same account.
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Simple shape check: something@something.something (no spaces).
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

module.exports = { MIN_PASSWORD_LENGTH, normalizeEmail, isValidEmail };
