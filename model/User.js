const mongoose = require("mongoose");
const DeviceInfo = require("./subModels/DeviceInfo");
const AccountSession = require("./subModels/AccountSession");
const Settings = require("./subModels/Settings");
const ReportedUser = require("./subModels/ReportedUser");
const Contact = require("./subModels/Contact");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { validate } = require("uuid");
const { config } = require("./../config/config");

const userSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		online: { type: Boolean, default: false },
		username: {
			type: String,
			unique: true,
			sparse: true,
			immutable: true,
			match: [/^[a-zA-Z0-9_]+$/, "Invalid username format"],
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			immutable: true,
			lowercase: true,
			match: [
				/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/,
				"Please fill a valid email address",
			],
			trim: true,
		},
		password: { type: String, required: true, minlength: 6, select: false },
		country: { type: String, default: null, trim: true },
		city: { type: String, default: null, trim: true },
		publicKey: { type: String, required: true },
		playIntegrityHash: { type: String, required: true },
		token: { type: String, default: null },
		joinedCommunities: {
			type: [mongoose.Schema.Types.ObjectId],
			ref: "Community",
			validate: [
				(val) => {
					return val.length <= 100;
				},
				"Upto 100 communities can be joined",
			],
		},
		joinedGroups: {
			type: [mongoose.Schema.Types.ObjectId],
			ref: "Group",
			validate: [
				(val) => {
					return val.length <= 200;
				},
				"Upto 200 groups can be joined",
			],
		},
		deviceInfo: DeviceInfo,
		accountSession: AccountSession,
		settings: Settings,
		reportBlacklist: ReportedUser,
		contact: [Contact],
	},
	{ collection: "users" }
);

// Middleware to hash password before saving
userSchema.pre("save", async function (next) {
	try {
		if (this.isModified("password")) {
			const saltRounds = parseInt(config.SALT_ROUNDS);
			this.password = await bcrypt.hash(this.password, saltRounds);
		}
	} catch (err) {
		return next(err);
	}

	next();
});

// Update Password
userSchema.pre("findOneAndUpdatePassword", async function (next) {
	const update = this.getUpdate(); // Get update payload

	if (!update.password) {
		return next();
	}

	try {
		const saltRounds = parseInt(config.SALT_ROUNDS);
		update.password = await bcrypt.hash(update.password, saltRounds);

		this.setUpdate(update);

		next();
	} catch (err) {
		next(err);
	}
});

// Method to compare a given password with the stored hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
	try {
		const isMatch = await bcrypt.compare(candidatePassword, this.password);
		return isMatch;
	} catch (err) {
		throw err;
	}
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
