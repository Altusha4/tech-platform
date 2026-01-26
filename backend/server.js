require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const User = require('./models/User');
const Content = require('./models/Content');
const Notification = require('./models/Notification');
const Follow = require('./models/Follow');

const app = express();
const publicPath = path.join(__dirname, '..', 'public');

// Настройка хранилища для аватарок
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(publicPath, 'uploads', 'avatars')),
    filename: (req, file, cb) => cb(null, 'avatar-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(express.static(publicPath));
app.use('/uploads', express.static(path.join(publicPath, 'uploads')));
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// --- 1. ЗАГРУЗКА АВАТАРКИ ---
app.post('/api/users/upload-avatar', upload.single('avatar'), async (req, res) => {
    try {
        const { userId } = req.body;
        if (!req.file) return res.status(400).json({ error: "Файл не выбран" });

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).select('-passwordHash');
        res.json({ message: "Аватарка загружена!", user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. СОЗДАНИЕ ПОСТА ---
app.post('/api/content', async (req, res) => {
    try {
        const { title, preview, body, category, tags, userId, type } = req.body;
        const newPost = new Content({
            type: type || 'video', // Соответствуем твоей коллекции
            title,
            preview,
            body,
            category: category || 'Other',
            tags: tags || [],
            authorId: userId,
            likes: 0,
            likedBy: [],
            stats: { views: 0, commentsCount: 0 }
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. ПОЛУЧЕНИЕ ЛЕНТЫ (С КАТЕГОРИЯМИ И УМНОЙ СОРТИРОВКОЙ) ---
app.get('/api/content', async (req, res) => {
    try {
        const { userId, category } = req.query;
        let query = {};

        // Фильтр по категории, если она выбрана и это не "All"
        if (category && category !== 'All') {
            query.category = category;
        }

        // Базовый поиск всех постов по фильтру + сортировка по новизне
        let posts = await Content.find(query)
            .populate('authorId', 'username')
            .sort({ createdAt: -1 })
            .lean();

        // Умная сортировка по интересам пользователя
        if (userId && userId !== 'undefined') {
            const user = await User.findById(userId);
            if (user && user.interests && user.interests.length > 0) {
                const matchedPosts = posts.filter(post =>
                    post.tags.some(tag => user.interests.includes(tag))
                );
                const otherPosts = posts.filter(post =>
                    !post.tags.some(tag => user.interests.includes(tag))
                );
                posts = [...matchedPosts, ...otherPosts];
            }
        }
        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. ЛАЙК ПОСТА ---
app.post('/api/content/:id/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Content.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Пост не найден" });

        const isLiked = post.likedBy.includes(userId);
        if (isLiked) {
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId.toString());
            post.likes = Math.max(0, post.likes - 1);
        } else {
            post.likedBy.push(userId);
            post.likes += 1;
            // Уведомление автору (если это не лайк самому себе)
            if (post.authorId.toString() !== userId.toString()) {
                await new Notification({
                    userId: post.authorId,
                    fromUserId: userId,
                    type: 'like',
                    message: `поставил(а) лайк вашему посту: "${post.title}"`,
                    contentId: post._id
                }).save();
            }
        }
        await post.save();
        res.json({ success: true, likes: post.likes, isLiked: !isLiked });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. УВЕДОМЛЕНИЯ ---
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notes = await Notification.find({ userId: req.params.userId })
            .populate('fromUserId', 'username')
            .sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 6. ПРОФИЛЬ И ЮЗЕРЫ ---
app.put('/api/users/update', async (req, res) => {
    try {
        const { userId, interests } = req.body;
        const updatedUser = await User.findByIdAndUpdate(userId, { interests }, { new: true }).select('-passwordHash');
        res.json({ message: "Профиль обновлен!", user: updatedUser });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-passwordHash');
        if (!user) return res.status(404).json({ error: "Пользователь не найден" });
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ЗАПУСК ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected Successfully");
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch(err => console.error("MongoDB Connection Error:", err));