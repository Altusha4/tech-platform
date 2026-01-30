const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// --- РЕГИСТРАЦИЯ ---
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, interests, avatarUrl } = req.body;

        // 1. Проверка на существующего пользователя
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: "Пользователь с таким email уже существует" });
        }

        // 2. Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Создание нового пользователя
        const newUser = new User({
            username,
            email: email.toLowerCase(),
            passwordHash: hashedPassword,
            interests: interests || [],
            // Если фронтенд не прислал аватар, ставим стандартный DiceBear
            avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/big-ears/svg?seed=${username}`,
            stats: {
                postsCount: 0,
                totalLikes: 0,
                totalViews: 0
            }
        });

        await newUser.save();
        res.status(201).json({ message: "Регистрация прошла успешно!" });
    } catch (err) {
        console.error("Ошибка регистрации:", err);
        res.status(500).json({ error: "Ошибка сервера при создании аккаунта" });
    }
});

// --- ЛОГИН ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Поиск пользователя (приводим email к нижнему регистру)
        const user = await User.findOne({ email: email.toLowerCase() });

        if (user && await bcrypt.compare(password, user.passwordHash)) {

            // 2. Создание токена (добавляем срок жизни 24 часа)
            const token = jwt.sign(
                { id: user._id, role: user.role },
                process.env.JWT_SECRET || 'SECRET_KEY',
                { expiresIn: '24h' }
            );

            // 3. Отправка ответа (возвращаем всё, что нужно для localStorage)
            res.json({
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    interests: user.interests,
                    avatarUrl: user.avatarUrl,
                    stats: user.stats
                }
            });
        } else {
            res.status(401).json({ error: "Неверный email или пароль" });
        }
    } catch (err) {
        console.error("Ошибка входа:", err);
        res.status(500).json({ error: "Ошибка сервера при входе" });
    }
});

module.exports = router;