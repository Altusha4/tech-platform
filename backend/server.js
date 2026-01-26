require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Добавили multer

const authRoutes = require('./routes/auth');
const User = require('./models/User');
const Content = require('./models/Content');
const Notification = require('./models/Notification');
const Follow = require('./models/Follow');

const app = express();
const publicPath = path.join(__dirname, '..', 'public');

// Настройка хранилища для аватарок
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(publicPath, 'uploads', 'avatars'));
    },
    filename: (req, file, cb) => {
        // Создаем уникальное имя файла: avatar-123456789.jpg
        cb(null, 'avatar-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use(express.static(publicPath));
// Делаем папку uploads доступной для браузера по ссылке /uploads
app.use('/uploads', express.static(path.join(publicPath, 'uploads')));

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// --- НОВЫЙ МАРШРУТ: ЗАГРУЗКА АВАТАРКИ ---
app.post('/api/users/upload-avatar', upload.single('avatar'), async (req, res) => {
    try {
        const { userId } = req.body;
        if (!req.file) return res.status(400).json({ error: "Файл не выбран" });

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        const user = await User.findByIdAndUpdate(
            userId,
            { avatarUrl: avatarUrl },
            { new: true }
        ).select('-passwordHash');

        res.json({ message: "Аватарка загружена!", user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/api/content', async (req, res) => {
    try {
        const { userId } = req.query;
        let posts = await Content.find().populate('authorId', 'username').lean();

        if (userId && userId !== 'undefined') {
            const user = await User.findById(userId);

            if (user && user.interests && user.interests.length > 0) {
                // Сначала фильтруем: создаем список постов, которые СОВПАДАЮТ
                const matchedPosts = posts.filter(post =>
                    post.tags.some(tag => user.interests.includes(tag))
                );

                // Затем список постов, которые НЕ СОВПАДАЮТ
                const otherPosts = posts.filter(post =>
                    !post.tags.some(tag => user.interests.includes(tag))
                );

                // Склеиваем их: подходящие вверху, остальные внизу
                posts = [...matchedPosts, ...otherPosts];

                // Если хочешь ВООБЩЕ скрыть неинтересные, просто закомментируй строку выше
                // posts = matchedPosts;
            }
        }
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение уведомлений
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notes = await Notification.find({ userId: req.params.userId })
            .populate('fromUserId', 'username')
            .sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Лайк поста
app.post('/api/content/:id/like', async (req, res) => {
    try {
        const contentId = req.params.id;
        const { userId } = req.body;

        const post = await Content.findById(contentId);
        if (!post) return res.status(404).json({ error: "Пост не найден" });

        const isLiked = post.likedBy.includes(userId);

        if (isLiked) {
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId.toString());
            post.likes = Math.max(0, post.likes - 1);
        } else {
            post.likedBy.push(userId);
            post.likes += 1;

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

// Обновление профиля (интересы)
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

// Получение свежих данных пользователя
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-passwordHash');
        if (!user) return res.status(404).json({ error: "Пользователь не найден" });
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