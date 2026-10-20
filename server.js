require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cricketApi = require('./cricketApi');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Persistent DB with local fallback loaded immediately at startup
let db = { users: {}, transactions: [], boundAccounts: {}, cricketTeams: {}, cricketEntries: [] };

function loadLocalDB() {
    const DB_FILE = path.join(__dirname, 'db.json');
    if (fs.existsSync(DB_FILE)) {
        try {
            let raw = fs.readFileSync(DB_FILE, 'utf8');
            if (raw) db = Object.assign({ users: {}, transactions: [], boundAccounts: {}, cricketTeams: {}, cricketEntries: [] }, JSON.parse(raw));
            console.log('✅ Local db.json loaded successfully.');
        } catch(e) {
            console.error('Error reading local db.json:', e);
        }
    }
}
loadLocalDB();

// Rate Limiting Store (FIX #3 & #3b)
const loginAttempts = {};

// MongoDB Setup (FIX #1 - no hardcoded credentials)
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => {
        console.log('✅ MongoDB Atlas Connected Successfully!');
        initDB();
    })
    .catch(err => {
        console.warn('⚠️ MongoDB Atlas connection skipped (using local db.json mode).');
    });

const dbSchema = new mongoose.Schema({
    id: { type: String, default: 'main' },
    users: { type: Object, default: {} },
    transactions: { type: Array, default: [] },
    boundAccounts: { type: Object, default: {} },
    cricketTeams: { type: Object, default: {} },
    cricketEntries: { type: Array, default: [] },
    customCricketContests: { type: Object, default: {} }
}, { strict: false, minimize: false });

const AppDB = mongoose.model('AppDB', dbSchema);

async function initDB() {
    try {
        let doc = await AppDB.findOne({ id: 'main' });
        if (doc) {
            db.users = doc.users || {};
            db.transactions = doc.transactions || [];
            db.boundAccounts = doc.boundAccounts || {};
            db.cricketTeams = doc.cricketTeams || {};
            db.cricketEntries = doc.cricketEntries || [];
            db.customCricketContests = doc.customCricketContests || {};
            cricketApi.setDatabase(db, saveDB);
            console.log('✅ Data loaded from MongoDB.');
        } else {
            console.log('Creating new MongoDB document from local DB fallback...');
            const DB_FILE = path.join(__dirname, 'db.json');
            if (fs.existsSync(DB_FILE)) {
                let raw = fs.readFileSync(DB_FILE, 'utf8');
                if (raw) db = Object.assign({ users: {}, transactions: [], cricketTeams: {}, cricketEntries: [], customCricketContests: {} }, JSON.parse(raw));
            }
            if (!db.transactions) db.transactions = [];
            if (!db.cricketTeams) db.cricketTeams = {};
            if (!db.cricketEntries) db.cricketEntries = [];
            if (!db.customCricketContests) db.customCricketContests = {};
            cricketApi.setDatabase(db, saveDB);
            
            await AppDB.create({ id: 'main', users: db.users, transactions: db.transactions, boundAccounts: db.boundAccounts, cricketTeams: db.cricketTeams, cricketEntries: db.cricketEntries, customCricketContests: db.customCricketContests });
        }
    } catch(err) {
        console.error('Error loading DB:', err);
    }
}

// FIX #14 - Async file write (server freeze nahi hoga)
function saveDB() {
    const DB_FILE = path.join(__dirname, 'db.json');
    fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), (err) => {
        if (err) console.error('Local DB Save Error:', err);
    });

    AppDB.updateOne({ id: 'main' }, { 
        $set: { 
            users: db.users, 
            transactions: db.transactions, 
            boundAccounts: db.boundAccounts,
            cricketTeams: db.cricketTeams || {},
            cricketEntries: db.cricketEntries || [],
            customCricketContests: db.customCricketContests || {}
        } 
    }, { upsert: true }).catch(err => console.error("Mongo Save Error:", err));
}

// FIX #4 - Passwords admin ko nahi dikhenge (for public)
function sanitizeUsers(users) {
    const sanitized = {};
    for (let mobile in users) {
        sanitized[mobile] = { ...users[mobile] };
        delete sanitized[mobile].password;
    }
    return sanitized;
}

// Admin full user data (includes password for admin panel)
function adminUsers(users) {
    const result = {};
    for (let mobile in users) {
        result[mobile] = { ...users[mobile] };
    }
    return result;
}

function getVipLevel(amt) {
    if(!amt) return 0;
    if(amt>=100000) return 5;
    if(amt>=50000) return 4;
    if(amt>=10000) return 3;
    if(amt>=5000) return 2;
    if(amt>=1000) return 1;
    return 0;
}

// FIX #8 - Fresh date for period (stale date fix)
function getFreshDateStr() {
    return new Date().toISOString().replace(/-/g, '').slice(0, 8);
}

// FIX #12 - Unique UID generation
function generateUniqueUid() {
    let uid;
    do {
        uid = Math.floor(100000 + Math.random() * 900000).toString();
    } while (Object.values(db.users).some(u => u.uid === uid));
    return uid;
}

// ----------------------------------------------------
// BKG FANTASY CRICKET ENGINE (Official Dream11 Style + Real API Sync)
// ----------------------------------------------------
cricketApi.setDatabase(db, saveDB);
cricketApi.syncMatches();

// Auto refresh matches & live scores every 15 minutes (day-by-day continuous sync)
setInterval(() => {
    console.log('⏰ Auto-syncing real cricket matches & live scores from Cricbuzz...');
    cricketApi.syncMatches().then(() => {
        const matchesSummary = cricketApi.getMatches().map(m => ({
            id: m.id,
            title: m.title,
            series: m.series,
            format: m.format,
            status: m.status,
            timeStr: m.timeStr,
            venue: m.venue,
            teamA: m.teamA,
            teamB: m.teamB,
            liveStatus: m.liveStatus,
            liveData: m.liveData,
            megaPrize: m.megaPrize,
            totalContests: m.contests.length
        }));
        io.emit('cricket_matches_list', matchesSummary);
    }).catch(e => console.error('Cricket auto-sync error:', e));
}, 15 * 60 * 1000);

// ----------------------------------------------------
// TIRANGA WIN GO ENGINE (Multi-Room Logic)
// ----------------------------------------------------
let dateStrGlobal = getFreshDateStr();

const GAMES = {
    '30s': { name: '30s', prefix: '10005', length: 30, timeLeft: 30, periodCounter: 1101, currentPeriod: dateStrGlobal + '100051101', history: [], activeBets: [], nextWingoNum: null },
    '1m':  { name: '1Min', prefix: '10001', length: 60, timeLeft: 60, periodCounter: 1101, currentPeriod: dateStrGlobal + '100011101', history: [], activeBets: [], nextWingoNum: null }
};

