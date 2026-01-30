require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Импорт моделей
const authRoutes = require('./routes/auth');
const User = require('./models/User');
const Content = require('./models/Content');
const Notification = require('./models/Notification');
const Follow = require('./models/Follow');
const Comment = require('./models/Comment');

const app = express();
const publicPath = path.join(__dirname, '..', 'public');

// --- НАСТРОЙКА CORS И ПАРСЕРОВ ---
app.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'x-author-id']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- НАСТРОЙКА ХРАНИЛИЩА (Multer) ---
const storageConfigs = {
    avatars: path.join(publicPath, 'uploads', 'avatars'),
    images: path.join(publicPath, 'uploads', 'images'),
    videos: path.join(publicPath, 'uploads', 'videos')
};

// Создаем папки при запуске
Object.values(storageConfigs).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, storageConfigs.avatars),
    filename: (req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`)
});

const contentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = file.mimetype.startsWith('image/') ? 'images' : 'videos';
        cb(null, storageConfigs[type]);
    },
    filename: (req, file, cb) => cb(null, `content-${Date.now()}${path.extname(file.originalname)}`)
});

const uploadAvatar = multer({ storage: avatarStorage });
const uploadContent = multer({ storage: contentStorage });

// --- ПОРЯДОК: СНАЧАЛА API, ПОТОМ СТАТИКА ---
app.use('/api/auth', authRoutes);
app.use('/uploads', express.static(path.join(publicPath, 'uploads')));

// Вспомогательная функция для удаления файлов
const deleteLocalFile = (relativeUrl) => {
    if (!relativeUrl || relativeUrl.startsWith('data:')) return;
    const absolutePath = path.join(publicPath, relativeUrl);
    if (fs.existsSync(absolutePath)) {
        fs.unlink(absolutePath, (err) => {
            if (err) console.error("Ошибка при удалении файла:", err);
        });
    }
};

// --- 1. ПОЛЬЗОВАТЕЛИ (Профиль и Мини-профиль) ---

app.post('/api/users/upload-avatar', uploadAvatar.single('avatar'), async (req, res) => {
    try {
        const userId = req.headers['x-author-id'] || req.body.userId;
        if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
        const user = await User.findById(userId);
        if (user && user.avatarUrl) deleteLocalFile(user.avatarUrl);
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const updatedUser = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).select('-passwordHash');
        res.json({ message: "Аватарка обновлена!", user: updatedUser });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/update', async (req, res) => {
    try {
        const { userId, interests } = req.body;
        const updatedUser = await User.findByIdAndUpdate(userId, { interests }, { new: true }).select('-passwordHash');
        res.json({ message: "Профиль обновлен!", user: updatedUser });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/mini-profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('username avatarUrl interests');
        if (!user) return res.status(404).json({ error: "Пользователь не найден" });
        const [followersCount, postsCount] = await Promise.all([
            Follow.countDocuments({ following: userId }),
            Content.countDocuments({ authorId: userId })
        ]);
        res.json({ ...user._doc, followersCount, postsCount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. КОНТЕНТ (CRUD + РЕДАКТИРОВАНИЕ) ---

app.post('/api/content', uploadContent.single('mediaFile'), async (req, res) => {
    try {
        const authorId = req.headers['x-author-id'] || req.body.userId;
        const { title, preview, body, category, tags, type } = req.body;
        let mediaUrl = null;
        let finalType = type || 'post';
        if (req.file) {
            const folder = req.file.mimetype.startsWith('image/') ? 'images' : 'videos';
            mediaUrl = `/uploads/${folder}/${req.file.filename}`;
            finalType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        }
        const newPost = new Content({
            type: finalType, title: title?.trim() || "Без названия", preview, body, mediaUrl, category: category || 'Other',
            tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
            authorId, likes: 0, likedBy: [], stats: { views: 0, commentsCount: 0 }
        });
        res.status(201).json(await newPost.save());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/content/:id', async (req, res) => {
    try {
        const { title, body, preview, category, tags } = req.body;
        const updatedPost = await Content.findByIdAndUpdate(
            req.params.id,
            { title: title?.trim(), body, preview, category, tags: Array.isArray(tags) ? tags : JSON.parse(tags || "[]") },
            { new: true }
        );
        res.json(updatedPost);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/content/:id', async (req, res) => {
    try {
        const post = await Content.findById(req.params.id);
        if (post) {
            if (post.mediaUrl) deleteLocalFile(post.mediaUrl);
            await Promise.all([
                Content.findByIdAndDelete(req.params.id),
                Comment.deleteMany({ postId: req.params.id }),
                Notification.deleteMany({ contentId: req.params.id })
            ]);
        }
        res.json({ message: "Удалено" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. ЛЕНТЫ И ФИЛЬТРЫ ---

app.get('/api/content', async (req, res) => {
    try {
        const { userId, category, authorId } = req.query;
        let query = {};
        if (category && category !== 'All') query.category = category;
        if (authorId) query.authorId = authorId;

        let posts = await Content.find(query).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 }).lean();

        // Синхронизируем счетчик комментариев
        posts = await Promise.all(posts.map(async (post) => {
            const realCount = await Comment.countDocuments({ postId: post._id });
            return { ...post, stats: { ...post.stats, commentsCount: realCount } };
        }));

        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/content/single/:id', async (req, res) => {
    try {
        const post = await Content.findById(req.params.id).populate('authorId', 'username avatarUrl');
        res.json(post);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. ПОДПИСКИ ---

app.post('/api/follow', async (req, res) => {
    try {
        const { followerId, followingId } = req.body;
        if (followerId === followingId) return res.status(400).json({ error: "Нельзя подписаться на себя" });
        const existing = await Follow.findOne({ follower: followerId, following: followingId });
        if (existing) {
            await Follow.deleteOne({ _id: existing._id });
            res.json({ following: false });
        } else {
            await Follow.create({ follower: followerId, following: followingId });
            await Notification.create({ userId: followingId, fromUserId: followerId, type: 'follow', message: 'подписался(ась) на вас 👤' });
            res.json({ following: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. ЛАЙКИ И КОММЕНТАРИИ (С ПОДДЕРЖКОЙ УДАЛЕНИЯ) ---

app.post('/api/content/:id/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Content.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Пост не найден" });

        const isLiked = post.likedBy.map(id => id.toString()).includes(userId.toString());

        if (isLiked) {
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId.toString());
            post.likes = Math.max(0, post.likes - 1);
        } else {
            post.likedBy.push(userId);
            post.likes += 1;
            if (post.authorId.toString() !== userId.toString()) {
                await Notification.create({ userId: post.authorId, fromUserId: userId, type: 'like', message: `лайкнул(а) ваш пост`, contentId: post._id });
            }
        }
        await post.save();
        res.json({ success: true, likes: post.likes, isLiked: !isLiked });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/comments', async (req, res) => {
    try {
        const { postId, userId, text } = req.body;
        const newComment = await Comment.create({ postId, authorId: userId, text });
        await Content.findByIdAndUpdate(postId, { $inc: { 'stats.commentsCount': 1 } });

        if (post && post.authorId.toString() !== userId.toString()) {
            await Notification.create({ userId: post.authorId, fromUserId: userId, type: 'comment', message: `прокомментировал(а) ваш пост`, contentId: post._id });
        }

        const populated = await newComment.populate('authorId', 'username avatarUrl');
        res.status(201).json(populated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/comments/:postId', async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId }).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// УДАЛЕНИЕ КОММЕНТАРИЯ (ВАЖНО!)
app.delete('/api/comments/:id', async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: "Не найден" });

        await Content.findByIdAndUpdate(comment.postId, { $inc: { 'stats.commentsCount': -1 } });
        await Comment.findByIdAndDelete(req.params.id);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notes = await Notification.find({ userId: req.params.userId }).populate('fromUserId', 'username avatarUrl').sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// СТАТИКА В САМОМ НИЗУ
app.use(express.static(publicPath));

// --- ЗАПУСК СЕРВЕРА ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`📡 Server running at http://localhost:${PORT}`));
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));