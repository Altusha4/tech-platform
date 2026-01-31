const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.patch("/:id/interests", async (req, res) => {
    try {
        const { interests } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { interests: interests },
            {
                new: true,
                runValidators: true
            }
        );
        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ success: true, user: updatedUser });
    } catch (err) {
        console.error("Update Interests Error:", err);
        res.status(400).json({ error: "Failed to save user interests" });
    }
});
module.exports = router;