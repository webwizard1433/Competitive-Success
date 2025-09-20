const http = require('http');
const fs = require('fs');
const path = require('path');
// Load environment variables from .env file only in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const { OpenAI } = require("openai");

// --- Initialize OpenAI Client ---
// It will automatically look for the OPENAI_API_KEY in your environment variables
const openai = new OpenAI();

/**
 * Gets a conversational response from the OpenAI API.
 * @param {string} message The user's message.
 * @returns {Promise<string>} The AI's response.
 */
async function getAIResponse(message) {
    console.log(`Getting live AI response for: "${message}"`);

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful and friendly assistant for a competitive exam preparation website called 'Competitive Success'. Answer questions concisely and helpfully. If you don't know an answer, say so politely." },
                { role: "user", content: message }
            ],
            model: "gpt-3.5-turbo", // A fast and cost-effective model
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        // Provide a user-friendly error message
        return "I'm sorry, but I'm having trouble connecting to my brain right now. Please try again in a moment.";
    }
}

const server = http.createServer((req, res) => {
    const { method, url } = req;

    // --- API Endpoint for Chatbot ---
    if (url === '/api/chatbot/ask' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { message } = JSON.parse(body);
                if (!message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'No message provided.' }));
                    return;
                }

                // Get the response from our AI simulation
                const aiReply = await getAIResponse(message);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, reply: aiReply }));

            } catch (error) {
                console.error('Chatbot API Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Internal server error.' }));
            }
        });
        return; // Stop further processing for this API route
    }

    // --- Static File Server (to serve your HTML, CSS, etc.) ---
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './login.html'; // Default to login page
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                // If file not found, try serving index.html for SPA-like behavior
                fs.readFile('./index.html', (err, cont) => {
                    res.writeHead(err ? 404 : 200, { 'Content-Type': 'text/html' });
                    res.end(cont, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Use the port provided by the environment (for services like Render) or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}/`));