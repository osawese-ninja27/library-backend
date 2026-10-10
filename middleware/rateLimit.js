const rateLimit = require('express-rate-limit');

function limiter({ windowMinutes, max, message, onlyCountFailures = false }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    // Successful requests (status below 400) are not counted, so many real users
    // sharing one network address are not locked out by each other's logins.
    skipSuccessfulRequests: onlyCountFailures,
  });
}

// 10 FAILED login attempts per 15 minutes from one address.
const loginLimiter = limiter({
  windowMinutes: 15,
  max: 10,
  onlyCountFailures: true,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

// 20 sign-ups per hour from one address.
const registerLimiter = limiter({
  windowMinutes: 60,
  max: 20,
  message: 'Too many sign-up attempts. Please try again later.',
});

module.exports = { loginLimiter, registerLimiter };
