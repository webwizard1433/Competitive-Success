const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const CSV_FILE_PATH = path.join(__dirname, 'registrations.csv');

// Middleware to parse JSON bodies and enable CORS
app.use(cors());
app.use(express.json());

// Serve the registration.html file on the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'registration.html'));
});

// Serve the login.html file
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve the home.html file
app.get('/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Add a route for each new exam page
app.get('/upsc.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc.html'));
});

app.get('/ssc-cgl.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ssc-cgl.html'));
});

app.get('/nda.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'nda.html'));
});

app.get('/cds.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cds.html'));
});

app.get('/banking.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'banking.html'));
});

app.get('/railways.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'railways.html'));
});

// Routes for UPSC Sub-Pages
app.get('/upsc-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc-videos.html'));
});

app.get('/upsc-papers.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc-papers.html'));
});

app.get('/upsc-history-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc-history-videos.html'));
});

app.get('/upsc-geography-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc-geography-videos.html'));
});

app.get('/upsc-polity-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc-polity-videos.html'));
});

app.get('/upsc-economy-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc-economy-videos.html'));
});

app.get('/upsc-books.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'upsc-books.html'));
});

// Routes for CDS Sub-Pages
app.get('/cds-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cds-videos.html'));
});
app.get('/cds-papers.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cds-papers.html'));
});
app.get('/cds-books.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cds-books.html'));
});

// Routes for NDA Sub-Pages
app.get('/nda-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'nda-videos.html'));
});
app.get('/nda-papers.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'nda-papers.html'));
});
app.get('/nda-books.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'nda-books.html'));
});

// Routes for SSC-CGL Sub-Pages
app.get('/ssc-cgl-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ssc-cgl-videos.html'));
});
app.get('/ssc-cgl-papers.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ssc-cgl-papers.html'));
});
app.get('/ssc-cgl-books.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ssc-cgl-books.html'));
});
app.get('/ssc-cgl-quant-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ssc-cgl-quant-videos.html'));
});

// Routes for Banking Sub-Pages
app.get('/banking-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'banking-videos.html'));
});
app.get('/banking-papers.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'banking-papers.html'));
});
app.get('/banking-books.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'banking-books.html'));
});

// Routes for Railways Sub-Pages
app.get('/railways-videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'railways-videos.html'));
});
app.get('/railways-papers.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'railways-papers.html'));
});
app.get('/railways-books.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'railways-books.html'));
});

// Function to append data to CSV
const appendToCsv = (data) => {
    // Sanitize data to prevent CSV injection and handle commas
    const fullName = `"${data.fullName.replace(/"/g, '""')}"`;
    const preparingFor = `"${data.preparingFor.replace(/"/g, '""')}"`;
    const contactInfo = `"${data.contactInfo.replace(/"/g, '""')}"`;

    const csvRow = `${fullName},${preparingFor},${contactInfo}\n`;

    // Check if file exists to add header
    if (!fs.existsSync(CSV_FILE_PATH)) {
        const header = 'FullName,PreparingFor,ContactInfo\n';
        fs.writeFileSync(CSV_FILE_PATH, header);
    }

    // Append the new user data
    fs.appendFileSync(CSV_FILE_PATH, csvRow);
};

app.post('/register', (req, res) => {
    try {
        appendToCsv(req.body);
        res.status(200).json({ message: 'Registration successful!' });
    } catch (error) {
        console.error('Failed to save registration:', error);
        res.status(500).json({ message: 'Error saving registration data.' });
    }
});

app.post('/login', (req, res) => {
    const { contactInfo, password } = req.body;

    if (!fs.existsSync(CSV_FILE_PATH)) {
        return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    const rows = fileContent.split('\n').slice(1); // Read all rows, skip header

    let userFound = false;

    for (const row of rows) {
        if (!row) continue; // Skip empty lines

        // Split by comma, but respect quotes
        const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
        if (!columns) continue;

        const savedContactInfo = columns[2].replace(/"/g, ''); // ContactInfo is the 3rd column

        if (savedContactInfo === contactInfo) {
            userFound = true;
            // !! IMPORTANT SECURITY NOTE !!
            // This is where you would compare the hashed password from the database
            // with the hash of the password provided by the user.
            // Since we are not storing passwords, we will just approve the login.
            // Example: const passwordMatch = await bcrypt.compare(password, savedHashedPassword);
            // if (passwordMatch) { ... }
            break; // Exit loop once user is found
        }
    }

    if (userFound) {
        res.status(200).json({ message: 'Login successful!' });
    } else {
        res.status(401).json({ message: 'Invalid credentials. Please check your email/mobile and password.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});