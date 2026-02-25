const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

const {
	forgotPasswordValidator,
	resetPasswordValidator,
} = require("../validators/authValidator");
const { validate } = require("../middleware/validationMiddleware");
const config = require("../config/config");
const { resetPasswordLimiter } = require("../validators/resetPasswordLimiter");
const User = require("../model/User");

// Endpoints##################################

const crypto = require('crypto');

class SecureTokenManager {
	constructor() {
		this.PIN_MIN = 10000;
		this.PIN_MAX = 99999;

		// Initialize Pool with Cryptographic Shuffle
		this.availablePins = Array.from(
			{ length: this.PIN_MAX - this.PIN_MIN + 1 },
			(_, i) => (i + this.PIN_MIN).toString()
		);
		this.secureShuffle(this.availablePins);

		this.pinToUser = new Map();
		this.userToPin = new Map();

		// Garbage Collection (Runs every 10 minute)
		this.gcInterval = setInterval(() => this.cleanupExpired(), 10 * 60 * 1000);

	}
	stopGC() {
		if (this.gcInterval) {
			clearInterval(this.gcInterval);
			console.log("Token Garbage Collection stopped.");
		}
	}

	// Using crypto.randomInt for Fisher-Yates (not Math.random)
	secureShuffle(array) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = crypto.randomInt(0, i + 1);
			[array[i], array[j]] = [array[j], array[i]];
		}
	}

	issue(userId) {
		// Pool Exhaustion Check
		if (this.availablePins.length === 0) {
			console.error("CRITICAL: Token Pool Exhausted");
			return null;
		}

		// If user already has a pin, we "bury" it at the bottom of the stack 
		// so they don't get the same one immediately.
		if (this.userToPin.has(userId)) {
			const oldPin = this.userToPin.get(userId);
			this.pinToUser.delete(oldPin);
			this.availablePins.unshift(oldPin); // Push to front (bottom of stack)
		}

		const pin = this.availablePins.pop(); // Take from back (top of stack)
		const expiresAt = Date.now() + 60 * 1000;

		this.pinToUser.set(pin, { userId, expiresAt });
		this.userToPin.set(userId, pin);
		return pin;
	}

	// Systematic Garbage Collection
	cleanupExpired() {
		const now = Date.now();
		for (const [pin, data] of this.pinToUser.entries()) {
			if (data.expiresAt < now) {
				this.pinToUser.delete(pin);
				this.userToPin.delete(data.userId);
				this.availablePins.push(pin); // Return to pool
			}
		}
	}

	consume(pin) {
		const data = this.pinToUser.get(pin);
		if (!data || data.expiresAt < Date.now()) return null;

		this.pinToUser.delete(pin);
		this.userToPin.delete(data.userId);
		this.availablePins.push(pin);
		return data.userId;
	}
}

const tokenManager = new SecureTokenManager();

// Forgot Password - Issuing the Token
router.post("/forgot-password", resetPasswordLimiter, forgotPasswordValidator, async (req, res) => {
	const { email } = req.body;
	try {
		const user = await User.findOne({ email });
		if (!user) return res.status(404).json();

		// Get unique pin from the pre-shuffled pool
		const rawToken = tokenManager.issue(user._id.toString());

		if (!rawToken) {
			return res.status(503).json();
		}

		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: { user: config.EMAIL_FROM, pass: config.EMAIL_PASS },
		});

		// Pretty HTML Email Template
		await transporter.sendMail({
			to: email,
			subject: "Reset Your Password",
			text: `Your reset code is ${rawToken}`,
			html: `
            <div style="font-family: sans-serif; max-width: 400px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #333;">Password Reset</h2>
                <p>Use the code below to reset your password. It expires in 1 minute.</p>
                <div style="background: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #007bff; border-radius: 5px;">
                    ${rawToken}
                </div>
            </div>`
		});

		return res.status(200).json({ message: "Reset code sent." });
	} catch (error) {
		console.error(error);
		res.status(500).json();
	}
});

// Reset Password - Verifying the Token
router.post("/reset-password", resetPasswordLimiter, resetPasswordValidator, validate, async (req, res) => {
	try {
		const { resetPin, password } = req.body;

		// Instant O(1) check in memory
		const userId = tokenManager.consume(resetPin);

		if (!userId) {
			return res.status(400).json({ error: "Invalid or expired code" });
		}

		const user = await User.findById(userId);
		if (!user) return res.status(404).json();

		user.password = password; // Mongoose will handle hashing
		await user.save();

		return res.status(200).json({ message: "Password updated" });
	} catch (err) {
		console.error(err);
		return res.status(500).json();
	}
});

module.exports = { resetPasswordRoutes: router, tokenManager };