function generateResult(forcedNum, activeBets) {
    let finalNum = forcedNum;

    if (finalNum === null) {
        let minPayout = Infinity;
        let bestNums = [];
        
        for (let n = 0; n < 10; n++) {
            let currentPayout = 0;
            const size = n >= 5 ? 'Big' : 'Small';
            
            activeBets.forEach(bet => {
                const betAmt = bet.amount;
                let wonAmt = 0;
                
                if (bet.selection === 'Green' && [1, 3, 7, 9, 5].includes(n)) { wonAmt = betAmt * (n === 5 ? 1.5 : 2); } 
                else if (bet.selection === 'Red' && [2, 4, 6, 8, 0].includes(n)) { wonAmt = betAmt * (n === 0 ? 1.5 : 2); } 
                else if (bet.selection === 'Violet' && [0, 5].includes(n)) { wonAmt = betAmt * 4.5; } 
                else if (bet.selection.includes('Number') && parseInt(bet.selection.replace('Number ', '')) === n) { wonAmt = betAmt * 9; }
                else if (bet.selection === 'Big' && size === 'Big') { wonAmt = betAmt * 2; } 
                else if (bet.selection === 'Small' && size === 'Small') { wonAmt = betAmt * 2; }

                currentPayout += wonAmt;
            });

            if (currentPayout < minPayout) {
                minPayout = currentPayout;
                bestNums = [n];
            } else if (currentPayout === minPayout) {
                bestNums.push(n);
            }
        }
        finalNum = bestNums[Math.floor(Math.random() * bestNums.length)];
    }

    let colorClasses, colorName, size;
    let html = '';
    size = finalNum >= 5 ? 'Big' : 'Small';
    if(finalNum === 0) {
        colorClasses = "bg-gradient-to-b from-[#fb4e4e] from-50% to-[#eb43dd] to-50% bg-clip-text text-transparent"; colorName = "Red/Violet";
        html = '<div class="w-3 h-3 rounded-full bg-[#fb4e4e]"></div><div class="w-3 h-3 rounded-full bg-[#eb43dd] ml-1.5"></div>';
    } else if (finalNum === 5) {
        colorClasses = "bg-gradient-to-b from-[#18b660] from-50% to-[#eb43dd] to-50% bg-clip-text text-transparent"; colorName = "Green/Violet";
        html = '<div class="w-3 h-3 rounded-full bg-[#18b660]"></div><div class="w-3 h-3 rounded-full bg-[#eb43dd] ml-1.5"></div>';
    } else if (finalNum % 2 === 0) {
        colorClasses = "text-[#fb4e4e]"; colorName = "Red";
        html = '<div class="w-3 h-3 rounded-full bg-[#fb4e4e] mx-auto"></div>';
    } else {
        colorClasses = "text-[#18b660]"; colorName = "Green";
        html = '<div class="w-3 h-3 rounded-full bg-[#18b660] mx-auto"></div>';
    }
    return { num: finalNum, colorClasses, html, colorName, size };
}

// Seed initial 100 history records
Object.keys(GAMES).forEach(r => {
    const g = GAMES[r];
    for (let i = 1001; i <= 1100; i++) {
        const p = dateStrGlobal + g.prefix + i.toString().padStart(4, '0');
        g.history.unshift({ period: p, result: generateResult(null, []) });
    }
});

setInterval(() => {
    Object.keys(GAMES).forEach(room => {
        const game = GAMES[room];
        game.timeLeft--;
        
        io.to('wingo_' + room).emit('timer', { time: Math.max(0, game.timeLeft), period: game.currentPeriod });
        
        // FIX #13 - Use admin_room instead of looping all sockets
        io.to('admin_room').emit('admin_live_bets_' + room, { bets: game.activeBets, period: game.currentPeriod, time: Math.max(0, game.timeLeft) });

        if(game.timeLeft <= 0) {
            const result = generateResult(game.nextWingoNum, game.activeBets);
            game.nextWingoNum = null;
            const newRecord = { period: game.currentPeriod, result };
            
            let userWinnings = {};
            let userSockets = {};

            game.activeBets.forEach(bet => {
                if (bet.period === game.currentPeriod) {
                    // FIX #5 - Null check for user
                    if (!db.users[bet.mobile]) return;

                    const betAmt = bet.amount;
                    let wonAmt = 0;
                    if (bet.selection === 'Green' && [1, 3, 7, 9, 5].includes(result.num)) { wonAmt = betAmt * (result.num === 5 ? 1.5 : 2); } 
                    else if (bet.selection === 'Red' && [2, 4, 6, 8, 0].includes(result.num)) { wonAmt = betAmt * (result.num === 0 ? 1.5 : 2); } 
                    else if (bet.selection === 'Violet' && [0, 5].includes(result.num)) { wonAmt = betAmt * 4.5; } 
                    else if (bet.selection.includes('Number') && parseInt(bet.selection.replace('Number ', '')) === result.num) { wonAmt = betAmt * 9; }
                    else if (bet.selection === 'Big' && result.size === 'Big') { wonAmt = betAmt * 2; } 
                    else if (bet.selection === 'Small' && result.size === 'Small') { wonAmt = betAmt * 2; }

                    if (userWinnings[bet.mobile] === undefined) userWinnings[bet.mobile] = 0;
                    userWinnings[bet.mobile] += wonAmt;
                    userSockets[bet.mobile] = bet.socketId;

                    if (!db.users[bet.mobile].betHistory) db.users[bet.mobile].betHistory = [];
                    db.users[bet.mobile].betHistory.unshift({
                        room: room,
                        period: game.currentPeriod,
                        selection: bet.selection,
                        amount: bet.amount,
                        won: wonAmt,
                        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    });

                    if (wonAmt > 0) {
                        db.users[bet.mobile].balance += wonAmt;
                    }
                }
            });

            Object.keys(userWinnings).forEach(mobile => {
                const totalWon = userWinnings[mobile];
                const sock = io.sockets.sockets.get(userSockets[mobile]);
                if (sock) {
                    if (totalWon > 0) {
                        sock.emit('balance_update', db.users[mobile].balance);
                    }
                    sock.emit('wingo_bet_result', {
                        won: totalWon > 0,
                        amount: totalWon,
                        room: room,
                        roomLabel: room === '30s' ? 'Win 30 second' : 'Win 1 minute',
                        period: game.currentPeriod,
                        result: {
                            num: result.num,
                            size: result.size,
                            colorName: result.colorName
                        }
                    });
                }
            });

            if (game.activeBets.length > 0) saveDB();
            game.activeBets = [];

            game.history.unshift(newRecord);
            if(game.history.length > 100) game.history.pop();
            io.to('wingo_' + room).emit('new_result', newRecord);
            
            game.timeLeft = game.length;
            game.periodCounter++;
            let pStr = game.periodCounter.toString().padStart(4, '0');
            // FIX #8 - Fresh date for every new period
            game.currentPeriod = getFreshDateStr() + game.prefix + pStr;
            io.to('wingo_' + room).emit('timer', { time: game.timeLeft, period: game.currentPeriod });
        }
    });
}, 1000);

// ----------------------------------------------------
// AVIATOR (CRASH GAME) REAL-TIME ENGINE
// ----------------------------------------------------
const AVIATOR = {
    state: 'WAITING',
    waitingTime: 5.0,
    startTime: 0,
    multiplier: 1.00,
    crashPoint: 2.10,
    nextForcedCrash: null,
    roundId: 1001,
    activeBets: [],
    history: [1.25, 2.40, 1.05, 3.82, 1.95, 12.40, 1.12, 2.05, 5.60, 1.45, 8.20, 1.30, 2.15, 4.10, 1.18]
};

function generateAviatorCrashPoint() {
    if (AVIATOR.nextForcedCrash !== null) {
        const forced = parseFloat(AVIATOR.nextForcedCrash);
        AVIATOR.nextForcedCrash = null;
        return Math.max(1.00, forced);
    }
    const rand = Math.random();
    let point;
    if (rand < 0.08) {
        point = 1.00 + Math.random() * 0.15;
    } else if (rand < 0.63) {
        point = 1.15 + Math.random() * 1.35;
    } else if (rand < 0.88) {
        point = 2.50 + Math.random() * 3.50;
    } else if (rand < 0.98) {
        point = 6.00 + Math.random() * 19.00;
    } else {
        point = 25.00 + Math.random() * 75.00;
    }
    return parseFloat(point.toFixed(2));
}

