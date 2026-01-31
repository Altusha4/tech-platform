const express = require("express");
const router = express.Router();
const Content = require("../models/Content");
const Notification = require("../models/Notification");

router.get("/", async (req, res) => {
    try {
        const { category, authorId } = req.query;
        let query = {};
        if (category && category !== 'All') query.category = category;
        if (authorId) query.authorId = authorId;

        const posts = await Content.find(query)
            .populate('authorId', 'username avatarUrl')
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { title, body, preview, tags, category, authorId, type, image } = req.body;

        if (!authorId || authorId === "undefined") {
            return res.status(400).json({ error: "Error: Author ID (authorId) is required." });
        }

        const parsedTags = Array.isArray(tags) ? tags : [];

        const newPost = new Content({
            title: title ? title.trim() : "Untitled",
            body: body ? body.trim() : "",
            preview: preview ? preview.trim() : "",
            tags: parsedTags,
            category: category || "Other",
            authorId: authorId,
            type: type || "post",
            mediaUrl: image || null,
            stats: { views: 0, commentsCount: 0 }
        });

        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) {
        console.error("JSON Save Error:", err);
        res.status(400).json({ error: err.message });
    }
});

router.post("/:id/like", async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Content.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Post not found" });

        const isLiked = post.likedBy.includes(userId);
        if (isLiked) {
            post.likes = Math.max(0, post.likes - 1);
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
        } else {
            post.likes += 1;
            post.likedBy.push(userId);
            if (post.authorId.toString() !== userId) {
                await Notification.create({
                    recipient: post.authorId,
                    sender: userId,
                    type: 'like',
                    postId: post._id
                });
            }
        }
        await post.save();
        res.json({ likes: post.likes, isLiked: !isLiked });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;