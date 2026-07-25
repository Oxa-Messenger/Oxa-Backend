require("dotenv").config();
const mongoose = require("mongoose");
const config = require("./config/config");

mongoose.connect(config.MONGO_URI);
const databaseConnection = mongoose.connection;

databaseConnection.on("connected", async () => {
	console.log("Connected to MongoDB");

	try {
		await User.syncIndexes();
		console.log("Database indexes synced successfully");
	} catch (err) {
		console.error("Error syncing indexes:", err);
	}
});
databaseConnection.on("disconnected", () => {
	console.log("Failed to connect to MongoDB");
});
databaseConnection.on("error", (error) => {
	console.log(`Error connecting to MongoDB: ${error}`);
});

module.exports = databaseConnection;
