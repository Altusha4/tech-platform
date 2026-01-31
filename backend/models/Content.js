const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Заголовок обязателен'],
        trim: true
    },
    type: {
        type: String,
        enum: ['video', 'post', 'article', 'image', 'text'],
        required: true,
        default: 'post'
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'ID автора обязателен'],
        index: true
    },
    preview: {
        type: String,
        trim: true,
        maxlength: 300
    },
    body: {
        type: String,
        required: false
    },
    mediaUrl: {
        type: String,
        default: null
    },
    category: {
        type: String,
        enum: ['Programming', 'Gadgets', 'Design', 'Other'],
        default: 'Other',
        index: true
    },
    tags: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    likes: {
        type: Number,
        default: 0
    },
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    bookmarkedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    readTime: {
        type: Number,
        default: 1
    },
    stats: {
        views: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    collection: 'content'
});

contentSchema.index({ title: 'text', preview: 'text', tags: 'text' });

contentSchema.index({ category: 1, createdAt: -1 });

contentSchema.index({ authorId: 1, createdAt: -1 });

module.exports = mongoose.model('Content', contentSchema);