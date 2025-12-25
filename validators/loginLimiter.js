const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { success: false, message: "Too many attempts" },
	standardHeaders: true,
	legacyHeaders: false,
});

module.exports = { LoginL: loginLimiter };
