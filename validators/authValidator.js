const { body } = require("express-validator");

exports.signupValidator = [
	body("email").isEmail().normalizeEmail(),
	body("password").isLength({ min: 8 }),
	body("username").optional().isAlphanumeric().isLength({ min: 5, max: 20 }),
];

exports.loginValidator = [
	body("identifier").trim().notEmpty(),
	body("password").notEmpty(),
];

exports.resetPasswordValidator = [
	body("token").isLength({ min: 6, max: 64 }),
	body("password").isLength({ min: 8 }),
];
