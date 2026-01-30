const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true // Убирает лишние пробелы по краям
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
        required: true
    },
    preview: {
        type: String,
        trim: true
    },
    // Основной контент статьи или URL видео
    body: {
        type: String,
        required: false
    },
    // Путь к файлу на сервере
    mediaUrl: {
        type: String,
        default: null
    },
    category: {
        type: String,
        enum: ['Programming', 'Gadgets', 'Design', 'Other'], // Фиксируем список для порядка
        default: 'Other'
    },
    tags: [{
        type: String,
        lowercase: true // Чтобы поиск по тегам не зависел от регистра
    }],
    likes: {
        type: Number,
        default: 0
    },
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Время на чтение в минутах (можно рассчитывать при сохранении)
    readTime: {
        type: Number,
        default: 1
    },
    stats: {
        views: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 }
    }
}, {
    timestamps: true, // Автоматически создает createdAt и updatedAt
    collection: 'content'
});

// Индексы для быстрого глобального поиска по сайту
contentSchema.index({ title: 'text', preview: 'text', tags: 'text' });

module.exports = mongoose.model('Content', contentSchema);