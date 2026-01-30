const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Content = require('../models/Content');

// --- 1. ПОЛУЧЕНИЕ КОММЕНТАРИЕВ ДЛЯ ПОСТА ---
router.get('/:postId', async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId })
            .populate('authorId', 'username avatarUrl') // Чтобы видеть, кто написал
            .sort({ createdAt: -1 }); // Сначала новые
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. ДОБАВЛЕНИЕ КОММЕНТАРИЯ ---
router.post('/', async (req, res) => {
    try {
        const { postId, userId, text } = req.body;

        const newComment = new Comment({
            postId,
            authorId: userId,
            text
        });

        const savedComment = await newComment.save();

        // Увеличиваем счетчик комментариев в основной коллекции контента
        await Content.findByIdAndUpdate(postId, {
            $inc: { 'stats.commentsCount': 1 }
        });

        // Возвращаем сохраненный коммент с подтянутыми данными автора для фронтенда
        const populatedComment = await savedComment.populate('authorId', 'username avatarUrl');
        res.status(201).json(populatedComment);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- 3. УДАЛЕНИЕ КОММЕНТАРИЯ ---
router.delete('/:id', async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: "Комментарий не найден" });

        const postId = comment.postId;
        await Comment.findByIdAndDelete(req.params.id);

        // Уменьшаем счетчик в посте
        await Content.findByIdAndUpdate(postId, {
            $inc: { 'stats.commentsCount': -1 }
        });

        res.json({ message: "Комментарий удален" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;