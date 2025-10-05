const mongoose = require("mongoose");
const LocationSchema = require("./subModels/Location");
const participantSchema = require("./subModels/Participant");

const communitySchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		description: { type: String },
		location: LocationSchema,
		members: [participantSchema],
		public: { type: Boolean, default: true },
		isClosed: { type: Boolean, default: false },
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		createdAt: { type: Date, default: Date.now },
		inviteCode: {
			type: String,
			unique: true,
			required: true,
			immutable: true,
		},
	},
	{ collection: "communities" }
);

module.exports = mongoose.model("Community", communitySchema);
