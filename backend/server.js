require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const User = require('./models/User');
const Content = require('./models/Content');
const Notification = require('./models/Notification');
const Follow = require('./models/Follow');
const Comment = require('./models/Comment');

const app = express();
const publicPath = path.join(__dirname, '..', 'public');

// --- НАСТРОЙКА ХРАНИЛИЩА ---

// 1. Для аватарок
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(publicPath, 'uploads', 'avatars')),
    filename: (req, file, cb) => cb(null, 'avatar-' + Date.now() + path.extname(file.originalname))
});
const uploadAvatar = multer({ storage: avatarStorage });

// 2. Для контента (картинки и видео)
const contentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = file.mimetype.startsWith('image/') ? 'images' : 'videos';
        const uploadDir = path.join(publicPath, 'uploads', type);

        // Создаем папку, если её нет
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'content-' + Date.now() + path.extname(file.originalname));
    }
});
const uploadContent = multer({ storage: contentStorage });

app.use(express.static(publicPath));
app.use('/uploads', express.static(path.join(publicPath, 'uploads')));
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// --- 1. ЗАГРУЗКА АВАТАРКИ ---
app.post('/api/users/upload-avatar', uploadAvatar.single('avatar'), async (req, res) => {
    try {
        const { userId } = req.body;
        if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).select('-passwordHash');
        res.json({ message: "Аватарка загружена!", user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. СОЗДАНИЕ ПОСТА ---
app.post('/api/content', uploadContent.single('mediaFile'), async (req, res) => {
    try {
        const { title, preview, body, category, tags, userId, type } = req.body;
        let mediaUrl = null;
        let finalType = type || 'post';

        if (req.file) {
            const folder = req.file.mimetype.startsWith('image/') ? 'images' : 'videos';
            mediaUrl = `/uploads/${folder}/${req.file.filename}`;
            finalType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        }

        const newPost = new Content({
            type: finalType,
            title,
            preview,
            body,
            mediaUrl,
            category: category || 'Other',
            tags: tags ? tags.split(',') : [],
            authorId: userId,
            likes: 0,
            likedBy: [],
            stats: { views: 0, commentsCount: 0 }
        });

        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. ПОЛУЧЕНИЕ ЛЕНТЫ (С РЕКОМЕНДАЦИЯМИ) ---
app.get('/api/content', async (req, res) => {
    try {
        const { userId, category } = req.query;
        let query = {};
        if (category && category !== 'All') query.category = category;

        let posts = await Content.find(query).populate('authorId', 'username').sort({ createdAt: -1 }).lean();

        if (userId && userId !== 'undefined') {
            const user = await User.findById(userId);
            if (user && user.interests?.length > 0) {
                const matched = posts.filter(p => p.tags.some(t => user.interests.includes(t)));
                const others = posts.filter(p => !p.tags.some(t => user.interests.includes(t)));
                posts = [...matched, ...others];
            }
        }
        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. ПОЛУЧЕНИЕ ПОСТОВ ДЛЯ ПРОФИЛЯ ---

// Посты конкретного автора (Мои публикации)
app.get('/api/content/user/:userId', async (req, res) => {
    try {
        const posts = await Content.find({ authorId: req.params.userId }).sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Посты, которые юзер лайкнул (Понравилось)
app.get('/api/content/liked/:userId', async (req, res) => {
    try {
        const posts = await Content.find({ likedBy: req.params.userId })
            .populate('authorId', 'username')
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. ЛАЙК ПОСТА ---
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

// --- 6. УДАЛЕНИЕ И ОБНОВЛЕНИЕ ---
app.delete('/api/content/:id', async (req, res) => {
    try {
        await Content.findByIdAndDelete(req.params.id);
        res.json({ message: "Удалено" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notes = await Notification.find({ userId: req.params.userId }).populate('fromUserId', 'username').sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 7. КОММЕНТАРИИ ---

// Получить комментарии к посту
app.get('/api/comments/:postId', async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId })
            .populate('authorId', 'username avatarUrl')
            .sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Добавить комментарий
app.post('/api/comments', async (req, res) => {
    try {
        const { postId, userId, text } = req.body;

        const newComment = new Comment({
            postId,
            authorId: userId,
            text
        });

        await newComment.save();

        // Обновляем счетчик комментариев в самом посте
        await Content.findByIdAndUpdate(postId, { $inc: { 'stats.commentsCount': 1 } });

        const populatedComment = await newComment.populate('authorId', 'username avatarUrl');
        res.status(201).json(populatedComment);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected Successfully");
        app.listen(process.env.PORT || 3000, () => console.log(`Server: http://localhost:3000`));
    })
    .catch(err => console.error(err));