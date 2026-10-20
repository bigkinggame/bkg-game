const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Read .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(l => {
        const parts = l.split('=');
        if (parts.length >= 2) {
            process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    });
}

const MONGO_URI = process.env.MONGO_URI;

async function cleanDatabase() {
    if (!MONGO_URI) {
        console.error('No MONGO_URI found in .env');
        return;
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Atlas!');

    // In server.js, const AppDB = mongoose.model('AppDB', dbSchema); -> default collection is 'appdbs'
    const appDbSchema = new mongoose.Schema({ id: String }, { strict: false });
    const AppDB = mongoose.models.AppDB || mongoose.model('AppDB', appDbSchema);

    const doc = await AppDB.findOne({ id: 'main' });
    if (doc) {
        console.log('Before cleanup: User count in Mongo =', Object.keys(doc.users || {}).length);
        console.log('Transactions in Mongo =', (doc.transactions || []).length);
        
        await AppDB.updateOne({ id: 'main' }, {
            $set: {
                users: {},
                transactions: [],
                cricketTeams: {},
                cricketEntries: [],
                boundAccounts: {}
            }
        });
        console.log('✅ Successfully wiped users, transactions, and entries from MongoDB Atlas collection!');
    } else {
        console.log('No doc with id: main found in appdbs.');
    }

    // Also clean local db.json
    const dbJsonPath = path.join(__dirname, 'db.json');
    if (fs.existsSync(dbJsonPath)) {
        const local = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
        local.users = {};
        local.transactions = [];
        local.cricketTeams = {};
        local.cricketEntries = [];
        local.boundAccounts = {};
        fs.writeFileSync(dbJsonPath, JSON.stringify(local, null, 2));
        console.log('✅ Successfully cleaned local db.json!');
    }

    await mongoose.disconnect();
    console.log('Database cleanup completed 100%!');
}

cleanDatabase().catch(console.error);
