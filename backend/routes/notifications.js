const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

router.get('/:userId', async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.params.userId })
            .populate('sender', 'username avatarUrl')
            .populate('postId', 'title')
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/read-all/:userId', async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.params.userId },
            { read: true }
        );
        res.json({ message: "Notifications updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;