const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
    followerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    followingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});

// Экспортируем модель. Обрати внимание: импорт User внутри схемы
// через ref: 'User' сработает автоматически, если модель User зарегистрирована.
module.exports = mongoose.model('Follow', followSchema, 'follows');