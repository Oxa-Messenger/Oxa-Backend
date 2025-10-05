const mongoose = require("mongoose");

const reportedUserSchema = new mongoose.Schema(
	{
		blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		reportedUsers: [
			{
				userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
				reason: { type: String },
				timestamp: { type: Date, default: Date.now },
			},
		],
	},
	{
		_id: false,
	}
);

module.exports = reportedUserSchema;
