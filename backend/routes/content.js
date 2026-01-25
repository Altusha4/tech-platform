const express = require("express");
const router = express.Router();
const Content = require("../models/Content");

router.get("/", async (req, res) => {
    try {
        const posts = await Content.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const post = await Content.findById(req.params.id);
        res.json(post);
    } catch (err) {
        res.status(404).json({ error: "Post not found" });
    }
});

router.post("/", async (req, res) => {
    try {
        const post = await Content.create({
            title: req.body.title,
            description: req.body.description,
            tags: req.body.tags || [],
            category: req.body.category || "general"
        });
        res.status(201).json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        await Content.findByIdAndDelete(req.params.id);
        res.json({ message: "Post deleted" });
    } catch (err) {
        res.status(404).json({ error: "Post not found" });
    }
});

router.post("/:id/comments", async (req, res) => {
    try {
        const post = await Content.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    comments: {
                        text: req.body.text,
                        author: req.body.author || "anonymous"
                    }
                }
            },
            { new: true }
        );
        res.json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/:id/like", async (req, res) => {
    try {
        const post = await Content.findByIdAndUpdate(
            req.params.id,
            { $inc: { likes: 1 } },
            { new: true }
        );
        res.json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
