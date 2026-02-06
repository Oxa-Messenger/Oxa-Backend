const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const router = express.Router();

const User = require("./../model/User");
const ResetToken = require("./../model/ResetToken");
const {
	authmiddleware,
	generateToken,
} = require("./../middleware/jwtAuthMiddleware");
const contactRoutes = require("./contactRoutes");
const sensitiveStuff = require("./sensitiveStuff");
const {
	signupValidator,
	loginValidator,
	resetPasswordValidator,
} = require("../validators/authValidator");
const { validate } = require("../middleware/validationMiddleware");
const config = require("../config/config");
const { LoginL } = require("../validators/loginLimiter");

// Endpoints##################################

// Import contact routes
router.use("/contacts", contactRoutes);

// Import sensitive stuff routes
router.use("/sensitive-stuff", sensitiveStuff);

// Signup
router.post("/auth/signup", signupValidator, validate, async (req, res) => {
	try {
		const data = req.body;
		data.requestedMethod = req.method;

		const newUser = new User(data);
		const response = await newUser.save();
		res.status(201).json({ message: "Signup successful" });
	} catch (error) {
		console.error("Signup error:", error);
		if (error.name === "ValidationError") {
			res.status(400).json({
				error: "Validation Error",
				details: error.message,
			});
		} else if (error.code === 11000) {
			res.status(409).json({
				text1: "Signup Failed",
				text2: "username or email already exists",
				success: false,
			});
		} else {
			res.status(500).json({ error: "Internal Server Error" });
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
				return res.json({ success: false });
			}

			const isPasswordMatched = await user.comparePassword(password);
			if (!isPasswordMatched) {
				return res.json({ success: false });
			}

			const payload = {
				id: user._id,
			};

			const token = generateToken(payload);
			await User.findByIdAndUpdate(user._id, { token });

			res.status(200).json({
				success: true,
				token,
			});
		} catch (error) {
			console.error("Login error:", error);
			res.status(500).json({ success: false });
		}
	}
);

// Logout
router.post("/auth/logout", authmiddleware, async (req, res) => {
	try {
		const userId = req.user.id;
		await User.findByIdAndUpdate(userId, { token: null });

		res.status(200).json({ success: true });
	} catch (error) {
		console.error("Logout error:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Forgot Password
router.post("/auth/forgot-password", async (req, res) => {
	const { email } = req.body;

	try {
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ success: false });
		}

		// Generate random token
		const rawToken = crypto.randomInt(100000, 1000000).toString();
		const tokenHash = crypto
			.createHash("sha256")
			.update(rawToken)
			.digest("hex");

		// Save token in DB with expiration (10 mins)
		await ResetToken.create({
			userId: user._id,
			token: tokenHash,
			expiresAt: new Date(Date.now() + 10 * 60 * 1000),
		});

		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: config.EMAIL_FROM,
				pass: config.EMAIL_PASS,
			},
		});

		await transporter.sendMail({
			to: email,
			subject: "Reset Password",
			text: `Your reset code is ${rawToken}`,
		});

		return res.status(200).json({ success: true });
	} catch (error) {
		console.error("Forgot Password error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
});

// Forgot Password Reset Code Check
router.post(
	"/auth/reset-password",
	resetPasswordValidator,
	validate,
	async (req, res) => {
		try {
			const { token, password } = req.body;

			const tokenHash = crypto
				.createHash("sha256")
				.update(token)
				.digest("hex");

			const resetRecord = await ResetToken.findOneAndDelete({
				token: tokenHash,
				expiresAt: { $gt: new Date() },
			});

			if (!resetRecord) {
				return res.status(400).json({
					success: false,
					message: "Invalid or expired reset code.",
				});
			}

			const user = await User.findById(resetRecord.userId);
			if (!user) {
				return res.status(404).json({
					success: false,
					message: "User no longer exists.",
				});
			}

			user.password = password;
			await user.save(); // Triggers your hashing middleware automatically

			return res.status(200).json({
				success: true,
				message: "Password updated successfully.",
			});
		} catch (err) {
			console.error("Reset Password error:", err);
			return res
				.status(500)
				.json({ success: false, message: "Server error" });
		}
	}
);

// #######################################################
// #######################################################
// #######################################################
// #######################################################
// #######################################################

// Profile
router.get("/profile", authmiddleware, async (req, res) => {
	try {
		const userData = req.user;

		const userId = userData.id;
		const user = await User.findById(userId);

		res.status(200).json({ message: user.email });
	} catch (error) {
		console.error("GET /profile error:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Home
router.get("/home", authmiddleware, async (req, res) => {
	try {
		const user = await User.findById(req.user.id).populate({
			path: "contact",
			select: "username email _id",
		});

		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found" });
		}

		const userData = {
			userId: user._id,
			name: user.name,
			username: user.username,
			email: user.email,
			country: user.country,
			city: user.city,
			profileQRId: user._id,
			joinedCommunities:
				(user.joinedCommunities || []).map((community) =>
					typeof community === "object" && community._id
						? community._id
						: community
				) || [],
			joinedGroups:
				(user.joinedGroups || []).map((group) =>
					typeof group === "object" && group._id ? group._id : group
				) || [],
			contacts: (user.contact || []).map((contact) => ({
				user: contact.user,
				alias: contact.alias,
			})),
		};

		res.status(200).json({
			success: true,
			message: userData,
		});
	} catch (error) {
		console.error("GET /home error:", error);
		res.status(500).json({
			success: false,
			error: "Internal Server Error",
		});
	}
});

module.exports = router;
