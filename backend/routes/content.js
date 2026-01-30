const express = require("express");
const router = express.Router();
const Content = require("../models/Content");
const mongoose = require("mongoose");

// --- 1. ПОЛУЧЕНИЕ ЛЕНТЫ (С фильтрацией и авторами) ---
router.get("/", async (req, res) => {
    try {
        const { category, tag } = req.query;
        let query = {};

        // Фильтр по категории (кроме "All")
        if (category && category !== 'All') {
            query.category = category;
        }

        // Фильтр по тегу
        if (tag) {
            query.tags = tag.toLowerCase();
        }

        const posts = await Content.find(query)
            .populate('authorId', 'username avatarUrl') // Подтягиваем инфо об авторе
            .sort({ createdAt: -1 });

        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. ПОЛУЧЕНИЕ ОДНОГО ПОСТА ---
router.get("/single/:id", async (req, res) => {
    try {
        const post = await Content.findById(req.params.id)
            .populate('authorId', 'username avatarUrl stats');
        if (!post) return res.status(404).json({ error: "Пост не найден" });
        res.json(post);
    } catch (err) {
        res.status(404).json({ error: "Некорректный ID поста" });
    }
});

// --- 3. УМНЫЙ ЛАЙК (Без перезагрузки и дублей) ---
router.post("/:id/like", async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Content.findById(req.params.id);

        if (!post) return res.status(404).json({ error: "Пост не найден" });

        // Проверяем, лайкал ли уже пользователь
        const isLiked = post.likedBy.includes(userId);

        if (isLiked) {
            // Убираем лайк
            post.likes = Math.max(0, post.likes - 1);
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
        } else {
            // Ставим лайк
            post.likes += 1;
            post.likedBy.push(userId);
        }

        await post.save();
        res.json({ likes: post.likes, isLiked: !isLiked });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- 4. СОЗДАНИЕ ПОСТА (С привязкой к модели) ---
router.post("/", async (req, res) => {
    try {
        const { title, body, preview, tags, category, authorId, type, mediaUrl } = req.body;

        const newPost = new Content({
            title,
            body,
            preview,
            tags: tags || [],
            category: category || "Other",
            authorId,
            type: type || "post",
            mediaUrl: mediaUrl || null,
            stats: { views: 0, commentsCount: 0 }
        });

        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- 5. УДАЛЕНИЕ ПОСТА ---
router.delete("/:id", async (req, res) => {
    try {
        await Content.findByIdAndDelete(req.params.id);
        res.json({ message: "Публикация удалена" });
    } catch (err) {
        res.status(404).json({ error: "Пост не найден" });
    }
});

module.exports = router;