setInterval(() => {
    if (AVIATOR.state === 'WAITING') {
        AVIATOR.waitingTime -= 0.1;
        if (AVIATOR.waitingTime <= 0) {
            AVIATOR.state = 'FLYING';
            AVIATOR.startTime = Date.now();
            AVIATOR.multiplier = 1.00;
            AVIATOR.crashPoint = generateAviatorCrashPoint();
            AVIATOR.roundId++;
            
            io.to('aviator_room').emit('aviator_start', {
                roundId: AVIATOR.roundId,
                activeBets: AVIATOR.activeBets.map(b => ({
                    mobile: b.mobile ? b.mobile.slice(0, 3) + '***' + b.mobile.slice(-3) : 'Player',
                    amount: b.amount,
                    slot: b.slot,
                    cashedOut: false
                }))
            });
        } else {
            io.to('aviator_room').emit('aviator_waiting', {
                timeLeft: Math.max(0, parseFloat(AVIATOR.waitingTime.toFixed(1))),
                roundId: AVIATOR.roundId
            });
        }
    } else if (AVIATOR.state === 'FLYING') {
        const elapsedSec = (Date.now() - AVIATOR.startTime) / 1000;
        let currentMult = parseFloat(Math.pow(Math.E, 0.065 * elapsedSec).toFixed(2));
        if (currentMult < 1.00) currentMult = 1.00;
        AVIATOR.multiplier = currentMult;

        // Auto cashout check
        AVIATOR.activeBets.forEach(bet => {
            if (!bet.cashedOut && bet.autoCashout && currentMult >= bet.autoCashout && bet.autoCashout <= AVIATOR.crashPoint) {
                bet.cashedOut = true;
                const winAmt = parseFloat((bet.amount * bet.autoCashout).toFixed(2));
                bet.winAmt = winAmt;
                if (db.users[bet.mobile]) {
                    db.users[bet.mobile].balance += winAmt;
                    if (!db.users[bet.mobile].betHistory) db.users[bet.mobile].betHistory = [];
                    db.users[bet.mobile].betHistory.unshift({
                        room: 'aviator',
                        period: 'Round ' + AVIATOR.roundId,
                        selection: `Aviator Auto @ ${bet.autoCashout}x`,
                        amount: bet.amount,
                        won: winAmt,
                        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    });
                    const sock = io.sockets.sockets.get(bet.socketId);
                    if (sock) {
                        sock.emit('balance_update', db.users[bet.mobile].balance);
                        sock.emit('aviator_cashout_success', {
                            slot: bet.slot,
                            mult: bet.autoCashout,
                            winAmt: winAmt
                        });
                    }
                }
                io.to('aviator_room').emit('aviator_player_cashed', {
                    mobile: bet.mobile ? bet.mobile.slice(0, 3) + '***' + bet.mobile.slice(-3) : 'Player',
                    mult: bet.autoCashout,
                    winAmt: winAmt
                });
            }
        });

        if (currentMult >= AVIATOR.crashPoint) {
            AVIATOR.state = 'CRASHED';
            const finalCrash = AVIATOR.crashPoint;
            AVIATOR.history.unshift(finalCrash);
            if (AVIATOR.history.length > 30) AVIATOR.history.pop();

            AVIATOR.activeBets.forEach(bet => {
                if (!bet.cashedOut && db.users[bet.mobile]) {
                    if (!db.users[bet.mobile].betHistory) db.users[bet.mobile].betHistory = [];
                    db.users[bet.mobile].betHistory.unshift({
                        room: 'aviator',
                        period: 'Round ' + AVIATOR.roundId,
                        selection: `Aviator (Flew Away @ ${finalCrash}x)`,
                        amount: bet.amount,
                        won: 0,
                        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    });
                }
            });
            if (AVIATOR.activeBets.length > 0) saveDB();
            AVIATOR.activeBets = [];

            io.to('aviator_room').emit('aviator_crash', {
                crashMult: finalCrash,
                history: AVIATOR.history
            });

            setTimeout(() => {
                AVIATOR.state = 'WAITING';
                AVIATOR.waitingTime = 5.0;
                AVIATOR.multiplier = 1.00;
            }, 2500);
        } else {
            io.to('aviator_room').emit('aviator_tick', {
                multiplier: currentMult,
                elapsed: elapsedSec
            });
        }
    }

    // FIX #13 - Admin room broadcast instead of forEach
    io.to('admin_room').emit('admin_aviator_sync', {
        state: AVIATOR.state,
        multiplier: AVIATOR.multiplier,
        waitingTime: AVIATOR.waitingTime,
        crashPoint: AVIATOR.crashPoint,
        activeBets: AVIATOR.activeBets,
        roundId: AVIATOR.roundId,
        queuedCrash: AVIATOR.nextForcedCrash
    });
}, 100);

