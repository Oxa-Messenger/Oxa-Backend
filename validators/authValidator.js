const { body } = require("express-validator");

exports.signupValidator = [
	body("email").isEmail().normalizeEmail().notEmpty(),
	body("password").isString.isLength({ min: 8 }).notEmpty(),
	body("username").optional().isString().isLength({ min: 5, max: 20 }),
];

exports.loginValidator = [
	body("identifier").isString.trim().notEmpty(),
	body("password").isString.isLength({ min: 8 }).notEmpty(),
];

exports.resetPasswordValidator = [
	body("token").isNumeric.isLength({ min: 6, max: 6 }).notEmpty(),
	body("password").isString.isLength({ min: 8 }).notEmpty(),
];
