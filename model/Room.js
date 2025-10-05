const mongoose = require("mongoose");
const participantSchema = require("./subModels/Participant");

const roomSchema = new mongoose.Schema(
	{
		name: { type: String },
		creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		members: [participantSchema],
		hideCreatorIdentity: { type: Boolean, default: true },
		expiresAt: { type: Date, required: true },
		createdAt: { type: Date, default: Date.now },
		inviteCode: {
			type: String,
			unique: true,
			required: true,
			immutable: true,
		},
	},
	{ collection: "rooms" }
);

module.exports = mongoose.model("Room", roomSchema);
