require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const database = require("./database");
const { jwtAuthSocket } = require("./middleware/jwtAuthMiddleware");

const app = express();
const server = http.createServer(app);

// Middlewares
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, res, next) => {
	console.log(
		`[${new Date().toLocaleString()}] Request to ${req.originalUrl}`
	);
	next();
});

// Routes
const userRoutes = require("./routes/userRoutes");
const config = require("./config/config");
app.use("/user", userRoutes);

const io = new Server(server, {
	cors: {
		origin: config.CORS_ORIGIN,
		methods: ["GET", "POST"],
	},
});
// Socket.IO middleware
io.use((socket, next) => {
	console.log(
		`[${new Date().toLocaleString()}] Incoming socket connection: ${
			socket.id
		}`
	);
	jwtAuthSocket(socket, next);
});
require("./socketHandler")(io);

const PORT = config.PORT;
server.listen(PORT, "0.0.0.0", () =>
	console.log(`Server is listening on PORT ${PORT}`)
);

// Export the server for automated testing purposes
module.exports = server;
