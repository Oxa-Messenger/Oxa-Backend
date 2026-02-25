const { body } = require("express-validator");

exports.signupValidator = [
	body("email").isEmail().normalizeEmail().notEmpty(),
	body("password").isString().isLength({ min: 8 }).notEmpty().matches(/^[\x20-\x7E]+$/),
	body("username").optional().isString().isLength({ min: 5, max: 20 }),
];

exports.loginValidator = [
	body("identifier").isString().trim().notEmpty(),
	body("password").isString().isLength({ min: 8 }).notEmpty().matches(/^[\x20-\x7E]+$/),
];

exports.forgotPasswordValidator = [
	body("email").isEmail().normalizeEmail().notEmpty(),
];

exports.resetPasswordValidator = [
	body("resetPin").isNumeric().isLength({ min: 5, max: 5 }).notEmpty(),
	body("password").isString().isLength({ min: 8 }).notEmpty().matches(/^[\x20-\x7E]+$/),
];
