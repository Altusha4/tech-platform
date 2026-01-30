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

// --- НАСТРОЙКА ЛИМИТОВ И ПАРСЕРОВ ---
// Увеличиваем лимиты, чтобы принимать Base64 и тяжелые JSON объекты
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// --- НАСТРОЙКА ХРАНИЛИЩА ---
const storageConfigs = {
    avatars: path.join(publicPath, 'uploads', 'avatars'),
    images: path.join(publicPath, 'uploads', 'images'),
    videos: path.join(publicPath, 'uploads', 'videos')
};

// Создаем папки, если их нет
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

app.use(express.static(publicPath));
app.use('/uploads', express.static(path.join(publicPath, 'uploads')));

app.use('/api/auth', authRoutes);

// --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ УДАЛЕНИЯ ФАЙЛОВ ---
const deleteLocalFile = (relativeUrl) => {
    if (!relativeUrl || relativeUrl.startsWith('data:')) return; // Не удаляем Base64
    const absolutePath = path.join(publicPath, relativeUrl);
    if (fs.existsSync(absolutePath)) {
        fs.unlink(absolutePath, (err) => {
            if (err) console.error("Ошибка при удалении файла:", err);
        });
    }
};

// --- 1. ЗАГРУЗКА АВАТАРКИ ---
app.post('/api/users/upload-avatar', uploadAvatar.single('avatar'), async (req, res) => {
    try {
        // Берем userId либо из заголовка, либо из тела
        const userId = req.headers['x-author-id'] || req.body.userId;
        if (!req.file) return res.status(400).json({ error: "Файл не загружен" });

        const user = await User.findById(userId);
        if (user && user.avatarUrl) deleteLocalFile(user.avatarUrl);

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const updatedUser = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).select('-passwordHash');
        res.json({ message: "Аватарка обновлена!", user: updatedUser });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. КОНТЕНТ (CRUD) ---
// ИСПОЛЬЗУЕМ HEADERS ДЛЯ authorId
app.post('/api/content', uploadContent.single('mediaFile'), async (req, res) => {
    try {
        // ЧИТАЕМ ID АВТОРА ИЗ ЗАГОЛОВКА
        const authorId = req.headers['x-author-id'] || req.body.userId;

        if (!authorId || authorId === 'undefined') {
            return res.status(400).json({ error: "authorId обязателен (не найден в заголовках x-author-id)" });
        }

        const { title, preview, body, category, tags, type, imageBase64 } = req.body;
        let mediaUrl = imageBase64 || null; // Поддержка Base64 если пришел
        let finalType = type || 'post';

        // Если загружен физический файл через Multer
        if (req.file) {
            const folder = req.file.mimetype.startsWith('image/') ? 'images' : 'videos';
            mediaUrl = `/uploads/${folder}/${req.file.filename}`;
            finalType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        }

        const newPost = new Content({
            type: finalType,
            title: title ? title.trim() : "Без названия",
            preview,
            body,
            mediaUrl,
            category: category || 'Other',
            tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
            authorId: authorId,
            likes: 0,
            likedBy: [],
            stats: { views: 0, commentsCount: 0 }
        });

        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) {
        console.error("Ошибка создания поста:", err);
        res.status(500).json({ error: err.message });
    }
});

//

app.get('/api/content/single/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Неверный ID" });
        const post = await Content.findById(req.params.id).populate('authorId', 'username avatarUrl');
        if (!post) return res.status(404).json({ error: "Пост не найден" });
        res.json(post);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/content/:id', async (req, res) => {
    try {
        const post = await Content.findById(req.params.id);
        if (post) {
            if (post.mediaUrl && !post.mediaUrl.startsWith('data:')) deleteLocalFile(post.mediaUrl);
            await Content.findByIdAndDelete(req.params.id);
            await Comment.deleteMany({ postId: req.params.id });
        }
        res.json({ message: "Удалено" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. ЛЕНТА И ЛАЙКИ ---
app.get('/api/content', async (req, res) => {
    try {
        const { userId, category } = req.query;
        let query = {};
        if (category && category !== 'All') query.category = category;

        let posts = await Content.find(query)
            .populate('authorId', 'username avatarUrl')
            .sort({ createdAt: -1 })
            .lean();

        // Синхронизация реального кол-ва комментов
        posts = await Promise.all(posts.map(async (post) => {
            const realCount = await Comment.countDocuments({ postId: post._id });
            return { ...post, stats: { ...post.stats, commentsCount: realCount } };
        }));

        // Рекомендации по интересам
        if (userId && userId !== 'undefined' && mongoose.Types.ObjectId.isValid(userId)) {
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
                await Notification.create({
                    userId: post.authorId,
                    fromUserId: userId,
                    type: 'like',
                    message: `поставил(а) лайк вашему посту: "${post.title}"`,
                    contentId: post._id
                });
            }
        }
        await post.save();
        res.json({ success: true, likes: post.likes, isLiked: !isLiked });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. КОММЕНТАРИИ ---
app.post('/api/comments', async (req, res) => {
    try {
        const { postId, userId, text } = req.body;
        const newComment = await Comment.create({ postId, authorId: userId, text });
        const post = await Content.findByIdAndUpdate(postId, { $inc: { 'stats.commentsCount': 1 } });

        // Уведомление о комментарии
        if (post && post.authorId.toString() !== userId.toString()) {
            await Notification.create({
                userId: post.authorId,
                fromUserId: userId,
                type: 'comment',
                message: `прокомментировал(а) ваш пост: "${post.title}"`,
                contentId: post._id
            });
        }

        const populatedComment = await newComment.populate('authorId', 'username avatarUrl');
        res.status(201).json(populatedComment);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ЗАПУСК ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("🚀 MongoDB Connected Successfully");
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`📡 Server running at http://localhost:${PORT}`));
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));