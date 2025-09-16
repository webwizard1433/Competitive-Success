<<<<<<< HEAD
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

// --- API Routes ---

app.post('/register', (req, res) => {
    const { fullName, preparingFor, contactInfo } = req.body;
    console.log('Registering user:', { fullName, preparingFor, contactInfo });

    // Basic validation
    if (!fullName || !contactInfo) {
        return res.status(400).json({ message: 'Full name and contact info are required.' });
    }

    // In a real app, you would hash the password and save the user to a database.
    // For now, we'll just log it and send a success response.
    users.push({ fullName, contactInfo }); // Storing user data in memory

    res.status(201).json({ message: 'Registration successful!' });
});

app.post('/login', (req, res) => {
    const { contactInfo, password } = req.body;
    console.log('Login attempt:', { contactInfo });

    // Basic validation
    if (!contactInfo || !password) {
        return res.status(400).json({ message: 'Contact info and password are required.' });
    }

    // In a real app, you would find the user and verify the password hash.
    // For this demo, we'll accept any login attempt as successful.
    res.status(200).json({ message: 'Login successful!' });
});