const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Кто получает
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },    // Кто нажал
    type: { type: String, enum: ['like', 'comment'], required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);