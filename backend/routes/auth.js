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
            interests: interests || []
        });

        await newUser.save();
        res.status(201).json({ message: "User created!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Логин
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user._id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;