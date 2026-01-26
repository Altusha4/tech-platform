require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth'); // Роуты для login/register
const User = require('./models/User');
const Content = require('./models/Content');
const Notification = require('./models/Notification');
const Follow = require('./models/Follow');

const app = express();
const publicPath = path.join(__dirname, '..', 'public');

app.use(express.static(publicPath));
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/api/content', async (req, res) => {
    try {
        const posts = await Content.find().populate('authorId', 'username').sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notes = await Notification.find({ userId: req.params.userId })
            .populate('fromUserId', 'username')
            .sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected & Auth Routes Ready");
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
    })
    .catch(err => console.error("Connection error:", err));