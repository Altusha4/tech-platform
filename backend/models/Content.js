const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
    text: String,
    author: String,
    createdAt: { type: Date, default: Date.now }
});

const ContentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: [String],
    category: String,
    createdAt: { type: Date, default: Date.now },
    comments: [CommentSchema],
    likes: { type: Number, default: 0 }
});

module.exports = mongoose.model("Content", ContentSchema);