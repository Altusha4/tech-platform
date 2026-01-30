const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Имя пользователя обязательно'],
        trim: true,
        minlength: [3, 'Имя должно быть не короче 3 символов']
    },
    email: {
        type: String,
        required: [true, 'Email обязателен'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Пожалуйста, введите корректный email']
    },
    passwordHash: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    interests: [{
        type: String,
        lowercase: true // Чтобы "AI" и "ai" были одним тегом
    }],
    avatarUrl: {
        type: String,
        default: 'https://api.dicebear.com/7.x/big-ears/svg?seed=Lucky'
    },
    // Социальные связи
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Сохраненные посты (Закладки)
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],

    stats: {
        postsCount: { type: Number, default: 0 },
        totalLikes: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 }
    }
}, {
    timestamps: true, // Автоматически создает createdAt и updatedAt
    collection: 'users'
});

// Индексы для быстрого поиска
userSchema.index({ username: 'text', email: 1 });

module.exports = mongoose.model('User', userSchema);