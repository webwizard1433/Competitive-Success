const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
const saltRounds = 10; // For password hashing
const PORT = process.env.PORT || 3000;

// --- Database Setup ---
// This sets up an in-memory database for now. For persistence, change to a file path.
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the in-memory SQLite database.');
        // Create tables (you can expand on this)
        db.serialize(() => {
            db.run('CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, category TEXT, title TEXT, type TEXT, "order" INTEGER, UNIQUE(id))');
            db.run('CREATE TABLE IF NOT EXISTS users (contactInfo TEXT PRIMARY KEY, fullName TEXT, password TEXT, role TEXT, examChoice TEXT, progress TEXT, favorites TEXT)');
            // user_progress and favorites are now stored as JSON in the users table.
            // db.run('CREATE TABLE IF NOT EXISTS user_progress (userId TEXT, videoId TEXT, completed BOOLEAN, favorited BOOLEAN, PRIMARY KEY (userId, videoId))');

            // --- Add a default test user for easier development ---
            const testUserPassword = 'password123';
            bcrypt.hash(testUserPassword, saltRounds, (err, hashedPassword) => {
                if (err) return console.error('Error hashing test password:', err);
                const insert = 'INSERT OR IGNORE INTO users (contactInfo, fullName, password, role, examChoice) VALUES (?, ?, ?, ?, ?)';
                db.run(insert, ['test@example.com', 'Test User', hashedPassword, 'student', 'upsc'], (err) => {
                    if (!err) console.log(`Default user 'test@example.com' with password '${testUserPassword}' is ready.`);
                });
            });

            // --- Pre-populate UPSC History Videos ---
            const upscHistoryVideos = [
                // Ancient India
                { id: "1vEVT0mXZg9VpZig4j4ZZOEOeQQfostCi", title: "Ancient India 1", type: "gdrive", category: "upsc-history" },
                { id: "1uhSU_1-AR5WcnDMlj9OJJNDuz2zPO1py", title: "Ancient India 2", type: "gdrive", category: "upsc-history" },
                { id: "1lbKtTHEQmddqxBDthZOV7yecBMtqofRO", title: "Ancient India 3", type: "gdrive", category: "upsc-history" },
                { id: "1ZfVWq3HqaOOC-DeQgKpDBF4mHZWzvDWV", title: "Ancient India 4", type: "gdrive", category: "upsc-history" },
                { id: "1ifpkt_nTCbifkONtLSWoAa0Qfpn2RCj0", title: "Ancient India 5", type: "gdrive", category: "upsc-history" },
                { id: "1Y1vk-mAuvWiNjPa1JhpOMqocBY4SnlGw", title: "Ancient India 6", type: "gdrive", category: "upsc-history" },
                { id: "1zUjISXFqWnI9gtoquSaS-E9wYZ9ykB5o", title: "Ancient India 7", type: "gdrive", category: "upsc-history" },
                { id: "1UdO6HW7asgelluk8bD9BInNekMWtpFsB", title: "Ancient India 8", type: "gdrive", category: "upsc-history" },
                { id: "1N31PckK5gl47OOwoXSgIbH5KsLf_7NRL", title: "Ancient India 9", type: "gdrive", category: "upsc-history" },
                // Medieval India
                { id: "1AW-ZUFTyi5iTAMtQc_RG469azc_Yvk6b", title: "Medieval India 1", type: "gdrive", category: "upsc-history" },
                { id: "1vMYZNukIiHwPRD2ZPd85GOD-YyVycUdv", title: "Medieval India 2", type: "gdrive", category: "upsc-history" },
                { id: "13-uK7bh_KGxtYOZ5qyKdtu_pQk2vZrwV", title: "Medieval India 3", type: "gdrive", category: "upsc-history" },
                { id: "1UxgNKFW2Z5mcjhdDunUhMKXJEShFs6z3", title: "Medieval India 4", type: "gdrive", category: "upsc-history" },
                { id: "1FAAV_TQB09EmrXEMyxO8Uptirb_JedSN", title: "Medieval India 5", type: "gdrive", category: "upsc-history" },
                // Modern India
                { id: "1s8p9j0m9EpYVtVRPgFRxT3ZVTxuHRKjU", title: "Modern India 1", type: "gdrive", category: "upsc-history" },
                { id: "1ue-Xo3lrbcrjBzuFFqszz_g93bhXSOZB", title: "Modern India 2", type: "gdrive", category: "upsc-history" },
                { id: "1Iab0zt6vndX_181HIaFOZ1K6PRIEdRDW", title: "Modern India 3", type: "gdrive", category: "upsc-history" },
                { id: "1kYrq61UrfKNTvnEupZPDdom2U8U60xfZ", title: "Modern India 4", type: "gdrive", category: "upsc-history" },
                { id: "1y75Ql_5ZJLj0SAueD4beCDAntJwElnz2", title: "Modern India 5", type: "gdrive", category: "upsc-history" },
                { id: "1EanMWmh2Fm7Np1bO3qUXvzwPcDhJcV2h", title: "Modern India 6", type: "gdrive", category: "upsc-history" },
                { id: "1btd6-ebd_yE3Qog4JvrJoHelVUle4VGt", title: "Modern India 7", type: "gdrive", category: "upsc-history" },
                { id: "1OKr3Jc2gPJA55_0GAV2eHgpKJt8j5OHH", title: "Modern India 8", type: "gdrive", category: "upsc-history" },
                { id: "1tVpcLt6XlaDaaQwuOfdfREr1f3vYPua7", title: "Modern India 9", type: "gdrive", category: "upsc-history" },
                { id: "1O_zGKH-lvGMdSyNjiSGvczD7FmmbsNie", title: "Modern India 10", type: "gdrive", category: "upsc-history" },
                { id: "1hKJFd7KsuRE90yPcHs1Kbr5zc0L5RetV", title: "Modern India 11", type: "gdrive", category: "upsc-history" },
                { id: "1M7d4F2P1xm2OqidpiMeVhkI_V7M5fjXb", title: "Modern India 12", type: "gdrive", category: "upsc-history" },
                { id: "1DxGjuBcOl_oFvRpDDdElO6OU-_s_f64q", title: "Modern India 13", type: "gdrive", category: "upsc-history" },
                { id: "19kCpN5wbLL2aVlaTOUMKJx92yICYwsZO", title: "Modern India 14", type: "gdrive", category: "upsc-history" },
                { id: "1qRIGszur7DMG9xsTTCG8Xfu3H8vM3lom", title: "Modern India 15", type: "gdrive", category: "upsc-history" },
                { id: "1vV-G5at098WCULqAYJGliypqPq78LAd9", title: "Modern India 16", type: "gdrive", category: "upsc-history" },
                { id: "1G_mrGIm5shZQSNjlseYjusvOkd2gVInZ", title: "Modern India 17", type: "gdrive", category: "upsc-history" },
                { id: "1-pnaE2xrWp5KXsRHAmvX2E4B1P74gplu", title: "Modern India 18", type: "gdrive", category: "upsc-history" },
                { id: "1afUNRy5eH6XiZ4l9Xb8fSF52GY4RW0aV", title: "Modern India 19", type: "gdrive", category: "upsc-history" },
                { id: "1AhuHoGElI7H0GL7q5bumiWqbNGBQFaIc", title: "Modern India 20", type: "gdrive", category: "upsc-history" },
                { id: "1xHL1O3-ysYZOfYSu41p5g42sQ_51mXcS", title: "Modern India 21", type: "gdrive", category: "upsc-history" },
                { id: "1kf_Tu-cH772T3gZHl9cZ-BbNJ2MzlCTZ", title: "Modern India 22", type: "gdrive", category: "upsc-history" },
                { id: "1H9sWIg0kxRDtTiHQ-2qVG4mQREm-fq8t", title: "Modern India 23", type: "gdrive", category: "upsc-history" },
                { id: "19ufneidBJlufwYNlfbSmVapbsIce_h-m", title: "Modern India 25", type: "gdrive", category: "upsc-history" },
                { id: "1ZExPVe03nNR79HrpmJ0H2XJB96A4BtZv", title: "Modern India 26", type: "gdrive", category: "upsc-history" },
                { id: "1MEpIO_sjdr6fgUNmrqXorjDPfC7PV6hv", title: "Modern India 27", type: "gdrive", category: "upsc-history" },
                { id: "1QPqBybQqZbYgxB3gfIc5QICQiVY_QgjG", title: "Modern India 28", type: "gdrive", category: "upsc-history" },
                { id: "1crpGeNeUzmhnWR-FYsfwjNF-dQ_elRYL", title: "Modern India 29", type: "gdrive", category: "upsc-history" },
                { id: "1NTCP-635ymMR7IlSbRenwg1DbyZhmlr4", title: "Modern India 30", type: "gdrive", category: "upsc-history" },
                { id: "1yV_JxGy2xDlPD4rNBj4_HzdassPJKuCp", title: "Modern India 31", type: "gdrive", category: "upsc-history" },
                { id: "1cWbdpwRERCpBkESpTKO8MkBBHMx25l8j", title: "Modern India 32", type: "gdrive", category: "upsc-history" },
                { id: "1Eg6o1cx4PhSbari9Zmq7AkK-q_KjjQqg", title: "Modern India 33", type: "gdrive", category: "upsc-history" },
            ];

            const insertVideoStmt = db.prepare('INSERT OR IGNORE INTO videos (id, title, type, category) VALUES (?, ?, ?, ?)');
            upscHistoryVideos.forEach(video => {
                insertVideoStmt.run(video.id, video.title, video.type, video.category);
            });
            insertVideoStmt.finalize((err) => {
                if (!err) console.log('UPSC History videos pre-populated.');
            });

            db.run('CREATE TABLE IF NOT EXISTS broadcast (id INTEGER PRIMARY KEY, message TEXT, createdAt TEXT)');
        });
    }
});

