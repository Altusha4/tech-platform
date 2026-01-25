const express = require("express");
const router = express.Router();
const Content = require("../models/Content");

router.get("/", async (req, res) => {
    try {
        const posts = await Content.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch content" });
    }
});

router.post("/", async (req, res) => {
    try {
        const post = new Content(req.body);
        await post.save();
        res.status(201).json(post);
    } catch (error) {
        res.status(400).json({ message: "Failed to create post" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        await Content.findByIdAndDelete(req.params.id);
        res.json({ message: "Post deleted" });
    } catch (error) {
        res.status(404).json({ message: "Post not found" });
    }
});

module.exports = router;
