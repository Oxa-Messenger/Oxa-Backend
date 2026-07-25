const express = require("express");
const router = express.Router();

const User = require("./../model/User");
const {
	authmiddleware,
	generateToken,
} = require("./../middleware/jwtAuthMiddleware");
const contactRoutes = require("./contactRoutes");
const sensitiveStuff = require("./sensitiveStuff");
const { resetPasswordRoutes } = require("./resetPasswordRoutes");
const {
	signupValidator,
	loginValidator,
} = require("../validators/authValidator");
const { validate } = require("../middleware/validationMiddleware");
const { LoginL } = require("../validators/loginLimiter");

// Endpoints##################################

// Import contact routes
router.use("/contacts", contactRoutes);

// Import sensitive stuff routes
router.use("/sensitive-stuff", sensitiveStuff);

// Import forgot-password and reset-password routes
router.use("/auth", resetPasswordRoutes);

// Signup
router.post("/auth/signup", signupValidator, validate, async (req, res) => {
	try {
		const data = req.body;

		const newUser = new User(data);
		await newUser.save();
		res.status(201).json();
	} catch (error) {
		console.error("Signup error:", error);
		if (error.name === "ValidationError") {
			res.status(400).json();
		} else if (error.code === 11000) {
			res.status(409).json();
		} else {
			res.status(500).json();
		}
	}
});

// Login
router.post(
	"/auth/login",
	LoginL,
	loginValidator,
	validate,
	async (req, res) => {
		try {
			const { identifier, password } = req.body;

			const user = await User.findOne({
				$or: [
					{ email: identifier.toLowerCase() },
					{ username: identifier },
				],
			}).select("+password");

			if (!user) {
				return res.status(401).json();
			}

			const isPasswordMatched = await user.comparePassword(password);
			if (!isPasswordMatched) {
				return res.status(401).json();
			}

			const payload = {
				id: user._id,
			};

			const token = generateToken(payload);
			await User.findByIdAndUpdate(user._id, { token });

			res.status(200).json({
				token,
			});
		} catch (error) {
			console.error("Login error:", error);
			res.status(500).json();
		}
	}
);

// Logout
router.post("/auth/logout", authmiddleware, async (req, res) => {
	try {
		req.user.token = null;
		await req.user.save();

		res.status(204).send();
	} catch (error) {
		console.error("Logout error:", error);
		res.status(500).json();
	}
});

// #######################################################
// #######################################################
// #######################################################
// #######################################################
// #######################################################

// Home
router.get("/home", authmiddleware, async (req, res) => {
	try {
		const userData = {
			userId: req.user._id,
			name: req.user.name,
			username: req.user.username,
			email: req.user.email,
			country: req.user.country,
			city: req.user.city,
			profileQRId: req.user._id,
			joinedCommunities:
				(req.user.joinedCommunities || []).map((community) =>
					typeof community === "object" && community._id
						? community._id
						: community
				) || [],
			joinedGroups:
				(req.user.joinedGroups || []).map((group) =>
					typeof group === "object" && group._id ? group._id : group
				) || [],
			contacts: (req.user.contact || []).map((contact) => ({
				user: contact.user,
				alias: contact.alias,
			})),
		};

		res.status(200).json({
			message: userData,
		});
	} catch (error) {
		console.error("GET /home error:", error);
		res.status(500).json();
	}
});

module.exports = router;
