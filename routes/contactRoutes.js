const express = require("express");
const router = express.Router();
const { authmiddleware } = require("./../middleware/jwtAuthMiddleware");
const User = require("./../model/User");

// Endpoints##################################

// Add contact
router.post("/add", authmiddleware, async (req, res) => {
	try {
		const { identifier } = req.body; // email or username
		if (!identifier) return res.status(400).json();

		const otherUser = await User.findOne({
			$or: [
				{ email: identifier.toLowerCase() },
				{ username: identifier }
			],
		});

		if (!otherUser) return res.status(404).json();
		if (otherUser._id.equals(req.user._id)) return res.status(400).json();

		// Check if contact already exists in memory
		const exists = req.user.contact.some(c => c.user.equals(otherUser._id));
		if (exists) return res.status(409).json({ error: "Contact already exists" });

		const fallbackAlias = otherUser.email.split("@")[0];
		const finalAlias = otherUser.username || fallbackAlias;

		req.user.contact.push({ user: otherUser._id, alias: finalAlias });
		await req.user.save();

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
		if (!alias || !user) return res.status(400).json();

		// Find the contact in the array already loaded in req.user
		const contact = req.user.contact.find(c => c.user.toString() === user);

		if (!contact) {
			return res.status(404).json({ error: "Contact not found" });
		}

		contact.alias = alias;
		await req.user.save();

		return res.status(200).json({ message: "Alias updated successfully" });
	} catch (err) {
		console.error("Update contact alias error:", err);
		res.status(500).json();
	}
});

// Delete contact
router.delete("/delete", authmiddleware, async (req, res) => {
	try {
		const { user: contactId } = req.body;
		if (!contactId) return res.status(400).json();

		// Check if the contact exists in the local array
		const contactExists = req.user.contact.some(c => c.user.toString() === contactId);

		if (!contactExists) {
			return res.status(404).json({ error: "Contact not found in your list" });
		}

		req.user.contact.pull({ user: contactId });
		await req.user.save();

		return res.status(204).send();
	} catch (err) {
		console.error("Delete contact error:", err);
		res.status(500).json();
	}
});

module.exports = router;
