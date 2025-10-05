const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	joinedAt: { type: Date, default: Date.now },
	isMuted: { type: Boolean, default: false },
});

module.exports = participantSchema;
