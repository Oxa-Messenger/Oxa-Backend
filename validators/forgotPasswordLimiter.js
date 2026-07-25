const rateLimit = require('express-rate-limit');

const forgotPasswordLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	handler: (req, res, next, options) => {
		const minutes = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60);
		res.status(options.statusCode).json({
			success: false,
			error: `Too many attempts. Try again in ${minutes} minutes.`
		});
	},
	standardHeaders: true,
	legacyHeaders: false,
});

module.exports = { forgotPasswordLimiter };
