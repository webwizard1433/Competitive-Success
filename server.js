const express = require('express');
const path = require('path');
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

// --- Middleware to prevent caching of protected pages ---
const noCache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
};

// Apply the no-cache middleware to all routes that should be protected.
// This ensures the browser always re-validates with the server.
app.use('/home.html', noCache);
// Add any other protected pages here, for example:
// app.use('/upsc.html', noCache);

// --- In-memory "Database" (for demonstration) ---
// In a real application, you would connect to a database like PostgreSQL or MongoDB.
const users = [];

// --- Static File Serving ---

// This serves all your HTML, CSS, and client-side JS files.
// It should be placed after your API routes.
app.use(express.static(path.join(__dirname, '')));

// --- Root Route ---

// This will serve your home page as the main entry point.
// It's placed after static middleware to act as a fallback for the root URL.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// --- Server Listener ---

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});