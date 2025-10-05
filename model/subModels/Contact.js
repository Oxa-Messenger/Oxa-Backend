const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		addedAt: {
			type: Date,
			default: Date.now,
		},
		alias: { type: String },
	},
	{ _id: false }
);

module.exports = contactSchema;
