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

app.post('/api/content/:id/like', async (req, res) => {
    try {
        const contentId = req.params.id;
        const { userId } = req.body;

        const post = await Content.findById(contentId);
        if (!post) return res.status(404).json({ error: "Пост не найден" });

        // Проверяем наличие ID в массиве likedBy (в БД)
        const isLiked = post.likedBy.includes(userId);

        if (isLiked) {
            // Удаляем лайк из БД
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId.toString());
            post.likes = Math.max(0, post.likes - 1);
        } else {
            // Добавляем лайк в БД
            post.likedBy.push(userId);
            post.likes += 1;

            // Создаем уведомление в БД
            const newNotification = new Notification({
                userId: post.authorId,
                fromUserId: userId,
                type: 'like',
                message: `поставил(а) лайк вашему посту: "${post.title}"`,
                contentId: post._id
            });
            await newNotification.save();
        }

        await post.save();
        res.json({ success: true, likes: post.likes, isLiked: !isLiked });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновление профиля пользователя
app.put('/api/users/update', async (req, res) => {
    try {
        const { userId, interests } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { interests: interests },
            { new: true }
        ).select('-passwordHash');

        if (!updatedUser) return res.status(404).json({ error: "Пользователь не найден" });

        res.json({ message: "Профиль обновлен!", user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение свежих данных пользователя из БД по его ID
app.get('/api/users/:id', async (req, res) => {
    try {
        // Ищем пользователя и исключаем пароль из результата
        const user = await User.findById(req.params.id).select('-passwordHash');

        if (!user) {
            return res.status(404).json({ error: "Пользователь не найден" });
        }

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected & Auth Routes Ready");
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
    })
    .catch(err => console.error("Connection error:", err));