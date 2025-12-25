const mongoose = require("mongoose");

const resetTokenSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		token: String,
		expiresAt: Date,
	},
	{ collection: "resetTokens" }
);

resetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ResetToken", resetTokenSchema);
