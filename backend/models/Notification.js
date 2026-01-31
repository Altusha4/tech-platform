const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // Ссылка на того, кто получает уведомление (хозяин контента)
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Ссылка на того, кто совершил действие (лайкнул/подписался)
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Тип уведомления (добавлен 'follow', так как он есть в server.js)
    type: {
        type: String,
        enum: ['like', 'comment', 'follow'],
        required: true
    },
    // ID поста, к которому относится уведомление (необязательно для follow)
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content'
    },
    // Сообщение уведомления (для гибкости текста)
    message: {
        type: String
    },
    // Статус прочтения
    read: {
        type: Boolean,
        default: false
    },
    // Время создания
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'notifications'
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);