// --- Middleware ---
app.use(cors());
app.use(express.json()); // To parse JSON bodies

// Serve static files (HTML, CSS, JS) from the root directory
app.use(express.static(path.join(__dirname)));

// --- Video API Routes ---

// GET all videos
app.get('/api/videos', (req, res) => {
    const category = req.query.category;
    let sql = 'SELECT id as _id, category, title, id, type, "order" FROM videos ORDER BY "order" ASC';
    const params = [];
    if (category) {
        sql = 'SELECT id as _id, category, title, id, type, "order" FROM videos WHERE category = ? ORDER BY "order" ASC';
        params.push(category);
    }
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// POST a new video
app.post('/api/videos', (req, res) => {
    const { category, title, id, type } = req.body;
    // In a real app, you'd generate a unique ID. Here we use the video ID as the primary key.
    db.run('INSERT OR REPLACE INTO videos (id, category, title, type) VALUES (?, ?, ?, ?)', [id, category, title, type], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
    });
});

// --- User API Routes ---

// GET all users
app.get('/api/users', (req, res) => {
    db.all('SELECT contactInfo, fullName, role FROM users', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// POST a new user (Registration)
app.post('/api/users/register', async (req, res) => {
    const { fullName, contactInfo, password } = req.body;
    if (!fullName || !contactInfo || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const sql = `INSERT INTO users (contactInfo, fullName, password, role, examChoice, progress, favorites) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [contactInfo, fullName, hashedPassword, 'student', 'upsc', '{}', '{}'];

        db.run(sql, params, function(err) {
            if (err) {
                // Check for unique constraint violation
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ success: false, message: 'An account with this email/mobile already exists.' });
                }
                return res.status(500).json({ success: false, message: 'Database error during registration.' });
            }
            res.status(201).json({ success: true, message: 'Registration successful!' });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during password hashing.' });
    }
});

// POST for user login
app.post('/api/users/login', (req, res) => {
    const { contactInfo, password } = req.body;
    const sql = 'SELECT * FROM users WHERE contactInfo = ?';

    db.get(sql, [contactInfo], async (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Server error.' });
        }
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            res.json({
                success: true,
                message: 'Login successful!',
                userData: {
                    contactInfo: user.contactInfo,
                    fullName: user.fullName,
                    examChoice: user.examChoice
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    });
});

// POST for forgot password request
app.post('/api/users/forgot-password', (req, res) => {
    const { contactInfo } = req.body;
    const sql = 'SELECT contactInfo FROM users WHERE contactInfo = ?';

    db.get(sql, [contactInfo], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Server error.' });
        }
        if (!user) {
            // Still return success to prevent user enumeration
            return res.json({ success: true, message: 'If an account exists for this user, a reset link has been sent.' });
        }

        // In a real app, you would generate a secure, short-lived token,
        // store it in the DB with an expiry, and email/SMS a link.
        // For this simulation, we'll just confirm the user exists.
        const mockToken = `reset_${Date.now()}`;
        res.json({
            success: true,
            message: 'User found. Please check your email/SMS for a reset link.',
            // We send the token and user back for the simulation to work
            token: mockToken,
            user: user.contactInfo
        });
    });
});

// POST to reset the password with a token
app.post('/api/users/reset-password', async (req, res) => {
    const { contactInfo, newPassword } = req.body;
    // In a real app, you'd validate the token from the request here.

    try {
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        const sql = `UPDATE users SET password = ? WHERE contactInfo = ?`;
        db.run(sql, [hashedPassword, contactInfo], function(err) {
            if (err) return res.status(500).json({ success: false, message: 'Failed to update password.' });
            res.json({ success: true, message: 'Password has been reset successfully.' });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during password hashing.' });
    }
});

// POST to update a user's password
app.post('/api/users/update-password', async (req, res) => {
    const { contactInfo, newPassword } = req.body;

    if (!contactInfo || !newPassword) {
        return res.status(400).json({ success: false, message: 'User contact and new password are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        const sql = `UPDATE users SET password = ? WHERE contactInfo = ?`;
        db.run(sql, [hashedPassword, contactInfo], function(err) {
            if (err) return res.status(500).json({ success: false, message: 'Failed to update password in the database.' });
            res.json({ success: true, message: 'Password has been updated successfully.' });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during password hashing.' });
    }
});

// --- Broadcast API ---
// GET broadcast message
app.get('/api/broadcast', (req, res) => {
    db.get('SELECT message, createdAt FROM broadcast ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row || {});
    });
});

// --- Fallback for SPA (Single Page Application) behavior ---
// This ensures that if you refresh a page like /nda, the server sends the correct HTML file.
app.get('/:page', (req, res) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) {
            // If the file doesn't exist, send the main home page or a 404 page
            res.status(404).sendFile(path.join(__dirname, 'home.html'));
        }
    });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Your main application should be available at http://localhost:3000/home.html');
    console.log('Your admin dashboard should be available at http://localhost:3000/index.html');
});

process.on('SIGINT', () => {
    db.close(() => {
        console.log('Database connection closed.');
        process.exit(0);
    });
});