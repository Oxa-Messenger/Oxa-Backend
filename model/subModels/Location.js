const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
	{
		country: { type: String, default: null },
		city: { type: String, default: null },
	},
	{ _id: false }
);

module.exports = locationSchema;
