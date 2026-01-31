const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Content = require("../models/Content");
const Notification = require("../models/Notification");

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