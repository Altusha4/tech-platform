const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Content = require("../models/Content");
const Notification = require("../models/Notification");

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Comments management
 */

/**
 * @swagger
 * /comments/{postId}:
 *   get:
 *     summary: Get comments for a post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 *       500:
 *         description: Server error
 */
router.get("/:postId", async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId })
            .populate('authorId', 'username avatarUrl')
            .sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /comments:
 *   post:
 *     summary: Add comment to a post
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - userId
 *               - text
 *             properties:
 *               postId:
 *                 type: string
 *               userId:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment created
 *       400:
 *         description: Invalid input
 */
router.post("/", async (req, res) => {
    try {
        const { postId, userId, text } = req.body;

        if (!userId || !text) {
            return res.status(400).json({ error: "Insufficient data for comment" });
        }

        const newComment = new Comment({
            postId,
            authorId: userId,
            text: text.trim()
        });

        const savedComment = await newComment.save();

        const post = await Content.findByIdAndUpdate(postId, {
            $inc: { 'stats.commentsCount': 1 }
        });

        if (post && post.authorId.toString() !== userId) {
            await Notification.create({
                recipient: post.authorId,
                sender: userId,
                type: 'comment',
                postId: postId
            });
        }

        res.status(201).json(savedComment);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /comments/{id}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *       404:
 *         description: Comment not found
 */
router.delete("/:id", async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        await Content.findByIdAndUpdate(comment.postId, {
            $inc: { 'stats.commentsCount': -1 }
        });

        await Comment.findByIdAndDelete(req.params.id);
        res.json({ message: "Comment deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;