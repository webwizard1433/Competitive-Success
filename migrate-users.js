const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'database.db');

async function migrate() {
    console.log('Starting user migration...');

    // 1. Connect to the database
    const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            return console.error('Error opening database', err.message);
        }
        console.log('Connected to the SQLite database.');
    });

    try {
        // 2. Read users from the npoint.io endpoint
        const npointUrl = 'https://api.npoint.io/628bf2833503e69fb337';
        const response = await fetch(npointUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch users from npoint.io. Status: ${response.status}`);
        }
        const users = await response.json();
        console.log(`Found ${users.length} users in users.json to migrate.`);

        // 3. Prepare the SQL statement
        const sql = `INSERT INTO users (contactInfo, fullName, password, examChoice, registeredAt, progress, favorites, mockTestHistory)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        const saltRounds = 10;
        let migratedCount = 0;

        // 4. Loop and insert each user
        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, saltRounds);
            
            const params = [
                user.contactInfo,
                user.fullName,
                hashedPassword,
                user.examChoice || 'upsc',
                user.registeredAt || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                JSON.stringify(user.progress || {}),
                JSON.stringify(user.favorites || {}),
                JSON.stringify(user.mockTestHistory || [])
            ];

            db.run(sql, params, function(err) {
                if (err) {
                    console.error(`Could not insert user ${user.contactInfo}:`, err.message);
                } else {
                    migratedCount++;
                    console.log(`Successfully migrated user: ${user.contactInfo}`);
                }
            });
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        // 5. Close the database connection
        db.close(() => console.log('Database connection closed. Migration complete.'));
    }
}

migrate();