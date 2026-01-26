const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['video', 'post'],
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
    url: {
        type: String
    },
    likes: {
        type: Number,
        default: 0
    },
    // МАССИВ ДЛЯ УМНЫХ ЛАЙКОВ:
    // Здесь мы храним ID пользователей, чтобы один человек не мог лайкнуть дважды
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Экспортируем модель. Третий аргумент 'content' — это имя коллекции в Atlas
module.exports = mongoose.model('Content', contentSchema, 'content');