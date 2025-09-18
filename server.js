const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors'); // You'll need to install this

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---

// Enable CORS for all routes. This is important for allowing your frontend
// to communicate with your backend when they are served.
app.use(cors());

// This middleware is for parsing JSON request bodies.
app.use(express.json());

// This middleware is for parsing URL-encoded form data.
app.use(express.urlencoded({ extended: true }));

// --- API Routes for Videos ---
const VIDEOS_PATH = path.join(__dirname, 'videos.json');

// Helper function to read videos
const readVideos = async () => {
    try {
        const data = await fs.readFile(VIDEOS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return []; // Return empty array if file doesn't exist
        throw error;
    }
};

// Helper function to write videos
const writeVideos = async (videos) => {
    await fs.writeFile(VIDEOS_PATH, JSON.stringify(videos, null, 2), 'utf-8');
};

// GET all videos or by category
app.get('/api/videos', async (req, res) => {
    const { category } = req.query;
    const videos = await readVideos();
    // Sort videos by order, then by title as a fallback
    videos.sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title));

    if (category) {
        res.json(videos.filter(v => v.category === category));
    } else {
        res.json(videos);
    }
});

// GET a single video by ID
app.get('/api/videos/:id', async (req, res) => {
    const videos = await readVideos();
    const video = videos.find(v => v._id === req.params.id);
    if (video) res.json(video);
    else res.status(404).send('Video not found');
});

// POST a new video
app.post('/api/videos', async (req, res) => {
    const videos = await readVideos();
    // Assign an order number
    const maxOrder = videos.reduce((max, v) => Math.max(max, v.order || 0), 0);
    const newVideo = {
        ...req.body,
        _id: `vid${Date.now()}`,
        order: maxOrder + 1
    };
    videos.push(newVideo);
    await writeVideos(videos);
    res.status(201).json(newVideo);
});

// PUT (update) a video
app.put('/api/videos/:id', async (req, res) => {
    let videos = await readVideos();
    const index = videos.findIndex(v => v._id === req.params.id);
    if (index > -1) {
        videos[index] = { ...videos[index], ...req.body };
        await writeVideos(videos);
        res.json(videos[index]);
    } else {
        res.status(404).send('Video not found');
    }
});

// DELETE a video
app.delete('/api/videos/:id', async (req, res) => {
    let videos = await readVideos();
    const newVideos = videos.filter(v => v._id !== req.params.id);
    if (videos.length === newVideos.length) {
        return res.status(404).send('Video not found');
    }
    await writeVideos(newVideos);
    res.status(204).send(); // No Content
});

// POST to reorder videos
app.post('/api/videos/reorder', async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
        return res.status(400).send('Invalid data format. Expected an array of IDs.');
    }
    let videos = await readVideos();
    // Update the order based on the received array
    orderedIds.forEach((id, index) => {
        const video = videos.find(v => v._id === id);
        if (video) video.order = index;
    });
    await writeVideos(videos);
    res.status(200).json({ message: 'Order updated successfully' });
});

// POST to bulk upload videos from CSV
app.post('/api/videos/bulk', async (req, res) => {
    const { csvData } = req.body;
    if (!csvData) {
        return res.status(400).send('CSV data is required.');
    }

    try {
        const videos = await readVideos();
        let maxOrder = videos.reduce((max, v) => Math.max(max, v.order || 0), 0);

        // Simple CSV parsing (assumes format: category,title,id,type)
        const rows = csvData.trim().split('\n');
        rows.forEach(row => {
            const [category, title, id, type] = row.split(',').map(s => s.trim());
            if (category && title && id && type) {
                maxOrder++;
                videos.push({
                    _id: `vid${Date.now()}${Math.random()}`,
                    category, title, id, type,
                    order: maxOrder
                });
            }
        });

        await writeVideos(videos);
        res.status(201).json({ message: `${rows.length} videos processed.` });
    } catch (error) {
        res.status(500).json({ message: 'Error processing bulk upload.' });
    }
});

// --- API Routes for Doubts/Forum ---
const DOUBTS_PATH = path.join(__dirname, 'doubts.json');

// Helper function to read doubts
const readDoubts = async () => {
    try {
        const data = await fs.readFile(DOUBTS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return []; // Return empty array if file doesn't exist
        throw error;
    }
};

// Helper function to write doubts
const writeDoubts = async (doubts) => {
    await fs.writeFile(DOUBTS_PATH, JSON.stringify(doubts, null, 2), 'utf-8');
};

// GET all doubts for a specific video
app.get('/api/doubts', async (req, res) => {
    const { videoId } = req.query;
    if (!videoId) return res.status(400).json({ message: 'videoId is required' });

    const doubts = await readDoubts();
    const videoDoubts = doubts.filter(d => d.videoId === videoId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(videoDoubts);
});

// POST a new doubt
app.post('/api/doubts', async (req, res) => {
    const { videoId, question, userName, userId } = req.body;
    if (!videoId || !question || !userName || !userId) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    const doubts = await readDoubts();
    const newDoubt = {
        _id: `doubt${Date.now()}`,
        videoId,
        question,
        userName,
        userId,
        createdAt: new Date().toISOString(),
        replies: []
    };
    doubts.push(newDoubt);
    await writeDoubts(doubts);
    res.status(201).json(newDoubt);
});

// POST a reply to a doubt
app.post('/api/doubts/:doubtId/replies', async (req, res) => {
    const { doubtId } = req.params;
    const { reply, userName, userId } = req.body;
    const doubts = await readDoubts();
    const doubt = doubts.find(d => d._id === doubtId);
    if (!doubt) return res.status(404).json({ message: 'Doubt not found.' });

    doubt.replies.push({ _id: `reply${Date.now()}`, reply, userName, userId, createdAt: new Date().toISOString() });
    await writeDoubts(doubts);
    res.status(201).json(doubt);
});

// --- API Routes for Users ---
const USERS_PATH = 'https://api.npoint.io/628bf2833503e69fb337'; // Using npoint as a mock DB

// GET all users
app.get('/api/users', async (req, res) => {
    try {
        // In a real app, you'd fetch from a database. Here we fetch from npoint.
        const response = await fetch(USERS_PATH);
        if (!response.ok) throw new Error('Failed to fetch users from npoint.');
        const users = await response.json();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Could not fetch users.' });
    }
});

// DELETE a user by contactInfo
app.delete('/api/users/:contactInfo', async (req, res) => {
    const { contactInfo } = req.params;
    try {
        const response = await fetch(USERS_PATH);
        let users = await response.json();
        const updatedUsers = users.filter(u => u.contactInfo !== contactInfo);

        await fetch(USERS_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUsers)
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Could not delete user.' });
    }
});

// PUT (update) a user's role
app.put('/api/users/:contactInfo/role', async (req, res) => {
    const { contactInfo } = req.params;
    const { role } = req.body;
    try {
        const response = await fetch(USERS_PATH);
        let users = await response.json();
        const user = users.find(u => u.contactInfo === contactInfo);
        if (user) user.role = role;

        await fetch(USERS_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(users) });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Could not update user role.' });
    }
});

// --- Root Route ---

// This will serve your home page as the main entry point.
// It's placed after static middleware to act as a fallback for the root URL.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// --- Static File Serving ---
// This serves all your other HTML, CSS, and client-side JS files.
// It should be placed after your specific routes.
app.use(express.static(path.join(__dirname, '')));

// --- Server Listener ---

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});