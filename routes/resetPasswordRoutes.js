const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const router = express.Router();

const { forgotPasswordValidator, resetPasswordValidator } = require("../validators/authValidator");
const { validate } = require("../middleware/validationMiddleware");
const config = require("../config/config");
const { forgotPasswordLimiter } = require("../validators/forgotPasswordLimiter");
const { resetPasswordLimiter } = require("../validators/resetPasswordLimiter");
const User = require("../model/User");

// ==========================================
// In-Memory Token Store (Dynamic Hash Map)
// ==========================================
const tokenStore = new Map();
const TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Passive Garbage Collection to prevent Memory Leaks
// Runs every 5 minutes to sweep $O(n) over active requests only
setInterval(() => {
	const now = Date.now();
	for (const [email, data] of tokenStore.entries()) {
		if (data.expiresAt < now) {
			tokenStore.delete(email);
		}
	}
}, 5 * 60 * 1000).unref(); // .unref() prevents this interval from keeping the Node process alive indefinitely

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: { user: config.EMAIL_FROM, pass: config.EMAIL_PASS },
});

// ==========================================
// Endpoints
// ==========================================

// Forgot Password - Issuing the Token
router.post("/forgot-password", forgotPasswordLimiter, forgotPasswordValidator, validate, async (req, res) => {
	const { email } = req.body;
	try {
		// 1. Verify user exists
		const user = await User.findOne({ email });
		if (!user) {
			// Return 200 to prevent email enumeration attacks
			return res.status(200).json({ message: "If an account exists, a reset code has been sent." });
		}

		// 2. Generate Cryptographically Secure 5-Digit PIN
		const pin = crypto.randomInt(10000, 100000).toString();

		// 3. Store/Overwrite in Hash Map ($O(1) operation)
		tokenStore.set(email, {
			pin,
			expiresAt: Date.now() + TOKEN_EXPIRY_MS
		});

		// 4. Dispatch Email (Consider offloading to a Job Queue like BullMQ in the future)
		await transporter.sendMail({
			to: email,
			subject: "Reset Your Password",
			text: `Your reset code is ${pin}`,
			html: `
            <div style="font-family: sans-serif; max-width: 400px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #333;">Password Reset</h2>
                <p>Use the code below to reset your password. It expires in 10 minutes.</p>
                <div style="background: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #007bff; border-radius: 5px;">
                    ${pin}
                </div>
            </div>`
		});

		return res.status(200).json({ message: "If an account exists, a reset code has been sent." });
	} catch (error) {
		console.error("Forgot Password Error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Reset Password - Verifying the Token
router.post("/reset-password", resetPasswordLimiter, resetPasswordValidator, validate, async (req, res) => {
	try {
		const { email, resetPin, password } = req.body;

		// 1. $O(1) Lookup in Token Store
		const record = tokenStore.get(email);

		// 2. Validate existence, expiration, and PIN match
		if (!record || record.expiresAt < Date.now() || record.pin !== resetPin) {
			return res.status(400).json({ error: "Invalid or expired code" });
		}

		// 3. Find User and Update
		const user = await User.findOne({ email });
		if (!user) return res.status(404).json({ error: "User not found." });

		user.password = password;
		await user.save(); // MUST trigger Mongoose pre-save hook for bcrypt hashing

		// 4. Invalidate the token to prevent replay attacks
		tokenStore.delete(email);

		return res.status(200).json({ message: "Password updated successfully." });
	} catch (err) {
		console.error("Reset Password Error:", err);
		return res.status(500).json({ error: "Internal server error" });
	}
});

module.exports = { resetPasswordRoutes: router };
