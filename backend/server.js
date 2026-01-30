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

// Проверка и создание папок
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

// --- СТАТИКА И API АВТОРИЗАЦИИ ---
app.use('/api/auth', authRoutes);
app.use('/uploads', express.static(path.join(publicPath, 'uploads')));

const deleteLocalFile = (relativeUrl) => {
    if (!relativeUrl || relativeUrl.startsWith('data:')) return;
    const absolutePath = path.join(publicPath, relativeUrl);
    if (fs.existsSync(absolutePath)) {
        fs.unlink(absolutePath, (err) => {
            if (err) console.error("Ошибка удаления файла:", err);
        });
    }
};

// --- 1. ПОЛЬЗОВАТЕЛИ ---

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
        if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid ID" });
        const user = await User.findById(userId).select('username avatarUrl interests');
        if (!user) return res.status(404).json({ error: "User not found" });
        const [followers, posts] = await Promise.all([
            Follow.countDocuments({ following: userId }),
            Content.countDocuments({ authorId: userId })
        ]);
        res.json({
            username: user.username,
            avatarUrl: user.avatarUrl,
            interests: user.interests,
            followersCount: followers,
            postsCount: posts
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. КОНТЕНТ (CRUD) ---

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
            type: finalType, title: title?.trim() || "Без названия", preview, body, mediaUrl,
            category: category || 'Other',
            tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
            authorId, likes: 0, likedBy: [], stats: { views: 0, commentsCount: 0 }
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/content/single/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Неверный формат ID" });

        const post = await Content.findById(id).populate('authorId', 'username avatarUrl');
        if (!post) return res.status(404).json({ error: "Публикация не найдена" });

        res.json(post);
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

// --- 3. ЛЕНТЫ ---

const populateStats = async (posts) => {
    return await Promise.all(posts.map(async (p) => {
        const count = await Comment.countDocuments({ postId: p._id });
        return { ...p, stats: { ...p.stats, commentsCount: count } };
    }));
};

app.get('/api/content', async (req, res) => {
    try {
        const { category, authorId } = req.query;
        let query = {};
        if (authorId) query.authorId = authorId;
        if (category && category !== 'All') query.category = category;

        let posts = await Content.find(query).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 }).lean();
        res.json(await populateStats(posts));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/content/following/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const followingData = await Follow.find({ follower: userId });
        const followingIds = followingData.map(f => f.following);
        if (!followingIds.length) return res.json([]);
        let posts = await Content.find({ authorId: { $in: followingIds } }).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 }).lean();
        res.json(await populateStats(posts));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/content/my-posts/:userId', async (req, res) => {
    try {
        let posts = await Content.find({ authorId: req.params.userId }).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 }).lean();
        res.json(await populateStats(posts));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/content/liked/:userId', async (req, res) => {
    try {
        let posts = await Content.find({ likedBy: req.params.userId }).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 }).lean();
        res.json(await populateStats(posts));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/content/bookmarks/:userId', async (req, res) => {
    try {
        let posts = await Content.find({ bookmarkedBy: req.params.userId }).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 }).lean();
        res.json(await populateStats(posts));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. ПОДПИСКИ ---

app.post('/api/follow', async (req, res) => {
    try {
        const { followerId, followingId } = req.body;
        if (followerId === followingId) return res.status(400).json({ error: "Self-follow not allowed" });
        const existing = await Follow.findOne({ follower: followerId, following: followingId });
        if (existing) {
            await Follow.deleteOne({ _id: existing._id });
            res.json({ following: false });
        } else {
            await Follow.create({ follower: followerId, following: followingId });
            // ИСПРАВЛЕНО: recipient и sender
            await Notification.create({
                recipient: followingId,
                sender: followerId,
                type: 'follow',
                message: 'подписался(ась) на вас 👤'
            });
            res.json({ following: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/follow/status', async (req, res) => {
    try {
        const exists = await Follow.findOne({ follower: req.query.followerId, following: req.query.followingId });
        res.json({ following: !!exists });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. ЛАЙКИ И КОММЕНТАРИИ ---

app.post('/api/content/:id/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Content.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Post not found" });
        const isLiked = post.likedBy.map(id => id.toString()).includes(userId.toString());
        if (isLiked) {
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId.toString());
            post.likes = Math.max(0, post.likes - 1);
        } else {
            post.likedBy.push(userId);
            post.likes += 1;
            if (post.authorId.toString() !== userId.toString()) {
                // ИСПРАВЛЕНО: recipient и sender
                await Notification.create({
                    recipient: post.authorId,
                    sender: userId,
                    type: 'like',
                    message: `лайкнул(а) ваш пост`,
                    contentId: post._id
                });
            }
        }
        await post.save();
        res.json({ success: true, likes: post.likes, isLiked: !isLiked });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/comments', async (req, res) => {
    try {
        const { postId, userId, text } = req.body;

        if (!postId || !userId || !text) {
            return res.status(400).json({ error: "Не все поля заполнены" });
        }

        const comment = await Comment.create({ postId, authorId: userId, text });
        const post = await Content.findByIdAndUpdate(postId, { $inc: { 'stats.commentsCount': 1 } });

        if (post && post.authorId.toString() !== userId.toString()) {
            // ИСПРАВЛЕНО: recipient и sender
            await Notification.create({
                recipient: post.authorId,
                sender: userId,
                type: 'comment',
                message: `прокомментировал(а) ваш пост`,
                contentId: post._id
            });
        }

        const populated = await comment.populate('authorId', 'username avatarUrl');
        res.status(201).json(populated);
    } catch (err) {
        console.error("Ошибка при создании комментария:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/comments/:id', async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        await Content.findByIdAndUpdate(comment.postId, { $inc: { 'stats.commentsCount': -1 } });
        await Comment.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/comments/:postId', async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId }).populate('authorId', 'username avatarUrl').sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        // ИСПРАВЛЕНО: поиск по recipient и заселение sender
        const notes = await Notification.find({ recipient: req.params.userId })
            .populate('sender', 'username avatarUrl')
            .sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(publicPath));

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(3000, () => console.log(`📡 Server running at http://localhost:3000`));
    })
    .catch(err => console.error("Database error:", err));