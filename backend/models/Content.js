const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['video', 'post', 'article'], // Добавили article на всякий случай
        required: true
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    preview: {
        type: String
    },
    // Добавляем поле body (в нем будет храниться ссылка или текст)
    body: {
        type: String
    },
    // Добавляем поле category (теперь оно будет сохраняться!)
    category: {
        type: String,
        default: 'Other'
    },
    // Добавляем массив тегов для умной ленты
    tags: [{
        type: String
    }],
    likes: {
        type: Number,
        default: 0
    },
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Content', contentSchema, 'content');