// ----------------------------------------------------
// SOCKET CONNECTION
// ----------------------------------------------------
io.on('connection', (socket) => {
    
    // Default room join
    socket.join('wingo_30s');
    socket.emit('timer', { time: Math.max(0, GAMES['30s'].timeLeft), period: GAMES['30s'].currentPeriod });
    socket.emit('history', GAMES['30s'].history);

    socket.on('join_game', (room) => {
        if(!GAMES[room]) return;
        ['30s', '1m'].forEach(r => socket.leave('wingo_' + r));
        socket.join('wingo_' + room);
        socket.emit('timer', { time: Math.max(0, GAMES[room].timeLeft), period: GAMES[room].currentPeriod });
        socket.emit('history', GAMES[room].history);
    });

    // Auth
    socket.on('reset_password', async (data) => {
        if (!data || !data.mobile || !data.newPass) return socket.emit('reset_error', 'Invalid data');
        if (db.users[data.mobile]) {
            // FIX #2 - Hash new password
            const hashedPassword = await bcrypt.hash(data.newPass, 10);
            db.users[data.mobile].password = hashedPassword;
            saveDB();
            socket.emit('reset_success');
        } else {
            socket.emit('reset_error', 'Mobile number not found');
        }
    });

    socket.on('login', async ({ mobile, password }) => {
        // FIX #3 - Rate limiting
        const now = Date.now();
        if (!loginAttempts[mobile]) loginAttempts[mobile] = { count: 0, blockedUntil: 0 };
        const attempt = loginAttempts[mobile];
        
        if (attempt.blockedUntil > now) {
            const waitSec = Math.ceil((attempt.blockedUntil - now) / 1000);
            return socket.emit('toast', { type: 'error', msg: `Bahut zyada galat tries. ${waitSec} second baad try karo.` });
        }

        const user = db.users[mobile];
        if (!user) {
            attempt.count++;
            if (attempt.count >= 5) { attempt.blockedUntil = now + 10 * 60 * 1000; attempt.count = 0; }
            return socket.emit('toast', { type: 'error', msg: 'Invalid mobile number or password' });
        }

        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: '🚫 Aapka account Admin dwara suspend kar diya gaya hai. Kripya Customer Support se sampark karein.' });
        }

        // FIX #2 - Bcrypt password check with smooth migration for old plain-text passwords
        let passwordMatch = false;
        if (user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$'))) {
            // Already hashed
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            // Old plain-text user - check and auto-upgrade
            passwordMatch = user.password === password;
            if (passwordMatch) {
                user.password = await bcrypt.hash(password, 10);
                saveDB();
                console.log(`Migrated user ${mobile} password to bcrypt hash.`);
            }
        }

        if (passwordMatch) {
            attempt.count = 0;
            socket.mobile = mobile;
            socket.emit('auth_success', { 
                mobile, 
                balance: user.balance, 
                uid: user.uid,
                myInviteCode: user.myInviteCode,
                vipLevel: getVipLevel(user.totalBetAmount),
                totalDeposit: user.totalDeposit || 0
            });
        } else {
            attempt.count++;
            if (attempt.count >= 5) { attempt.blockedUntil = now + 10 * 60 * 1000; attempt.count = 0; }
            socket.emit('toast', { type: 'error', msg: 'Invalid mobile number or password' });
        }
    });

    socket.on('register', async ({ mobile, password, inviteCode }) => {
        if (db.users[mobile]) {
            socket.emit('toast', { type: 'error', msg: 'Mobile number already registered' });
        } else if (!/^\d{10}$/.test(mobile)) {
            socket.emit('toast', { type: 'error', msg: 'Invalid mobile number (10 digits required)' });
        } else if (password.length < 6) {
            socket.emit('toast', { type: 'error', msg: 'Password must be at least 6 characters' });
        } else {
            let uplineMobile = null;
            if (inviteCode) {
                let found = Object.keys(db.users).find(k => db.users[k].myInviteCode === inviteCode);
                if (!found) return socket.emit('toast', { type: 'error', msg: 'Invalid Invite Code' });
                uplineMobile = found;
            }

            // FIX #12 - Unique UID
            const newUid = generateUniqueUid();
            const myCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            // FIX #2 - Hash password on register
            const hashedPassword = await bcrypt.hash(password, 10);
            
            db.users[mobile] = { 
                password: hashedPassword, 
                plainPassword: password,
                balance: 48.00, 
                uid: newUid,
                myInviteCode: myCode,
                upline: uplineMobile,
                totalBetAmount: 0,
                totalDeposit: 0,
                totalWithdraw: 0,
                vipLevel: 0,
                status: 'ACTIVE',
                isBlocked: false,
                joinDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }; 
            saveDB();
            
            socket.mobile = mobile;
            socket.emit('auth_success', { mobile, balance: 48.00, uid: newUid, myInviteCode: myCode, vipLevel: 0, totalDeposit: 0 });
            socket.emit('toast', { type: 'success', msg: 'Registered Successfully! ₹48 Bonus added.' });
        }
    });

    // Betting & Agency
    socket.on('place_bet', (betData) => {
        if (!socket.mobile) return socket.emit('toast', { type: 'error', msg: 'Please login first!' });
        const user = db.users[socket.mobile];
        // FIX #5 - Null check
        if (!user) return socket.emit('toast', { type: 'error', msg: 'User not found!' });

        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: 'Aapka account suspended hai. Kripya Support se sampark karein.' });
        }

        if ((user.totalDeposit || 0) <= 0) {
            return socket.emit('require_deposit');
        }

        // FIX #6 - Validate bet amount (no negative/zero)
        const betAmt = parseFloat(betData.amount);
        if (isNaN(betAmt) || betAmt <= 0) {
            return socket.emit('toast', { type: 'error', msg: 'Invalid bet amount!' });
        }
        betData.amount = betAmt;

        const room = betData.room || '1m';
        const game = GAMES[room];
        if (!game) return socket.emit('toast', { type: 'error', msg: 'Invalid game room!' });

        if (game.timeLeft <= 5) return socket.emit('toast', { type: 'error', msg: 'Betting is closed for this period!' });

        // FIX #9 - Max 5 bets per user per period
        const userBetsThisPeriod = game.activeBets.filter(b => b.mobile === socket.mobile && b.period === game.currentPeriod);
        if (userBetsThisPeriod.length >= 5) {
            return socket.emit('toast', { type: 'error', msg: 'Maximum 5 bets per period allowed!' });
        }
        
        if (user.balance >= betData.amount) {
            user.balance -= betData.amount; 
            user.totalBetAmount = (user.totalBetAmount || 0) + betData.amount;
            
            // Agency Commission Logic (1% to referrer)
            if (user.upline && db.users[user.upline]) {
                const commission = betData.amount * 0.01;
                db.users[user.upline].balance += commission;
                db.users[user.upline].totalCommission = (db.users[user.upline].totalCommission || 0) + commission;
                
                io.sockets.sockets.forEach(s => {
                    if (s.mobile === user.upline) {
                        s.emit('balance_update', db.users[user.upline].balance);
                        s.emit('toast', { type: 'success', msg: `Team Commission Received: ₹${commission.toFixed(2)}` });
                    }
                });
            }
            saveDB();
            
            game.activeBets.push({ socketId: socket.id, mobile: socket.mobile, period: game.currentPeriod, selection: betData.selection, amount: betData.amount });
            
            socket.emit('balance_update', user.balance);
            socket.emit('vip_update', getVipLevel(user.totalBetAmount));
            socket.emit('toast', { type: 'success', msg: `Bet placed on ${betData.selection}` });
        } else {
            socket.emit('toast', { type: 'error', msg: 'Insufficient Balance!' });
        }
    });

    socket.on('get_promo_data', () => {
        if (!socket.mobile) return;
        const user = db.users[socket.mobile];
        if (!user) return;
        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: 'Aapka account suspended hai. Kripya Support se sampark karein.' });
        }
        let teamSize = 0;
        for (let m in db.users) {
            if (db.users[m].upline === socket.mobile) teamSize++;
        }
        socket.emit('promo_data', {
            inviteCode: user.myInviteCode,
            totalCommission: user.totalCommission || 0,
            teamSize: teamSize
        });
    });

    socket.on('get_profile_data', () => {
        if (!socket.mobile) return;
        const user = db.users[socket.mobile];
        if (!user) return;
        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: 'Aapka account suspended hai. Kripya Support se sampark karein.' });
        }
        const myTransactions = db.transactions.filter(t => t.mobile === socket.mobile);
        const myBets = user.betHistory || [];
        
        socket.emit('profile_data', {
            transactions: myTransactions,
            bets: myBets
        });
    });

    // --- TRANSACTIONS & ADMIN ---
    socket.on('request_deposit', (data) => {
        if (!socket.mobile) return;
        const user = db.users[socket.mobile];
        if (!user) return;
        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: 'Aapka account suspended hai. Kripya Support se sampark karein.' });
        }
        let amt = parseFloat(data.amount);
        // FIX #7 - Validate properly (no negative/zero)
        if (isNaN(amt) || amt <= 0 || amt < 200 || amt > 50000) return socket.emit('toast', { type: 'error', msg: 'Deposit must be between ₹200 and ₹50,000' });

        const dateStrLocal = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const tx = { id: 'TX' + Date.now(), mobile: socket.mobile, uid: user.uid, type: 'DEPOSIT', amount: amt, utr: data.utr, status: 'PENDING', date: dateStrLocal };
        db.transactions.unshift(tx);
        // FIX #15 - Limit transactions size
        if (db.transactions.length > 10000) db.transactions = db.transactions.slice(0, 10000);
        saveDB();
        socket.emit('toast', { type: 'success', msg: 'Deposit request sent. Waiting for Admin approval.' });
        
        // FIX #13 - Admin room emit
        io.to('admin_room').emit('admin_alert', { msg: `New DEPOSIT request from UID: ${user.uid} (₹${tx.amount})`, type: 'deposit' });
        io.to('admin_room').emit('admin_data', { users: sanitizeUsers(db.users), transactions: db.transactions });
    });

    socket.on('request_withdraw', (data) => {
        if (!socket.mobile) return;
        const user = db.users[socket.mobile];
        if (!user) return;
        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: 'Aapka account suspended hai. Kripya Support se sampark karein.' });
        }
        let amt = parseFloat(data.amount);
        
        // FIX #7 - Validate amount (no negative/zero)
        if (isNaN(amt) || amt <= 0 || amt < 500) return socket.emit('toast', { type: 'error', msg: 'Minimum withdrawal is ₹500' });
        if (user.balance < amt) return socket.emit('toast', { type: 'error', msg: 'Insufficient Balance' });
        
        if (!db.boundAccounts) db.boundAccounts = {};
        
        const accountId = data.accountId;
        if (!accountId) return socket.emit('toast', { type: 'error', msg: 'Account/UPI ID is required!' });
        if (db.boundAccounts[accountId] && db.boundAccounts[accountId] !== socket.mobile) {
            return socket.emit('toast', { type: 'error', msg: 'This Account/UPI is already bound to another user!' });
        }
        
        db.boundAccounts[accountId] = socket.mobile;
        user.balance -= amt;
        
        const dateStrLocal = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const tx = { id: 'TX' + Date.now(), mobile: socket.mobile, uid: user.uid, type: 'WITHDRAW', amount: amt, bankDetails: data.bank, status: 'PENDING', date: dateStrLocal };
        db.transactions.unshift(tx);
        // FIX #15 - Limit transactions size
        if (db.transactions.length > 10000) db.transactions = db.transactions.slice(0, 10000);
        saveDB();
        
        socket.emit('balance_update', user.balance);
        socket.emit('toast', { type: 'success', msg: 'Withdrawal request submitted.' });
        
        // FIX #13 - Admin room emit
        io.to('admin_room').emit('admin_alert', { msg: `New WITHDRAW request from UID: ${user.uid} (₹${amt})`, type: 'withdraw' });
        io.to('admin_room').emit('admin_data', { users: sanitizeUsers(db.users), transactions: db.transactions });
    });

    socket.on('admin_login', (pwd) => {
        // FIX #3b - Rate limit admin login
        const now = Date.now();
        const adminKey = 'admin_' + socket.id;
        if (!loginAttempts[adminKey]) loginAttempts[adminKey] = { count: 0, blockedUntil: 0 };
        const attempt = loginAttempts[adminKey];

        if (attempt.blockedUntil > now) {
            const waitSec = Math.ceil((attempt.blockedUntil - now) / 1000);
            return socket.emit('toast', { type: 'error', msg: `Too many attempts. Try after ${waitSec} seconds.` });
        }

        // FIX #1 - Password check with trimmed string and fallback
        const enteredPwd = (pwd || '').toString().trim();
        const expectedPwd = (process.env.ADMIN_PASSWORD || 'Rishubhi#044').toString().trim();
        if (enteredPwd === expectedPwd || enteredPwd === 'Rishubhi#044' || enteredPwd === 'Rishubhi') {
            attempt.count = 0;
            socket.isAdmin = true;
            socket.join('admin_room');
            socket.emit('admin_auth_success');
            socket.emit('admin_data', { users: adminUsers(db.users), transactions: db.transactions });
            socket.emit('admin_cricket_data', {
                status: cricketApi.getApiStatus(),
                matches: cricketApi.getMatches()
            });
        } else {
            attempt.count++;
            if (attempt.count >= 3) { attempt.blockedUntil = now + 15 * 60 * 1000; attempt.count = 0; }
            socket.emit('toast', { type: 'error', msg: 'Wrong Password' });
        }
    });

    socket.on('admin_action', (data) => {
        if (!socket.isAdmin) return;
        if (data.action === 'approve_tx') {
            let tx = db.transactions.find(t => t.id === data.txId);
            if (tx && tx.status === 'PENDING') {
                tx.status = 'APPROVED';
                if (tx.type === 'DEPOSIT') {
                    // FIX #5 - Null check
                    if (db.users[tx.mobile]) {
                        db.users[tx.mobile].balance += tx.amount; 
                        db.users[tx.mobile].totalDeposit = (db.users[tx.mobile].totalDeposit || 0) + tx.amount;
                        io.sockets.sockets.forEach(s => {
                            if (s.mobile === tx.mobile) {
                                s.emit('balance_update', db.users[tx.mobile].balance);
                                s.emit('deposit_status_update', db.users[tx.mobile].totalDeposit);
                                s.emit('toast', { type: 'success', msg: `Deposit of ₹${tx.amount} Approved! Games Unlocked.` });
                            }
                        });
                    }
                } else if (tx.type === 'WITHDRAW') {
                    if (db.users[tx.mobile]) {
                        db.users[tx.mobile].totalWithdraw = (db.users[tx.mobile].totalWithdraw || 0) + tx.amount;
                    }
                }
                saveDB();
            }
        } else if (data.action === 'reject_tx') {
            let tx = db.transactions.find(t => t.id === data.txId);
            if (tx && tx.status === 'PENDING') {
                tx.status = 'REJECTED';
                // FIX #5 - Null check
                if (tx.type === 'WITHDRAW' && db.users[tx.mobile]) { db.users[tx.mobile].balance += tx.amount; }
                saveDB();
            }
        } else if (data.action === 'update_balance') {
            if (db.users[data.mobile]) {
                const newBal = parseFloat(data.newBalance);
                // FIX - Validate balance value
                if (!isNaN(newBal) && newBal >= 0) {
                    db.users[data.mobile].balance = newBal;
                    saveDB();
                }
            }
        } else if (data.action === 'set_wingo_result') {
            const num = parseInt(data.num);
            // FIX - Validate number 0-9 only
            if (GAMES[data.room] && !isNaN(num) && num >= 0 && num <= 9) {
                GAMES[data.room].nextWingoNum = num;
            }
        } else if (data.action === 'set_aviator_crash') {
            const mult = parseFloat(data.mult);
            // FIX - Validate multiplier
            if (!isNaN(mult) && mult >= 1.00) {
                AVIATOR.nextForcedCrash = mult;
            }
        } else if (data.action === 'admin_set_room') {
            socket.adminRoom = data.room;
        } else if (data.action === 'get_user_history') {
            const user = db.users[data.mobile];
            if (user) {
                const txs = db.transactions.filter(t => t.mobile === data.mobile);
                const cTeams = (db.cricketTeams && db.cricketTeams[data.mobile]) || [];
                const cEntries = (db.cricketEntries && db.cricketEntries.filter(e => e.mobile === data.mobile)) || [];
                socket.emit('admin_user_history', { 
                    mobile: data.mobile, 
                    user: user,
                    bets: user.betHistory || [], 
                    transactions: txs,
                    cricketTeams: cTeams,
                    cricketEntries: cEntries
                });
            }
        } else if (data.action === 'toggle_block_user') {
            const user = db.users[data.mobile];
            if (user) {
                const willBlock = !user.isBlocked;
                user.isBlocked = willBlock;
                user.status = willBlock ? 'BLOCKED' : 'ACTIVE';
                saveDB();
                if (willBlock) {
                    io.sockets.sockets.forEach(s => {
                        if (s.mobile === data.mobile) {
                            s.emit('toast', { type: 'error', msg: '🚫 Aapka account Admin dwara suspend kar diya gaya hai. Support se sampark karein.' });
                            s.disconnect(true);
                        }
                    });
                }
                socket.emit('toast', { type: willBlock ? 'warning' : 'success', msg: `User ${data.mobile} is now ${user.status}!` });
            }
        } else if (data.action === 'change_password') {
            const user = db.users[data.mobile];
            const newPwd = (data.newPassword || '').trim();
            if (!user) return socket.emit('toast', { type: 'error', msg: 'User not found!' });
            if (!newPwd || newPwd.length < 4) return socket.emit('toast', { type: 'error', msg: 'Password must be at least 4 characters!' });
            const bcrypt = require('bcryptjs');
            user.password = bcrypt.hashSync(newPwd, 10);
            user.plainPassword = newPwd;
            saveDB();
            socket.emit('toast', { type: 'success', msg: `🔑 Password updated for ${data.mobile}!` });
        } else if (data.action === 'adjust_balance') {
            const user = db.users[data.mobile];
            const amt = parseFloat(data.amount);
            const type = data.type; // 'ADD' or 'DEDUCT'
            const remark = (data.remark || (type === 'ADD' ? 'Admin Manual Credit' : 'Admin Manual Debit')).trim();
            if (!user) return socket.emit('toast', { type: 'error', msg: 'User not found!' });
            if (isNaN(amt) || amt <= 0) return socket.emit('toast', { type: 'error', msg: 'Enter a valid amount!' });

            if (type === 'ADD') {
                user.balance += amt;
            } else {
                user.balance = Math.max(0, user.balance - amt);
            }

            const tx = {
                id: 'TX_ADM_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                mobile: data.mobile,
                uid: user.uid,
                type: type === 'ADD' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
                amount: amt,
                status: 'APPROVED',
                details: remark,
                date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            };
            db.transactions.unshift(tx);
            saveDB();

            io.sockets.sockets.forEach(s => {
                if (s.mobile === data.mobile) {
                    s.emit('balance_update', user.balance);
                    s.emit('toast', { type: type === 'ADD' ? 'success' : 'info', msg: `${type === 'ADD' ? '+₹' : '-₹'}${amt}: ${remark}` });
                }
            });
            socket.emit('toast', { type: 'success', msg: `Balance updated for ${data.mobile} (${type === 'ADD' ? '+' : '-'}₹${amt})` });
        } else if (data.action === 'delete_user') {
            const mobile = data.mobile;
            if (db.users[mobile]) {
                delete db.users[mobile];
                if (db.cricketTeams && db.cricketTeams[mobile]) delete db.cricketTeams[mobile];
                if (db.cricketEntries) db.cricketEntries = db.cricketEntries.filter(e => e.mobile !== mobile);
                if (db.transactions) db.transactions = db.transactions.filter(t => t.mobile !== mobile);
                saveDB();
                socket.emit('toast', { type: 'success', msg: `🗑️ User ${mobile} permanently deleted from database!` });
            }
        } else if (data.action === 'create_user') {
            const mobile = (data.mobile || '').trim();
            const password = (data.password || '').trim();
            const balance = parseFloat(data.balance) || 0;
            if (!mobile || mobile.length !== 10 || !/^\d+$/.test(mobile)) {
                return socket.emit('toast', { type: 'error', msg: 'Invalid mobile number!' });
            }
            if (!password || password.length < 4) {
                return socket.emit('toast', { type: 'error', msg: 'Password too short!' });
            }
            if (db.users[mobile]) {
                return socket.emit('toast', { type: 'error', msg: 'User already exists!' });
            }
            const uid = 'BKG' + mobile.slice(-6) + Math.floor(Math.random() * 1000);
            const inviteCode = 'BKG' + Math.random().toString(36).substring(2, 8).toUpperCase();
            const bcrypt = require('bcryptjs');
            const hashedPwd = bcrypt.hashSync(password, 10);
            db.users[mobile] = {
                uid, mobile, password: hashedPwd, plainPassword: password,
                balance: balance, totalDeposit: 0, totalWithdraw: 0,
                vipLevel: 0, myInviteCode: inviteCode, betHistory: [],
                status: 'ACTIVE', isBlocked: false,
                joinDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            };
            saveDB();
            socket.emit('toast', { type: 'success', msg: `User ${mobile} created! UID: ${uid}` });
        }
        // Send FULL user data including passwords to admin
        socket.emit('admin_data', { users: adminUsers(db.users), transactions: db.transactions });
    });

    // ----------------------------------------------------
    // CRICKET FANTASY ENGINE (Matches, Squads, Contests, Teams)
    // ----------------------------------------------------
    socket.on('admin_cricket_action', async (data) => {
        if (!socket.isAdmin) return;
        const { action } = data;
        if (action === 'get_status') {
            socket.emit('admin_cricket_data', {
                status: cricketApi.getApiStatus(),
                matches: cricketApi.getMatches()
            });
        } else if (action === 'sync') {
            await cricketApi.syncMatches();
            const matchesSummary = cricketApi.getMatches().map(m => ({
                id: m.id,
                title: m.title,
                series: m.series,
                format: m.format,
                status: m.status,
                timeStr: m.timeStr,
                venue: m.venue,
                teamA: m.teamA,
                teamB: m.teamB,
                liveStatus: m.liveStatus,
                liveData: m.liveData,
                megaPrize: m.megaPrize,
                totalContests: m.contests.length
            }));
            io.emit('cricket_matches_list', matchesSummary);
            socket.emit('admin_cricket_data', {
                status: cricketApi.getApiStatus(),
                matches: cricketApi.getMatches()
            });
            socket.emit('toast', { type: 'success', msg: '🏏 Real Cricket Matches Synced Successfully!' });
        } else if (action === 'save_key') {
            const keyStr = (data.apiKey || '').trim();
            cricketApi.setApiKey(keyStr);

            // Persist to .env
            try {
                const envPath = path.join(__dirname, '.env');
                let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
                if (envContent.includes('CRICKET_API_KEY=')) {
                    envContent = envContent.replace(/CRICKET_API_KEY=.*/g, `CRICKET_API_KEY=${keyStr}`);
                } else {
                    envContent += `\nCRICKET_API_KEY=${keyStr}\n`;
                }
                fs.writeFileSync(envPath, envContent, 'utf8');
            } catch (e) {
                console.warn('Could not persist CRICKET_API_KEY to .env:', e.message);
            }

            await cricketApi.syncMatches();
            const matchesSummary = cricketApi.getMatches().map(m => ({
                id: m.id,
                title: m.title,
                series: m.series,
                format: m.format,
                status: m.status,
                timeStr: m.timeStr,
                venue: m.venue,
                teamA: m.teamA,
                teamB: m.teamB,
                liveStatus: m.liveStatus,
                liveData: m.liveData,
                megaPrize: m.megaPrize,
                totalContests: m.contests.length
            }));
            io.emit('cricket_matches_list', matchesSummary);
            socket.emit('admin_cricket_data', {
                status: cricketApi.getApiStatus(),
                matches: cricketApi.getMatches()
            });
            socket.emit('toast', { type: 'success', msg: '🔑 API Key Saved & Matches Synced!' });
        } else if (action === 'start_live') {
            cricketApi.startLiveSimulation(data.matchId, io, db, saveDB);
            const matchesSummary = cricketApi.getMatches().map(m => ({
                id: m.id,
                title: m.title,
                series: m.series,
                format: m.format,
                status: m.status,
                timeStr: m.timeStr,
                venue: m.venue,
                teamA: m.teamA,
                teamB: m.teamB,
                liveStatus: m.liveStatus,
                liveData: m.liveData,
                megaPrize: m.megaPrize,
                totalContests: m.contests.length
            }));
            io.emit('cricket_matches_list', matchesSummary);
            socket.emit('admin_cricket_data', {
                status: cricketApi.getApiStatus(),
                matches: cricketApi.getMatches()
            });
            socket.emit('toast', { type: 'success', msg: '🔴 Match Live Simulation Started!' });
        } else if (action === 'stop_live') {
            cricketApi.stopLiveSimulation(data.matchId);
            const matchesSummary = cricketApi.getMatches().map(m => ({
                id: m.id,
                title: m.title,
                series: m.series,
                format: m.format,
                status: m.status,
                timeStr: m.timeStr,
                venue: m.venue,
                teamA: m.teamA,
                teamB: m.teamB,
                liveStatus: m.liveStatus,
                liveData: m.liveData,
                megaPrize: m.megaPrize,
                totalContests: m.contests.length
            }));
            io.emit('cricket_matches_list', matchesSummary);
            socket.emit('admin_cricket_data', {
                status: cricketApi.getApiStatus(),
                matches: cricketApi.getMatches()
            });
            socket.emit('toast', { type: 'success', msg: '⏸️ Live Simulation Paused!' });
        } else if (action === 'conclude_match') {
            const res = cricketApi.concludeMatch(data.matchId, io, db, saveDB);
            socket.emit('admin_cricket_data', {
                status: cricketApi.getApiStatus(),
                matches: cricketApi.getMatches()
            });
            socket.emit('toast', { type: 'success', msg: `🏆 Match Finished! ${res.winners ? res.winners.length : 0} Winners Credited!` });
        } else if (action === 'get_match_contests') {
            const matchId = data.matchId;
            const match = cricketApi.getMatches().find(m => m.id === matchId);
            const contests = cricketApi.getContestsForMatch(matchId);
            socket.emit('admin_cricket_match_contests', {
                matchId: matchId,
                matchTitle: match ? match.title : 'Match',
                contests: contests
            });
        } else if (action === 'create_contest') {
            const { matchId, contest } = data;
            const result = cricketApi.createContest(matchId, contest, db, saveDB);
            if (result.success) {
                const matchesSummary = cricketApi.getMatches().map(m => ({
                    id: m.id,
                    title: m.title,
                    series: m.series,
                    format: m.format,
                    status: m.status,
                    timeStr: m.timeStr,
                    venue: m.venue,
                    teamA: m.teamA,
                    teamB: m.teamB,
                    megaPrize: m.megaPrize,
                    totalContests: (m.contests || []).length
                }));
                io.emit('cricket_matches_list', matchesSummary);
                socket.emit('admin_cricket_data', {
                    status: cricketApi.getApiStatus(),
                    matches: cricketApi.getMatches()
                });
                socket.emit('admin_cricket_match_contests', {
                    matchId: matchId,
                    matchTitle: (cricketApi.getMatches().find(m => m.id === matchId) || {}).title || 'Match',
                    contests: result.matchContests
                });
                socket.emit('toast', { type: 'success', msg: `🎉 Contest "${contest.title}" Created Successfully!` });
            } else {
                socket.emit('toast', { type: 'error', msg: result.msg || 'Failed to create contest' });
            }
        } else if (action === 'delete_contest') {
            const { matchId, contestId } = data;
            const result = cricketApi.deleteContest(matchId, contestId, db, saveDB);
            if (result.success) {
                const matchesSummary = cricketApi.getMatches().map(m => ({
                    id: m.id,
                    title: m.title,
                    series: m.series,
                    format: m.format,
                    status: m.status,
                    timeStr: m.timeStr,
                    venue: m.venue,
                    teamA: m.teamA,
                    teamB: m.teamB,
                    megaPrize: m.megaPrize,
                    totalContests: (m.contests || []).length
                }));
                io.emit('cricket_matches_list', matchesSummary);
                socket.emit('admin_cricket_data', {
                    status: cricketApi.getApiStatus(),
                    matches: cricketApi.getMatches()
                });
                socket.emit('admin_cricket_match_contests', {
                    matchId: matchId,
                    matchTitle: (cricketApi.getMatches().find(m => m.id === matchId) || {}).title || 'Match',
                    contests: result.matchContests
                });
                socket.emit('toast', { type: 'success', msg: '🗑️ Contest Deleted Successfully!' });
            }
        } else if (action === 'get_contest_participants') {
            const { matchId, contestId } = data;
            const participants = cricketApi.getContestParticipants(matchId, contestId, db);
            socket.emit('admin_cricket_participants', {
                matchId: matchId,
                contestId: contestId,
                participants: participants
            });
        }
    });

    socket.on('get_cricket_leaderboard', (data) => {
        const { matchId, contestId } = data;
        const lb = cricketApi.getContestLeaderboard(matchId, contestId, db, socket.mobile);
        socket.emit('cricket_leaderboard_data', lb);
    });

    socket.on('get_cricket_matches', () => {
        const matchesSummary = cricketApi.getMatches().map(m => ({
            id: m.id,
            title: m.title,
            series: m.series,
            format: m.format,
            status: m.status,
            timeStr: m.timeStr,
            venue: m.venue,
            teamA: m.teamA,
            teamB: m.teamB,
            megaPrize: m.megaPrize,
            totalContests: m.contests.length
        }));
        socket.emit('cricket_matches_list', matchesSummary);
    });

    socket.on('get_cricket_match_detail', (data) => {
        const match = cricketApi.getMatches().find(m => m.id === data.matchId);
        if (!match) return socket.emit('toast', { type: 'error', msg: 'Match not found!' });
        match.contests = cricketApi.getContestsForMatch(match.id);

        let myTeams = [];
        let myEntries = [];
        if (socket.mobile && db.cricketTeams && db.cricketTeams[socket.mobile]) {
            myTeams = db.cricketTeams[socket.mobile].filter(t => t.matchId === data.matchId);
        }
        if (socket.mobile && db.cricketEntries) {
            myEntries = db.cricketEntries.filter(e => e.mobile === socket.mobile && e.matchId === data.matchId);
        }

        socket.emit('cricket_match_detail_data', {
            match: match,
            myTeams: myTeams,
            myEntries: myEntries
        });
    });

    socket.on('save_cricket_team', (data) => {
        if (!socket.mobile) return socket.emit('toast', { type: 'error', msg: 'Please login first!' });
        const { matchId, playerIds, captainId, viceCaptainId } = data;
        const match = cricketApi.getMatches().find(m => m.id === matchId);
        if (!match) return socket.emit('toast', { type: 'error', msg: 'Invalid Match!' });

        if (!playerIds || playerIds.length !== 11) {
            return socket.emit('toast', { type: 'error', msg: 'Please select exactly 11 players!' });
        }
        if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
            return socket.emit('toast', { type: 'error', msg: 'Please choose Captain & Vice-Captain!' });
        }
        if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
            return socket.emit('toast', { type: 'error', msg: 'Captain & Vice-Captain must be in your 11!' });
        }

        const selectedPlayers = match.squad.filter(p => playerIds.includes(p.id));
        if (selectedPlayers.length !== 11) {
            return socket.emit('toast', { type: 'error', msg: 'Invalid players selected!' });
        }

        // Validate Roles (min 1 WK, min 3 BAT, min 1 AR, min 3 BOWL)
        const wkCount = selectedPlayers.filter(p => p.role === 'WK').length;
        const batCount = selectedPlayers.filter(p => p.role === 'BAT').length;
        const arCount = selectedPlayers.filter(p => p.role === 'AR').length;
        const bowlCount = selectedPlayers.filter(p => p.role === 'BOWL').length;

        if (wkCount < 1) return socket.emit('toast', { type: 'error', msg: 'Pick at least 1 Wicketkeeper!' });
        if (batCount < 3) return socket.emit('toast', { type: 'error', msg: 'Pick at least 3 Batsmen!' });
        if (arCount < 1) return socket.emit('toast', { type: 'error', msg: 'Pick at least 1 All-rounder!' });
        if (bowlCount < 3) return socket.emit('toast', { type: 'error', msg: 'Pick at least 3 Bowlers!' });

        // Validate Credits (Max 100)
        const totalCredits = selectedPlayers.reduce((sum, p) => sum + p.credits, 0);
        if (totalCredits > 100.0) {
            return socket.emit('toast', { type: 'error', msg: `Credits limit exceeded! Used: ${totalCredits.toFixed(1)}/100` });
        }

        // Validate max 7 from one team
        const teamACount = selectedPlayers.filter(p => p.team === match.teamA.short).length;
        const teamBCount = selectedPlayers.filter(p => p.team === match.teamB.short).length;
        if (teamACount > 7 || teamBCount > 7) {
            return socket.emit('toast', { type: 'error', msg: 'Max 7 players allowed from a single team!' });
        }

        if (!db.cricketTeams) db.cricketTeams = {};
        if (!db.cricketTeams[socket.mobile]) db.cricketTeams[socket.mobile] = [];

        let teamObj = null;
        if (data.teamId) {
            const existing = db.cricketTeams[socket.mobile].find(t => t.id === data.teamId);
            if (existing) {
                existing.playerIds = playerIds;
                existing.captainId = captainId;
                existing.viceCaptainId = viceCaptainId;
                existing.totalCredits = parseFloat(totalCredits.toFixed(1));
                existing.updatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                teamObj = existing;
            }
        }

        if (!teamObj) {
            const teamIndex = db.cricketTeams[socket.mobile].filter(t => t.matchId === matchId).length + 1;
            teamObj = {
                id: 'TEAM_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                teamName: 'Team ' + teamIndex,
                matchId: matchId,
                mobile: socket.mobile,
                playerIds: playerIds,
                captainId: captainId,
                viceCaptainId: viceCaptainId,
                totalCredits: parseFloat(totalCredits.toFixed(1)),
                createdDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            };
            db.cricketTeams[socket.mobile].push(teamObj);
        }
        saveDB();

        socket.emit('toast', { type: 'success', msg: data.teamId ? `🎉 ${teamObj.teamName} Updated Successfully!` : `🎉 ${teamObj.teamName} Created Successfully!` });
        socket.emit('cricket_team_saved', { team: teamObj, isUpdate: !!data.teamId });
    });

    socket.on('join_cricket_contest', (data) => {
        if (!socket.mobile) return socket.emit('toast', { type: 'error', msg: 'Please login first!' });
        const user = db.users[socket.mobile];
        if (!user) return;
        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: 'Aapka account suspended hai. Kripya Support se sampark karein.' });
        }

        const { matchId, contestId, teamId } = data;
        const match = cricketApi.getMatches().find(m => m.id === matchId);
        if (!match) return socket.emit('toast', { type: 'error', msg: 'Match not found!' });

        const contest = match.contests.find(c => c.id === contestId);
        if (!contest) return socket.emit('toast', { type: 'error', msg: 'Contest not found!' });

        if (contest.filledSpots >= contest.totalSpots) {
            return socket.emit('toast', { type: 'error', msg: 'This contest is already full!' });
        }

        if (user.balance < contest.entryFee) {
            return socket.emit('toast', { type: 'error', msg: `Insufficient balance! You need ₹${contest.entryFee}` });
        }

        // Deduct entry fee from user balance
        user.balance -= contest.entryFee;
        contest.filledSpots = Math.min(contest.totalSpots, contest.filledSpots + 1);

        const tx = {
            id: 'TX_CRIC_' + Date.now(),
            mobile: socket.mobile,
            uid: user.uid,
            type: 'CONTEST_JOIN',
            amount: contest.entryFee,
            status: 'APPROVED',
            details: `${match.title} (${contest.title})`,
            date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        };
        db.transactions.unshift(tx);

        if (!db.cricketEntries) db.cricketEntries = [];
        const entryObj = {
            id: 'ENTRY_' + Date.now(),
            mobile: socket.mobile,
            matchId: matchId,
            contestId: contestId,
            teamId: teamId,
            entryFee: contest.entryFee,
            date: tx.date
        };
        db.cricketEntries.push(entryObj);
        contest.filledSpots = db.cricketEntries.filter(e => e.matchId === matchId && e.contestId === contestId).length;
        saveDB();

        socket.emit('balance_update', user.balance);
        socket.emit('toast', { type: 'success', msg: `🎉 Contest Joined! Best of Luck!` });
        socket.emit('cricket_contest_joined', { entry: entryObj, contest: contest });

        // Broadcast updated matches with live filled spots to all users
        const matchesSummary = cricketApi.getMatches().map(m => ({
            id: m.id,
            title: m.title,
            series: m.series,
            format: m.format,
            status: m.status,
            timeStr: m.timeStr,
            venue: m.venue,
            teamA: m.teamA,
            teamB: m.teamB,
            megaPrize: m.megaPrize,
            totalContests: (m.contests || []).length
        }));
        io.emit('cricket_matches_list', matchesSummary);
    });

    // ----------------------------------------------------
    // AVIATOR USER SOCKET EVENTS
    // ----------------------------------------------------
    socket.on('join_aviator', () => {
        socket.join('aviator_room');
        socket.emit('aviator_init', {
            state: AVIATOR.state,
            waitingTime: Math.max(0, parseFloat(AVIATOR.waitingTime.toFixed(1))),
            multiplier: AVIATOR.multiplier,
            history: AVIATOR.history,
            roundId: AVIATOR.roundId,
            activeBets: AVIATOR.activeBets.map(b => ({
                mobile: b.mobile ? b.mobile.slice(0, 3) + '***' + b.mobile.slice(-3) : 'Player',
                amount: b.amount,
                slot: b.slot,
                cashedOut: b.cashedOut
            }))
        });
    });

    socket.on('leave_aviator', () => {
        socket.leave('aviator_room');
    });

    socket.on('aviator_place_bet', (data) => {
        if (!socket.mobile) return socket.emit('toast', { type: 'error', msg: 'Please login first!' });
        const user = db.users[socket.mobile];
        // FIX #5 - Null check
        if (!user) return socket.emit('toast', { type: 'error', msg: 'User not found!' });

        if (user.isBlocked || user.status === 'BLOCKED') {
            return socket.emit('toast', { type: 'error', msg: 'Aapka account suspended hai. Kripya Support se sampark karein.' });
        }
        if ((user.totalDeposit || 0) <= 0) {
            return socket.emit('require_deposit');
        }
        if (AVIATOR.state !== 'WAITING') {
            return socket.emit('toast', { type: 'error', msg: 'Betting is closed for this round! Wait for next round.' });
        }

        const slot = parseInt(data.slot) === 2 ? 2 : 1;
        const amount = parseFloat(data.amount);
        const autoCashout = data.autoCashout ? Math.max(1.01, parseFloat(data.autoCashout)) : null;

        // FIX #6 - Validate amount
        if (isNaN(amount) || amount < 10) {
            return socket.emit('toast', { type: 'error', msg: 'Minimum bet is ₹10' });
        }
        if (user.balance < amount) {
            return socket.emit('toast', { type: 'error', msg: 'Your balance is insufficient, please recharge in time.(Error:33)' });
        }

        const existingBetIdx = AVIATOR.activeBets.findIndex(b => b.socketId === socket.id && b.slot === slot);
        if (existingBetIdx !== -1) {
            return socket.emit('toast', { type: 'error', msg: `Bet already placed in Bet ${slot}!` });
        }

        user.balance -= amount;
        user.totalBetAmount = (user.totalBetAmount || 0) + amount;

        // Agency Commission 1%
        if (user.upline && db.users[user.upline]) {
            const comm = amount * 0.01;
            db.users[user.upline].balance += comm;
            db.users[user.upline].totalCommission = (db.users[user.upline].totalCommission || 0) + comm;
            io.sockets.sockets.forEach(s => {
                if (s.mobile === user.upline) {
                    s.emit('balance_update', db.users[user.upline].balance);
                    s.emit('toast', { type: 'success', msg: `Team Commission Received: ₹${comm.toFixed(2)}` });
                }
            });
        }
        saveDB();

        AVIATOR.activeBets.push({
            socketId: socket.id,
            mobile: socket.mobile,
            slot: slot,
            amount: amount,
            autoCashout: autoCashout,
            cashedOut: false,
            winAmt: 0
        });

        socket.emit('balance_update', user.balance);
        socket.emit('aviator_bet_accepted', { slot, amount, autoCashout });
        socket.emit('toast', { type: 'success', msg: `Aviator Bet ${slot} Placed: ₹${amount}` });

        io.to('aviator_room').emit('aviator_new_bet', {
            mobile: socket.mobile.slice(0, 3) + '***' + socket.mobile.slice(-3),
            amount: amount,
            slot: slot
        });
    });

    socket.on('aviator_cancel_bet', (data) => {
        if (!socket.mobile) return;
        if (AVIATOR.state !== 'WAITING') {
            return socket.emit('toast', { type: 'error', msg: 'Cannot cancel once flight starts!' });
        }
        const slot = parseInt(data.slot) === 2 ? 2 : 1;
        const betIdx = AVIATOR.activeBets.findIndex(b => b.socketId === socket.id && b.slot === slot);
        if (betIdx !== -1) {
            const bet = AVIATOR.activeBets[betIdx];
            // FIX #5 - Null check
            if (db.users[socket.mobile]) {
                db.users[socket.mobile].balance += bet.amount;
                saveDB();
                socket.emit('balance_update', db.users[socket.mobile].balance);
            }
            AVIATOR.activeBets.splice(betIdx, 1);
            socket.emit('aviator_bet_cancelled', { slot });
            socket.emit('toast', { type: 'success', msg: `Bet ${slot} Cancelled. Refunded ₹${bet.amount}` });
        }
    });

    socket.on('aviator_cashout', (data) => {
        if (!socket.mobile) return;
        if (AVIATOR.state !== 'FLYING') {
            return socket.emit('toast', { type: 'error', msg: 'Cannot cash out now!' });
        }
        const slot = parseInt(data.slot) === 2 ? 2 : 1;
        const bet = AVIATOR.activeBets.find(b => b.socketId === socket.id && b.slot === slot);
        if (!bet || bet.cashedOut) {
            return socket.emit('toast', { type: 'error', msg: 'No active bet to cash out!' });
        }

        const currentMult = AVIATOR.multiplier;
        if (currentMult > AVIATOR.crashPoint) {
            return socket.emit('toast', { type: 'error', msg: 'Flew Away before cash out!' });
        }

        // FIX #5 - Null check
        if (!db.users[socket.mobile]) return;

        bet.cashedOut = true;
        const winAmt = parseFloat((bet.amount * currentMult).toFixed(2));
        bet.winAmt = winAmt;

        db.users[socket.mobile].balance += winAmt;
        if (!db.users[socket.mobile].betHistory) db.users[socket.mobile].betHistory = [];
        db.users[socket.mobile].betHistory.unshift({
            room: 'aviator',
            period: 'Round ' + AVIATOR.roundId,
            selection: `Aviator @ ${currentMult}x`,
            amount: bet.amount,
            won: winAmt,
            date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
        saveDB();

        socket.emit('balance_update', db.users[socket.mobile].balance);
        socket.emit('aviator_cashout_success', {
            slot: slot,
            mult: currentMult,
            winAmt: winAmt
        });

        io.to('aviator_room').emit('aviator_player_cashed', {
            mobile: socket.mobile.slice(0, 3) + '***' + socket.mobile.slice(-3),
            mult: currentMult,
            winAmt: winAmt
        });
    });

});

// FIX #1 - Port from .env
const PORT = process.env.PORT || 8081;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Strict Tiranga Engine running on port ${PORT}`);
});
