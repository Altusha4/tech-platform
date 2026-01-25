require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = 3000;

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static
app.use(express.static(path.join(__dirname, "../public")));

// test route
app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

// content route
app.get("/api/content", async (req, res) => {
    try {
        const Content = mongoose.connection.db.collection("content");
        const posts = await Content.find().toArray();
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: "Failed to load content" });
    }
});

// DB connect
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
        app.listen(PORT, () =>
            console.log(`Server running on http://localhost:${PORT}`)
        );
    })
    .catch(err => console.error(err));

// create new post
app.post("/api/content", async (req, res) => {
    try {
        const Content = mongoose.connection.db.collection("content");

        const newPost = {
            title: req.body.title,
            description: req.body.description,
            tags: req.body.tags || [],
            category: req.body.category || "general",
            createdAt: new Date(),
            likes: 0,
            comments: []
        };

        const result = await Content.insertOne(newPost);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed to create post" });
    }
});

// like post
app.post("/api/content/:id/like", async (req, res) => {
    try {
        const Content = mongoose.connection.db.collection("content");
        const { ObjectId } = require("mongodb");

        await Content.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $inc: { likes: 1 } }
        );

        res.json({ message: "Liked" });
    } catch (err) {
        res.status(400).json({ error: "Failed to like post" });
    }
});

app.post("/api/content", async (req, res) => {
    try {
        const Content = mongoose.connection.db.collection("content");
        const { title, description } = req.body;

        const newPost = {
            title,
            description,
            createdAt: new Date(),
            likes: 0
        };

        await Content.insertOne(newPost);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to create post" });
    }
});