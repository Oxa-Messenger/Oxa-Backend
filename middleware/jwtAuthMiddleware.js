const jwt = require("jsonwebtoken");
const User = require("./../model/User");
const { config } = require("./../config/config");

// Middleware to protect routes
async function authmiddleware(req, res, next) {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) return res.status(401).json({ error: "Unauthorized" });

	try {
		const decoded = jwt.verify(token, config.JWT_SECRET);

		const user = await User.findOne({ _id: decoded.id });

		if (user.token !== token) {
			return res.status(200).json({
				success: true,
				message: "Unauthorised",
			});
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(403).json({ error: "Forbidden" });
	}
}

const generateToken = (userData) => {
	return jwt.sign(userData, config.JWT_SECRET);
};

function jwtAuthSocket(socket, next) {
	try {
		const token = socket.handshake.auth?.token;
		if (!token) return next(new Error("No token"));

		const decoded = jwt.verify(token, config.JWT_SECRET);
		socket.data.userId = decoded.id;
		next();
	} catch (err) {
		next(new Error("Auth failed"));
	}
}

module.exports = { authmiddleware, generateToken, jwtAuthSocket };
