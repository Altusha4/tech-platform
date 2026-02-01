const express = require("express");
const router = express.Router();
const User = require("../models/User");

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management
 */

/**
 * @swagger
 * /users/{id}/interests:
 *   patch:
 *     summary: Update user interests
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Interests updated
 */
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