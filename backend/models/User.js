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
        lowercase: true
    }],
    avatarUrl: {
        type: String,
        default: 'https://api.dicebear.com/7.x/big-ears/svg?seed=Lucky'
    },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],

    stats: {
        postsCount: { type: Number, default: 0 },
        totalLikes: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    collection: 'users'
});

userSchema.index({ username: 'text', email: 1 });

userSchema.index({ role: 1, createdAt: -1 });

userSchema.index({ interests: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);