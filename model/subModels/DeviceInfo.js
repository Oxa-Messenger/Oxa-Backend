const mongoose = require("mongoose");

const deviceInfoSchema = new mongoose.Schema(
	{
		model: { type: String, required: true },
		isRooted: { type: Boolean, default: false },
		isEmulator: { type: Boolean, default: false },
	},
	{
		_id: false,
	}
);

module.exports = deviceInfoSchema;
