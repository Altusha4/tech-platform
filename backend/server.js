require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.get("/api/content", async (req, res) => {
    try {
        const Content = mongoose.connection.db.collection("content");
        const posts = await Content.find().toArray();
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: "Failed to load content" });
    }
});

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
        app.listen(PORT, () =>
            console.log(`Server running on http://localhost:${PORT}`)
        );
    })
    .catch(err => console.error(err));
