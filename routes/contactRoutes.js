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
			return res.status(400).json({
				success: false,
				message: "Identifier required",
			});
		}

		const otherUser = await User.findOne({
			$or: [{ email: identifier }, { username: identifier }],
		});

		if (!otherUser) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		if (String(otherUser._id) === String(myUserId)) {
			return res.status(400).json({
				success: false,
				message: "You cannot add yourself",
			});
		}

		const me = await User.findById(myUserId);

		const alreadyExists = me.contact.some(
			(c) => String(c.user) === String(otherUser._id)
		);

		if (alreadyExists) {
			return res.status(409).json({
				success: false,
				message: "Contact already added",
			});
		}

		const fallbackAlias = otherUser.email.split("@")[0];
		const finalAlias = otherUser.username || fallbackAlias;
		const updatedUser = await User.findByIdAndUpdate(myUserId, {
			$push: {
				contact: { user: otherUser._id, alias: finalAlias },
			},
		});

		return res.status(201).json({
			success: true,
			message: "Contact added",
			contact: { user: otherUser._id, alias: finalAlias },
		});
	} catch (err) {
		console.error("Add contact error:", err);
		res.status(500).json({ success: false });
	}
});

// Update contact alias
router.put("/update-alias", authmiddleware, async (req, res) => {
	try {
		const { alias } = req.body; // ID of the contact to update
		const myUserId = req.user.id;

		if (!alias) {
			return res.status(400).json({
				success: false,
				message: "Alias required",
			});
		}

		if (!req.body.user) {
			return res.status(400).json({
				success: false,
				message: "Contact user id required",
			});
		}

		const me = await User.findById(myUserId);

		const contactExists = me.contact.some(
			(c) => String(c.user) === String(req.body.user)
		);
		if (!contactExists) {
			return res.status(404).json({
				success: false,
				message: "Contact not found",
			});
		}
		const updatedUser = await User.findByIdAndUpdate(
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
		return res.status(200).json({
			success: true,
			message: "Contact alias updated",
		});
	} catch (err) {
		console.error("Update contact alias error:", err);
		res.status(500).json({ success: false });
	}
});

// Delete contact
router.delete("/delete", authmiddleware, async (req, res) => {
	try {
		const { user } = req.body; // ID of the contact to delete
		const myUserId = req.user.id;
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "Contact user ID required",
			});
		}
		const me = await User.findById(myUserId);
		const contactExists = me.contact.some(
			(c) => String(c.user) === String(user)
		);
		if (!contactExists) {
			return res.status(404).json({
				success: false,
				message: "Contact not found",
			});
		}

		const updatedUser = await User.findByIdAndUpdate(myUserId, {
			$pull: {
				contact: { user: user },
			},
		});
		return res.status(200).json({
			success: true,
			message: "Contact deleted",
		});
	} catch (err) {
		console.error("Delete contact error:", err);
		res.status(500).json({ success: false });
	}
});

module.exports = router;
