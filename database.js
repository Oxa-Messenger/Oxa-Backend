require("dotenv").config();
const mongoose = require("mongoose");
const { config } = require("./config/config");

mongoose.connect(config.MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});
const databaseConnection = mongoose.connection;

databaseConnection.on("connected", () => {
	console.log("Connected to MongoDB");
});
databaseConnection.on("disconnected", () => {
	console.log("Failed to connect to MongoDB");
});
databaseConnection.on("error", (error) => {
	console.log(`Error connecting to MongoDB: ${error}`);
});

module.exports = databaseConnection;
