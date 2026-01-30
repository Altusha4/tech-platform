const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Content = require("../models/Content");
const Notification = require("../models/Notification");

// --- 1. ПОЛУЧЕНИЕ КОММЕНТАРИЕВ К ПОСТУ ---
router.get("/:postId", async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId })
            .populate('authorId', 'username avatarUrl')
            .sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. ДОБАВЛЕНИЕ КОММЕНТАРИЯ + УВЕДОМЛЕНИЕ ---
router.post("/", async (req, res) => {
    try {
        const { postId, userId, text } = req.body;

        if (!userId || !text) {
            return res.status(400).json({ error: "Недостаточно данных для комментария" });
        }

        const newComment = new Comment({
            postId,
            authorId: userId,
            text: text.trim()
        });

        const savedComment = await newComment.save();

        // 1. Обновляем счетчик комментариев в самом посте
        const post = await Content.findByIdAndUpdate(postId, {
            $inc: { 'stats.commentsCount': 1 }
        });

        // 2. СОЗДАЕМ УВЕДОМЛЕНИЕ АВТОРУ ПОСТА (если это не сам автор пишет себе)
        if (post && post.authorId.toString() !== userId) {
            await Notification.create({
                recipient: post.authorId, // Владелец поста
                sender: userId,          // Кто написал коммент
                type: 'comment',
                postId: postId
            });
        }

        res.status(201).json(savedComment);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- 3. УДАЛЕНИЕ КОММЕНТАРИЯ ---
router.delete("/:id", async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: "Комментарий не найден" });

        // Уменьшаем счетчик в посте
        await Content.findByIdAndUpdate(comment.postId, {
            $inc: { 'stats.commentsCount': -1 }
        });

        await Comment.findByIdAndDelete(req.params.id);
        res.json({ message: "Комментарий удален" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;