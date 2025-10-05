const mongoose = require("mongoose");

const pinnedMessageSchema = mongoose.Schema(
	{
		groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
		senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		message: { type: String, required: true },
		timestamp: { type: Date, required: true },
		isPinned: { type: Boolean, default: true },
	},
	{ collection: "pinnedMessages" }
);

module.exports = mongoose.module("PinnedMessage", pinnedMessageSchema);
