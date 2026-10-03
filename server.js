const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Persistent DB
let db = { users: {}, transactions: [], boundAccounts: {} };

// MongoDB Setup
// MongoDB Setup
const MONGO_URI = "mongodb://rishu_verma_02:Rishubhi004@ac-awughnu-shard-00-00.yxn7iyz.mongodb.net:27017,ac-awughnu-shard-00-01.yxn7iyz.mongodb.net:27017,ac-awughnu-shard-00-02.yxn7iyz.mongodb.net:27017/goldbet?ssl=true&replicaSet=atlas-8l644r-shard-0&authSource=admin&retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => {
        console.log('✅ MongoDB Atlas Connected Successfully!');
        initDB();
    })
    .catch(err => console.error('MongoDB Connection Error:', err));

const dbSchema = new mongoose.Schema({
    id: { type: String, default: 'main' },
    users: { type: Object, default: {} },
    transactions: { type: Array, default: [] },
    boundAccounts: { type: Object, default: {} }
}, { strict: false, minimize: false });

const AppDB = mongoose.model('AppDB', dbSchema);

async function initDB() {
    try {
        let doc = await AppDB.findOne({ id: 'main' });
        if (doc) {
            db.users = doc.users || {};
            db.transactions = doc.transactions || [];
            db.boundAccounts = doc.boundAccounts || {};
            console.log('✅ Data loaded from MongoDB.');
        } else {
            console.log('Creating new MongoDB document from local DB fallback...');
            const DB_FILE = path.join(__dirname, 'db.json');
            if (fs.existsSync(DB_FILE)) {
                let raw = fs.readFileSync(DB_FILE, 'utf8');
                if (raw) db = Object.assign({ users: {}, transactions: [] }, JSON.parse(raw));
            }
            if (!db.transactions) db.transactions = [];
            
            await AppDB.create({ id: 'main', users: db.users, transactions: db.transactions, boundAccounts: db.boundAccounts });
        }
    } catch(err) {
        console.error('Error loading DB:', err);
    }
}

function saveDB() {
    // Local Backup for safety
    const DB_FILE = path.join(__dirname, 'db.json');
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    // MongoDB Sync
    AppDB.updateOne({ id: 'main' }, { 
        $set: { 
            users: db.users, 
            transactions: db.transactions, 
            boundAccounts: db.boundAccounts 
        } 
    }, { upsert: true }).catch(err => console.error("Mongo Save Error:", err));
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

// ----------------------------------------------------
// TIRANGA WIN GO ENGINE (Multi-Room Logic)
// ----------------------------------------------------
let dateStrGlobal = new Date().toISOString().replace(/-/g, '').slice(0,8);

const GAMES = {
    '45s': { name: '45s', length: 45, timeLeft: 45, periodCounter: 1, currentPeriod: dateStrGlobal + '0001', history: [], activeBets: [], nextWingoNum: null },
    '1m':  { name: '1Min', length: 60, timeLeft: 60, periodCounter: 1, currentPeriod: dateStrGlobal + '0001', history: [], activeBets: [], nextWingoNum: null },
    '3m':  { name: '3Min', length: 180, timeLeft: 180, periodCounter: 1, currentPeriod: dateStrGlobal + '0001', history: [], activeBets: [], nextWingoNum: null },
    '5m':  { name: '5Min', length: 300, timeLeft: 300, periodCounter: 1, currentPeriod: dateStrGlobal + '0001', history: [], activeBets: [], nextWingoNum: null }
};

function generateResult(forcedNum, activeBets) {
    let finalNum = forcedNum;

    // Lowest payout algorithm if no forced number
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
        // Pick randomly among the numbers with the absolute lowest payout
        finalNum = bestNums[Math.floor(Math.random() * bestNums.length)];
    }

    let colorClasses, colorName, size;
    let html = '';
    size = finalNum >= 5 ? 'Big' : 'Small';
    if(finalNum === 0) {
        colorClasses = "text-[#fb4e4e]"; colorName = "Red/Violet";
        html = '<div class="w-3 h-3 rounded-full bg-[#fb4e4e]"></div><div class="w-3 h-3 rounded-full bg-[#eb43dd] -ml-1"></div>';
    } else if (finalNum === 5) {
        colorClasses = "text-[#18b660]"; colorName = "Green/Violet";
        html = '<div class="w-3 h-3 rounded-full bg-[#18b660]"></div><div class="w-3 h-3 rounded-full bg-[#eb43dd] -ml-1"></div>';
    } else if (finalNum % 2 === 0) {
        colorClasses = "text-[#fb4e4e]"; colorName = "Red";
        html = '<div class="w-3 h-3 rounded-full bg-[#fb4e4e] mx-auto"></div>';
    } else {
        colorClasses = "text-[#18b660]"; colorName = "Green";
        html = '<div class="w-3 h-3 rounded-full bg-[#18b660] mx-auto"></div>';
    }
    return { num: finalNum, colorClasses, html, colorName, size };
}

