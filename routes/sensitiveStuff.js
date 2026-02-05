const express = require("express");
const router = express.Router();
const { authmiddleware } = require("../middleware/jwtAuthMiddleware");
const config = require("../config/config");

// Endpoints##################################

// return ice servers
router.get("/ice-servers", authmiddleware, async (req, res) => {
	try {
		const response = await fetch(config.ICE_SERVERS_API_KEY);

		const ICE_SERVERS = await response.json();

		res.status(200).json(ICE_SERVERS);
	} catch (err) {
		console.error("ICE servers error:", err);
		res.status(500).json({ success: false });
	}
});

module.exports = router;
