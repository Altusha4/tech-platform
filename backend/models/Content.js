const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        // Расширили список типов для поддержки изображений и обычного текста
        enum: ['video', 'post', 'article', 'image', 'text'],
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
    // Поле body для текста статьи или ссылки на YouTube
    body: {
        type: String
    },
    // Поле для хранения пути к загруженному файлу (картинке или видео)
    mediaUrl: {
        type: String,
        default: null
    },
    category: {
        type: String,
        default: 'Other'
    },
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
    // Статистика поста
    stats: {
        views: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Экспортируем модель. Третий аргумент 'content' — имя коллекции в MongoDB
module.exports = mongoose.model('Content', contentSchema, 'content');