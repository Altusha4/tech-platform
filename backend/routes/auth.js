const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', async (req, res) => {
    try {
        const { username, email, password, interests, avatarUrl } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: "User with this email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const normalizedInterests = interests && Array.isArray(interests)
            ? interests.map(i => i.toLowerCase())
            : [];

        const newUser = new User({
            username,
            email: email.toLowerCase(),
            passwordHash: hashedPassword,
            interests: normalizedInterests,
            avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/big-ears/svg?seed=${username}`,
            stats: {
                postsCount: 0,
                totalLikes: 0,
                totalViews: 0
            }
        });

        await newUser.save();
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ error: "Internal server error during account creation" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (user && await bcrypt.compare(password, user.passwordHash)) {

            const token = jwt.sign(
                { id: user._id, role: user.role },
                process.env.JWT_SECRET || 'SECRET_KEY',
                { expiresIn: '24h' }
            );

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
            res.status(401).json({ error: "Invalid email or password" });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Internal server error during login" });
    }
});

module.exports = router;