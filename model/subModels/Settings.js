const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
	{
		language: { type: String, default: "en" },
		mediaDownloadPreference: { type: Boolean, default: false },
		notifications: {
			enabled: { type: Boolean, default: true },
			silent: { type: Boolean, default: false },
		},
	},
	{
		_id: false,
	}
);

module.exports = settingsSchema;
