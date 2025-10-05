const mongoose = require("mongoose");

const accountSessionSchema = new mongoose.Schema(
	{
		deviceId: { type: String, required: true },
		lastActive: { type: Date, default: Date.now },
	},
	{
		_id: false,
	}
);

module.exports = accountSessionSchema;
