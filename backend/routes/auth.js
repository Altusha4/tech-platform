const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Регистрация
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, interests } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            passwordHash: hashedPassword,
            interests: interests || [],
            stats: { postsCount: 0, totalLikes: 0, totalViews: 0 }
        });

        await newUser.save();
        res.status(201).json({ message: "Пользователь создан!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Логин
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && await bcrypt.compare(password, user.passwordHash)) {
        const token = jwt.sign({ id: user._id }, 'SECRET_KEY');

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                interests: user.interests
            }
        });
    } else {
        res.status(401).json({ error: "Неверный логин или пароль" });
    }
});

module.exports = router;