setInterval(() => {
    Object.keys(GAMES).forEach(room => {
        const game = GAMES[room];
        game.timeLeft--;
        
        io.to('wingo_' + room).emit('timer', { time: Math.max(0, game.timeLeft), period: game.currentPeriod });
        
        io.sockets.sockets.forEach(s => {
            if (s.isAdmin) s.emit('admin_live_bets_' + room, { bets: game.activeBets, period: game.currentPeriod, time: Math.max(0, game.timeLeft) });
        });

        if(game.timeLeft <= 0) {
            const result = generateResult(game.nextWingoNum, game.activeBets);
            game.nextWingoNum = null;
            const newRecord = { period: game.currentPeriod, result };
            
            let usersToUpdate = new Set();
            let userWinnings = {};

            game.activeBets.forEach(bet => {
                if (bet.period === game.currentPeriod) {
                    const betAmt = bet.amount;
                    let wonAmt = 0;
                    if (bet.selection === 'Green' && [1, 3, 7, 9, 5].includes(result.num)) { wonAmt = betAmt * (result.num === 5 ? 1.5 : 2); } 
                    else if (bet.selection === 'Red' && [2, 4, 6, 8, 0].includes(result.num)) { wonAmt = betAmt * (result.num === 0 ? 1.5 : 2); } 
                    else if (bet.selection === 'Violet' && [0, 5].includes(result.num)) { wonAmt = betAmt * 4.5; } 
                    else if (bet.selection.includes('Number') && parseInt(bet.selection.replace('Number ', '')) === result.num) { wonAmt = betAmt * 9; }
                    else if (bet.selection === 'Big' && result.size === 'Big') { wonAmt = betAmt * 2; } 
                    else if (bet.selection === 'Small' && result.size === 'Small') { wonAmt = betAmt * 2; }

                    if (wonAmt > 0) {
                        if (!userWinnings[bet.mobile]) userWinnings[bet.mobile] = 0;
                        userWinnings[bet.mobile] += wonAmt;
                        usersToUpdate.add(bet.mobile);
                    }
                }
            });

            game.activeBets.forEach(bet => {
                if (bet.period === game.currentPeriod) {
                    const won = userWinnings[bet.mobile] || 0;
                    
                    if (!db.users[bet.mobile].betHistory) db.users[bet.mobile].betHistory = [];
                    db.users[bet.mobile].betHistory.unshift({
                        room: room,
                        period: game.currentPeriod,
                        selection: bet.selection,
                        amount: bet.amount,
                        won: won,
                        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    });

                    if (won > 0) {
                        db.users[bet.mobile].balance += won;
                        usersToUpdate.add(bet.mobile);
                    }

                    const socket = io.sockets.sockets.get(bet.socketId);
                    if (socket) {
                        if (won > 0) {
                            socket.emit('balance_update', db.users[bet.mobile].balance);
                            socket.emit('toast', { type: 'success', msg: `Win Go ${game.name}: You won ₹${won.toFixed(2)}` });
                        } else {
                            socket.emit('toast', { type: 'error', msg: `Win Go ${game.name}: You didn't win this round.` });
                        }
                    }
                }
            });

            if (game.activeBets.length > 0) saveDB();
            game.activeBets = [];

            game.history.unshift(newRecord);
            if(game.history.length > 20) game.history.pop();
            io.to('wingo_' + room).emit('new_result', newRecord);
            
            game.timeLeft = game.length;
            game.periodCounter++;
            let pStr = game.periodCounter.toString().padStart(4, '0');
            game.currentPeriod = dateStrGlobal + pStr;
            io.to('wingo_' + room).emit('timer', { time: game.timeLeft, period: game.currentPeriod });
        }
    });
}, 1000);

