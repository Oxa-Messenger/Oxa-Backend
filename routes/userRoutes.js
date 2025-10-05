const express = require("express");
const router = express.Router();
const {
	authmiddleware,
	generateToken,
} = require("./../middleware/jwtAuthMiddleware");
const User = require("./../model/User");
const ResetToken = require("./../model/ResetToken");
const nodemailer = require("nodemailer");
const { config } = require("../config/config");

// Endpoints##################################

// Signup
router.post("/auth/signup", async (req, res) => {
	try {
		const data = req.body;
		data.requestedMethod = req.method;

		const newUser = new User(data);
		const response = await newUser.save();

		res.status(201).json({ message: "Signup successful", user: response });
	} catch (error) {
		if (error.name === "ValidationError") {
			res.status(400).json({
				error: "Validation Error",
				details: error.message,
			});
		} else if (error.code === 11000) {
			res.status(409).json({ error: "Email already exists" });
		} else {
			res.status(500).json({ error: "Internal Server Error" });
		}
	}
});

// Login
router.post("/auth/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		const user = await User.findOne({ email }).select("+password");
		if (!user) {
			return res.json({ success: false });
		}

		const isPasswordMatched = await user.comparePassword(password);
		if (!isPasswordMatched) {
			return res.json({ success: false });
		}

		const payload = {
			id: user._id,
			email: user.email,
		};

		const Token = generateToken(payload);
		await User.findOneAndUpdate(
			{ _id: user._id },
			{ token: Token }, // use the new token you just created
			{ runValidators: false, new: true, context: "query" }
		);

		res.status(200).json({
			token: Token,
			success: true,
		});
	} catch (error) {
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Logout
router.post("/auth/logout", authmiddleware, async (req, res) => {
	try {
		const userId = req.user.id;
		await User.findByIdAndUpdate(userId, { token: null });

		res.status(200).json({ success: true });
	} catch (error) {
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
		const resetToken = Math.floor(
			100000 + Math.random() * 900000
		).toString();

		// Save token in DB with expiration (10 mins)
		await ResetToken.create({
			userId: user._id,
			token: resetToken,
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
			from: config.EMAIL_FROM,
			to: email,
			subject: "Reset Your Password",
			text: `Your password reset code is: ${resetToken}`,
		});

		return res.status(200).json({ success: true });
	} catch (error) {
		res.status(500).json({ success: false, message: "Server error" });
	}
});

// Forgot Password Reset Code Check
router.post("/auth/reset-password", async (req, res) => {
	try {
		const { token, password } = req.body;
		if (!token || !password) {
			return res
				.status(400)
				.json({ success: false, message: "Enter missing fields" });
		}

		const resetToken = await ResetToken.findOne({ token }).populate(
			"userId"
		);
		if (!resetToken || resetToken.expiresAt < new Date()) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid or expired token" });
		}

		const user = resetToken.userId;
		user.password = password;

		await User.findOneAndUpdatePassword(
			{ _id: user._id },
			{ password: user.password },
			{ runValidators: false }
		);

		await ResetToken.deleteOne({ token });

		return res.status(200).json({ success: true });
	} catch (err) {
		return res
			.status(500)
			.json({ success: false, message: "Server error" });
	}
});

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
			contacts: (user.contact || []).map((contact) =>
				typeof contact === "object" && contact._id
					? {
							otherUserId: contact._id,
							otherUsername: contact.username,
							otherEmail: contact.email,
					  }
					: contact
			),
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
