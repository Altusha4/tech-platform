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
    // Добавлено для корректной работы роута закладок в server.js
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

// --- ИНДЕКСАЦИЯ И ОПТИМИЗАЦИЯ (ТРЕБОВАНИЕ ПРОЕКТА) ---

// 1. Глобальный текстовый индекс для поиска по ключевым словам
contentSchema.index({ title: 'text', preview: 'text', tags: 'text' });

// 2. Compound Index (Составной индекс) для фильтрации ленты по категориям и дате.
// Ускоряет запросы типа: "Дай мне все посты из Programming, сначала новые"
contentSchema.index({ category: 1, createdAt: -1 });

// 3. Compound Index для связки автора и даты (ускоряет страницу "Мои посты")
contentSchema.index({ authorId: 1, createdAt: -1 });

module.exports = mongoose.model('Content', contentSchema);