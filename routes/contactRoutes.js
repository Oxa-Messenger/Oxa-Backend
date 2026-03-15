const express = require("express");
const router = express.Router();
const { authmiddleware } = require("./../middleware/jwtAuthMiddleware");
const User = require("./../model/User");

// Endpoints##################################

// Add contact
router.post("/add", authmiddleware, async (req, res) => {
	try {
		const { identifier } = req.body; // email or username
		const myUserId = req.user.id;

		if (!identifier) return res.status(400).json();

		const otherUser = await User.findOne({
			$or: [
				{ email: identifier.toLowerCase() },
				{ username: identifier }
			],
		});

		if (!otherUser) return res.status(404).json();
		if (String(otherUser._id) === String(myUserId)) return res.status(400).json();

		const fallbackAlias = otherUser.email.split("@")[0];
		const finalAlias = otherUser.username || fallbackAlias;

		const result = await User.updateOne(
			{
				_id: myUserId,
				"contact.user": { $ne: otherUser._id } // "Not Equal" - only match if NOT present
			},
			{
				$push: { contact: { user: otherUser._id, alias: finalAlias } }
			}
		);

		if (result.matchedCount === 0) {
			return res.status(409).json({ error: "Contact already exists" });
		}

		return res.status(201).json({
			contact: { user: otherUser._id, alias: finalAlias },
		});

	} catch (err) {
		console.error("Add contact error:", err);
		res.status(500).json();
	}
});

// Update contact alias
router.put("/update-alias", authmiddleware, async (req, res) => {
	try {
		const { alias, user } = req.body; // ID of the contact to update
		const myId = req.user.id;

		if (!alias || !user) {
			return res.status(400).json({ error: "Alias and User ID are required" });
		}

		const result = await User.updateOne(
			{ _id: myId, "contact.user": user },
			{ $set: { "contact.$.alias": alias } }
		);

		if (result.matchedCount === 0) {
			return res.status(404).json({ error: "Contact not found" });
		}

		return res.status(200).json({ message: "Alias updated successfully" });
	} catch (err) {
		console.error("Update contact alias error:", err);
		res.status(500).json();
	}
});

// Delete contact
router.delete("/delete", authmiddleware, async (req, res) => {
	try {
		const { user } = req.body; // ID of the contact to delete
		const myUserId = req.user.id;
		if (!user) {
			return res.status(400).json();
		}
		const result = await User.updateOne(
			{ _id: myUserId, "contact.user": user },
			{ $pull: { contact: { user: user } } }
		);

		if (result.matchedCount === 0) {
			return res.status(404).json({ error: "Contact not found in your list" });
		}

		return res.status(204).send();
	} catch (err) {
		console.error("Delete contact error:", err);
		res.status(500).json();
	}
});

module.exports = router;
