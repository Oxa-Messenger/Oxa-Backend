require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("./database");
const config = require("./config/config");
const { jwtAuthSocket } = require("./middleware/jwtAuthMiddleware");
const { tokenManager } = require("./routes/resetPasswordRoutes");

const app = express();
const server = http.createServer(app);

// Middlewares
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, res, next) => {
	console.log(`[${new Date().toLocaleString()}] Request to ${req.originalUrl}`);
	next();
});

// Routes
const userRoutes = require("./routes/userRoutes");
app.use("/user", userRoutes);

// Socket.IO
const io = new Server(server, {
	cors: {
		origin: config.CORS_ORIGIN,
		methods: ["GET", "POST"],
	},
});
// Socket.IO middleware
io.use((socket, next) => {
	console.log(`[${new Date().toLocaleString()}] Incoming socket connection: ${socket.id}`);
	jwtAuthSocket(socket, next);
});

require("./socketHandler")(io);

// Start Server
const PORT = config.PORT;
server.listen(PORT, "0.0.0.0", () =>
	console.log(`Server is listening on PORT ${PORT}`)
);

// --- GRACEFUL SHUTDOWN LOGIC ---
process.on('SIGTERM', () => {
	console.log('SIGTERM received: Update detected on Render. Shutting down gracefully...');

	// 1. Close Socket.io connections
	// This stops new connections and closes existing ones
	io.close(() => {
		console.log('Socket.io server closed.');
	});

	// 2. Stop the Token Manager interval (prevent Jest/Node from hanging)
	if (tokenManager && tokenManager.stopGC) {
		tokenManager.stopGC();
		console.log('Token GC interval cleared.');
	}

	// 3. Stop accepting new HTTP requests
	// The server will wait for existing requests to finish (up to Render's timeout)
	server.close(() => {
		console.log('HTTP server closed. Process exiting.');
		process.exit(0);
	});

	// Safety timeout: force exit if server takes too long to close
	setTimeout(() => {
		console.error('Forcing shutdown after timeout');
		process.exit(1);
	}, 25000);
});

module.exports = server;
