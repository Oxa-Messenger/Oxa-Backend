const rateLimit = require('express-rate-limit');

const resetPasswordLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 3,
	message: { success: false, message: "Too many attempts" },
	standardHeaders: true,
	legacyHeaders: false,
});

module.exports = { resetPasswordLimiter };
