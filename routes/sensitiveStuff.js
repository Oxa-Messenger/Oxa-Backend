const express = require("express");
const router = express.Router();
const { authmiddleware } = require("../middleware/jwtAuthMiddleware");
const config = require("../config/config");

// Endpoints##################################

// return ice servers
let ICE_SERVERS = null; // cache the ICE servers to avoid fetching them on every request
router.get("/ice-servers", authmiddleware, async (req, res) => {
	try {
		if (!ICE_SERVERS) {
			const response = await fetch(config.ICE_SERVERS_API_KEY);
			ICE_SERVERS = await response.json();
		}

		res.status(200).json(ICE_SERVERS);
	} catch (err) {
		console.error("ICE servers error:", err);
		res.status(500).json();
	}
});

module.exports = router;
