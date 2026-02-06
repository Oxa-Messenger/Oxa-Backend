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

		if (!identifier) {
			return res.status(400).json();
		}

		const otherUser = await User.findOne({
			$or: [{ email: identifier }, { username: identifier }],
		});

		if (!otherUser) {
			return res.status(404).json();
		}

		if (String(otherUser._id) === String(myUserId)) {
			return res.status(400).json();
		}

		const me = await User.findById(myUserId);

		const alreadyExists = me.contact.some(
			(c) => String(c.user) === String(otherUser._id)
		);

		if (alreadyExists) {
			return res.status(409).json();
		}

		const fallbackAlias = otherUser.email.split("@")[0];
		const finalAlias = otherUser.username || fallbackAlias;
		await User.findByIdAndUpdate(myUserId, {
			$push: {
				contact: { user: otherUser._id, alias: finalAlias },
			},
		});

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
		const { alias } = req.body; // ID of the contact to update
		const myUserId = req.user.id;

		if (!alias) {
			return res.status(400).json();
		}

		if (!req.body.user) {
			return res.status(400).json();
		}

		const me = await User.findById(myUserId);

		const contactExists = me.contact.some(
			(c) => String(c.user) === String(req.body.user)
		);
		if (!contactExists) {
			return res.status(404).json();
		}
		await User.findByIdAndUpdate(
			myUserId,
			{
				$set: {
					"contact.$[elem].alias": alias,
				},
			},
			{
				arrayFilters: [{ "elem.user": req.body.user }],
			}
		);
		return res.status(200).json();
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
		const me = await User.findById(myUserId);
		const contactExists = me.contact.some(
			(c) => String(c.user) === String(user)
		);
		if (!contactExists) {
			return res.status(404).json();
		}

		await User.findByIdAndUpdate(myUserId, {
			$pull: {
				contact: { user: user },
			},
		});
		return res.status(200).json();
	} catch (err) {
		console.error("Delete contact error:", err);
		res.status(500).json();
	}
});

module.exports = router;
