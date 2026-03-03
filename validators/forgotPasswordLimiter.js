const rateLimit = require('express-rate-limit');

const forgotPasswordLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	message: { success: false, message: "Too many attempts" },
	standardHeaders: true,
	legacyHeaders: false,
});

module.exports = { forgotPasswordLimiter };
