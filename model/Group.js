const mongoose = require("mongoose");
const participantSchema = require("./subModels/Participant");

const groupSchema = mongoose.Schema(
	{
		name: { type: String, required: true },
		description: { type: String },
		founder: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		members: [participantSchema],
		city: { type: String },
		country: { type: String },
		isPrivate: { type: Boolean, default: false },
		allowPinning: { type: Boolean, default: true },
		createdAt: { type: Date, default: Date.now },
	},
	{ collection: "groups" }
);

module.exports = mongoose.model("Group", groupSchema);
