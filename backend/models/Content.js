const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    type: { type: String, enum: ['post', 'video'], required: true },
    title: { type: String, required: true },
    preview: { type: String },
    body: { type: String },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String },
    tags: [{ type: String }],
    likes: { type: Number, default: 0 },
    stats: {
        views: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 }
    },
    comments: [{
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        text: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Content', contentSchema, 'content');