// ----------------------------------------------------
// SOCKET CONNECTION
// ----------------------------------------------------
io.on('connection', (socket) => {
    
    // Default room join
    socket.join('wingo_1m');
    socket.emit('timer', { time: Math.max(0, GAMES['1m'].timeLeft), period: GAMES['1m'].currentPeriod });
    socket.emit('history', GAMES['1m'].history);

    socket.on('join_game', (room) => {
        if(!GAMES[room]) return;
        ['45s', '1m', '3m', '5m'].forEach(r => socket.leave('wingo_' + r));
        socket.join('wingo_' + room);
        socket.emit('timer', { time: Math.max(0, GAMES[room].timeLeft), period: GAMES[room].currentPeriod });
        socket.emit('history', GAMES[room].history);
    });

    // Auth
        socket.on('reset_password', (data) => {
        if(db.users[data.mobile]) {
            db.users[data.mobile].password = data.newPass;
            saveDB();
            socket.emit('reset_success');
        } else {
            socket.emit('reset_error', 'Mobile number not found');
        }
    });

    socket.on('login', ({ mobile, password }) => {
        if (db.users[mobile] && db.users[mobile].password === password) {
            socket.mobile = mobile;
            socket.emit('auth_success', { 
                mobile, 
                balance: db.users[mobile].balance, 
                uid: db.users[mobile].uid,
                myInviteCode: db.users[mobile].myInviteCode,
                vipLevel: getVipLevel(db.users[mobile].totalBetAmount)
            });
        } else {
            socket.emit('toast', { type: 'error', msg: 'Invalid mobile number or password' });
        }
    });

    socket.on('register', ({ mobile, password, inviteCode }) => {
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

            const newUid = Math.floor(100000 + Math.random() * 900000).toString();
            const myCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            
            db.users[mobile] = { 
                password, 
                balance: 100.00, 
                uid: newUid,
                myInviteCode: myCode,
                upline: uplineMobile,
                totalBetAmount: 0
            }; 
            saveDB();
            
            socket.mobile = mobile;
            socket.emit('auth_success', { mobile, balance: 100.00, uid: newUid, myInviteCode: myCode, vipLevel: 0 });
            socket.emit('toast', { type: 'success', msg: 'Registered Successfully! ₹100 Bonus added.' });
        }
    });

    // Betting & Agency
    socket.on('place_bet', (betData) => {
        if (!socket.mobile) return socket.emit('toast', { type: 'error', msg: 'Please login first!' });
        const user = db.users[socket.mobile];
        const room = betData.room || '1m';
        const game = GAMES[room];

        if (game.timeLeft <= 5) return socket.emit('toast', { type: 'error', msg: 'Betting is closed for this period!' });
        
        if (user.balance >= betData.amount) {
            user.balance -= betData.amount; 
            user.totalBetAmount = (user.totalBetAmount || 0) + betData.amount;
            
            // Agency Commission Logic (1% to referrer)
            if (user.upline && db.users[user.upline]) {
                const commission = betData.amount * 0.01;
                db.users[user.upline].balance += commission;
                db.users[user.upline].totalCommission = (db.users[user.upline].totalCommission || 0) + commission;
                
                // Live update upline if online
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
        // Filter transactions
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
        let amt = parseFloat(data.amount);
        if (amt < 200 || amt > 50000) return socket.emit('toast', { type: 'error', msg: 'Deposit must be between ₹200 and ₹50,000' });

        const dateStrLocal = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const tx = { id: 'TX' + Date.now(), mobile: socket.mobile, uid: user.uid, type: 'DEPOSIT', amount: amt, utr: data.utr, status: 'PENDING', date: dateStrLocal };
        db.transactions.unshift(tx);
        saveDB();
        socket.emit('toast', { type: 'success', msg: 'Deposit request sent. Waiting for Admin approval.' });
        
        // Notify Admins
        io.sockets.sockets.forEach(s => {
            if (s.isAdmin) s.emit('admin_alert', { msg: `New DEPOSIT request from UID: ${user.uid} (₹${tx.amount})`, type: 'deposit' });
            if (s.isAdmin) s.emit('admin_data', { users: db.users, transactions: db.transactions });
        });
    });

    socket.on('request_withdraw', (data) => {
        if (!socket.mobile) return;
        const user = db.users[socket.mobile];
        let amt = parseFloat(data.amount);
        
        if (amt < 500) return socket.emit('toast', { type: 'error', msg: 'Minimum withdrawal is ₹500' });
        if (user.balance < amt) return socket.emit('toast', { type: 'error', msg: 'Insufficient Balance' });
        
        if (!db.boundAccounts) db.boundAccounts = {};
        
        const accountId = data.accountId; // the acc num or upi
        if (db.boundAccounts[accountId] && db.boundAccounts[accountId] !== socket.mobile) {
            return socket.emit('toast', { type: 'error', msg: 'This Account/UPI is already bound to another user!' });
        }
        
        db.boundAccounts[accountId] = socket.mobile;
        
        user.balance -= amt; // Deduct instantly
        
        const dateStrLocal = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const tx = { id: 'TX' + Date.now(), mobile: socket.mobile, uid: user.uid, type: 'WITHDRAW', amount: amt, bankDetails: data.bank, status: 'PENDING', date: dateStrLocal };
        db.transactions.unshift(tx);
        saveDB();
        
        socket.emit('balance_update', user.balance);
        socket.emit('toast', { type: 'success', msg: 'Withdrawal request submitted.' });
        
        // Notify Admins
        io.sockets.sockets.forEach(s => {
            if (s.isAdmin) s.emit('admin_alert', { msg: `New WITHDRAW request from UID: ${user.uid} (₹${tx.amount})`, type: 'withdraw' });
            if (s.isAdmin) s.emit('admin_data', { users: db.users, transactions: db.transactions });
        });
    });

    socket.on('admin_login', (pwd) => {
        if (pwd === 'Rishubhi#044') {
            socket.isAdmin = true;
            socket.emit('admin_auth_success');
            socket.emit('admin_data', { users: db.users, transactions: db.transactions });
        } else {
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
                    db.users[tx.mobile].balance += tx.amount; 
                    db.users[tx.mobile].totalDeposit = (db.users[tx.mobile].totalDeposit || 0) + tx.amount;
                } else if (tx.type === 'WITHDRAW') {
                    db.users[tx.mobile].totalWithdraw = (db.users[tx.mobile].totalWithdraw || 0) + tx.amount;
                }
                saveDB();
            }
        } else if (data.action === 'reject_tx') {
            let tx = db.transactions.find(t => t.id === data.txId);
            if (tx && tx.status === 'PENDING') {
                tx.status = 'REJECTED';
                if (tx.type === 'WITHDRAW') { db.users[tx.mobile].balance += tx.amount; } // Refund
                saveDB();
            }
        } else if (data.action === 'update_balance') {
            if (db.users[data.mobile]) {
                db.users[data.mobile].balance = parseFloat(data.newBalance);
                saveDB();
            }
        } else if (data.action === 'set_wingo_result') {
            if (GAMES[data.room]) GAMES[data.room].nextWingoNum = parseInt(data.num);
        } else if (data.action === 'get_user_history') {
            const user = db.users[data.mobile];
            if (user) {
                const txs = db.transactions.filter(t => t.mobile === data.mobile);
                socket.emit('admin_user_history', { mobile: data.mobile, bets: user.betHistory || [], transactions: txs });
            }
        }
        socket.emit('admin_data', { users: db.users, transactions: db.transactions });
    });

});

const PORT = 8081;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Strict Tiranga Engine running on port ${PORT}`);
});

