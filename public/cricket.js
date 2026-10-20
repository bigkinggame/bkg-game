/**
 * BKG CRICKET FANTASY ENGINE (Dream11 AAA Luxury Edition)
 * Obsidian & Gold Palette • 3D SVG Cricket Jerseys • Virtual Stadium Field
 */

(function () {
    // Global Cricket State
    window.cricState = {
        matches: [],
        lobbyFilter: 'ALL', // 'ALL' | 'LIVE' | 'UPCOMING'
        currentMatch: null,
        currentMatchData: null, // { match, myTeams, myEntries }
        currentActiveRole: 'WK', // 'WK' | 'BAT' | 'AR' | 'BOWL'
        selectedPlayerIds: [],
        selectedCaptainId: null,
        selectedViceCaptainId: null,
        selectedContest: null,
        selectedContestId: null,
        editingTeamId: null, // When editing an existing team
        currentLeaderboardParticipants: [], // Cached for click-to-inspect
        activeDetailTab: 'contests', // 'contests' | 'leaderboard' | 'myteams' | 'mycontests'
        activeSubView: 'lobby' // 'lobby' | 'detail' | 'builder' | 'capvc'
    };

    // ----------------------------------------------------
    // HIGH-PERFORMANCE WEB AUDIO SFX SYNTHESIZER
    // Zero external audio assets • Sub-millisecond latency
    // ----------------------------------------------------
    class CricAudioEngine {
        constructor() {
            this.ctx = null;
            this.enabled = localStorage.getItem('cric_sfx_muted') !== 'true';
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        toggle() {
            this.enabled = !this.enabled;
            localStorage.setItem('cric_sfx_muted', !this.enabled ? 'true' : 'false');
            this.updateIcon();
            return this.enabled;
        }

        updateIcon() {
            const icon = document.getElementById('cricSoundIcon');
            const btn = document.getElementById('cricSoundToggleBtn');
            if (icon) {
                icon.className = this.enabled ? 'fa-solid fa-volume-high text-yellow-400' : 'fa-solid fa-volume-xmark text-gray-500';
            }
            if (btn) {
                btn.title = this.enabled ? 'Sound FX: ON (Tap to mute)' : 'Sound FX: MUTED (Tap to unmute)';
            }
        }

        play(type) {
            if (!this.enabled) return;
            try {
                this.init();
                if (!this.ctx) return;
                const now = this.ctx.currentTime;

                if (type === 'click') {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1100, now);
                    osc.frequency.exponentialRampToValueAtTime(550, now + 0.03);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.04);
                } else if (type === 'coin') {
                    [880, 1108, 1320, 1760].forEach((freq, idx) => {
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                        gain.gain.setValueAtTime(0, now + idx * 0.05);
                        gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.05 + 0.015);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now + idx * 0.05);
                        osc.stop(now + idx * 0.05 + 0.28);
                    });
                } else if (type === 'wicket') {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(220, now);
                    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
                    gain.gain.setValueAtTime(0.28, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.22);
                } else if (type === 'boundary') {
                    [392, 523.25, 659.25, 783.99].forEach(f => {
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(f, now);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.5);
                    });
                } else if (type === 'win') {
                    const notes = [
                        { f: 523.25, t: 0.0, d: 0.15 },
                        { f: 659.25, t: 0.14, d: 0.15 },
                        { f: 783.99, t: 0.28, d: 0.2 },
                        { f: 1046.50, t: 0.45, d: 0.6 }
                    ];
                    notes.forEach(n => {
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(n.f, now + n.t);
                        gain.gain.setValueAtTime(0.12, now + n.t);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now + n.t);
                        osc.stop(now + n.t + n.d + 0.05);
                    });
                }
            } catch (e) {
                console.warn('Audio error:', e);
            }
        }
    }

    window.cricAudio = new CricAudioEngine();

    window.toggleCricketSound = function () {
        if (window.cricAudio) {
            window.cricAudio.toggle();
            if (window.cricAudio.enabled) window.cricAudio.play('click');
        }
    };

    // ----------------------------------------------------
    // WINNER MODAL PARTICLE CONFETTI CANNON
    // ----------------------------------------------------
    let cricConfettiAnimId = null;

    function launchCricConfetti() {
        const canvas = document.getElementById('cricConfettiCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#ffffff', '#e11d48'];
        const particles = [];
        for (let i = 0; i < 90; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * 60,
                y: canvas.height * 0.45,
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.8) * 19,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 14,
                opacity: 1,
                gravity: 0.35
            });
        }

        if (cricConfettiAnimId) cancelAnimationFrame(cricConfettiAnimId);

        function frame() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.vx *= 0.985;
                p.rotation += p.rotationSpeed;
                p.opacity -= 0.007;

                if (p.opacity > 0 && p.y < canvas.height + 30) {
                    alive = true;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.globalAlpha = Math.max(0, p.opacity);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                    ctx.restore();
                }
            });

            if (alive) {
                cricConfettiAnimId = requestAnimationFrame(frame);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cricConfettiAnimId = null;
            }
        }

        cricConfettiAnimId = requestAnimationFrame(frame);
    }

    function stopCricConfetti() {
        if (cricConfettiAnimId) {
            cancelAnimationFrame(cricConfettiAnimId);
            cricConfettiAnimId = null;
        }
        const canvas = document.getElementById('cricConfettiCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    const ROLE_LIMITS = {
        WK: { min: 1, max: 4, name: 'Wicket-Keeper', icon: '🧤' },
        BAT: { min: 3, max: 6, name: 'Batter', icon: '🏏' },
        AR: { min: 1, max: 4, name: 'All-Rounder', icon: '⚡' },
        BOWL: { min: 3, max: 6, name: 'Bowler', icon: '🎯' }
    };

    // ----------------------------------------------------
    // AUTHENTIC 3D SVG CRICKET JERSEY GENERATOR
    // ----------------------------------------------------
    function getJerseySvg(teamCode, size = 38) {
        let mainColor = '#1e3c72';
        let trimColor = '#f39c12';
        let stripeColor = '#ffffff';

        const code = (teamCode || '').toUpperCase();
        if (code === 'IND') {
            mainColor = '#0b52bb'; trimColor = '#ff9933'; stripeColor = '#ffffff';
        } else if (code === 'AUS') {
            mainColor = '#fbc02d'; trimColor = '#1b5e20'; stripeColor = '#1b5e20';
        } else if (code === 'CSK') {
            mainColor = '#fbc02d'; trimColor = '#0d47a1'; stripeColor = '#ffffff';
        } else if (code === 'MI') {
            mainColor = '#0072ce'; trimColor = '#ffd700'; stripeColor = '#ffd700';
        } else if (code === 'RCB') {
            mainColor = '#b71c1c'; trimColor = '#212121'; stripeColor = '#ffd700';
        } else if (code === 'KKR') {
            mainColor = '#4a148c'; trimColor = '#ffd700'; stripeColor = '#ffd700';
        } else if (code === 'ENG') {
            mainColor = '#c62828'; trimColor = '#0d47a1'; stripeColor = '#ffffff';
        } else if (code === 'SA') {
            mainColor = '#1b5e20'; trimColor = '#fbc02d'; stripeColor = '#fbc02d';
        }

        return `
            <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="filter drop-shadow-[0_3px_5px_rgba(0,0,0,0.5)]">
                <!-- Jersey Sleeves & Body -->
                <path d="M19 18 L11 26 L17 32 L21 26 L21 54 L43 54 L43 26 L47 32 L53 26 L45 18 L37 21 C35 24 29 24 27 21 Z" fill="${mainColor}" stroke="${trimColor}" stroke-width="1.8" stroke-linejoin="round"/>
                <!-- Collar -->
                <path d="M27 21 C29 24 35 24 37 21 L34 17 C33 19 31 19 30 17 Z" fill="${trimColor}"/>
                <!-- Center Accents -->
                <line x1="32" y1="24" x2="32" y2="52" stroke="${stripeColor}" stroke-width="1.8" stroke-dasharray="3 2" opacity="0.85"/>
                <!-- Team Code Label -->
                <text x="32" y="38" text-anchor="middle" fill="#ffffff" font-size="8.5" font-weight="900" font-family="Arial, sans-serif" letter-spacing="-0.5">${code}</text>
            </svg>
        `;
    }

    // ----------------------------------------------------
    // AUTHENTIC 3D TEAM SHIELD GENERATOR (No broken flag text)
    // ----------------------------------------------------
    function getTeamShield(teamCode, teamName, size = 'w-11 h-11') {
        const code = (teamCode || '').toUpperCase();
        let bg = 'from-blue-600 to-indigo-950';
        let border = 'border-amber-400/80';
        let symbol = '🏏';

        if (code === 'IND') {
            bg = 'from-blue-600 via-blue-800 to-blue-950'; border = 'border-amber-400'; symbol = '🇮🇳';
        } else if (code === 'AUS') {
            bg = 'from-yellow-400 via-amber-500 to-amber-700'; border = 'border-emerald-500'; symbol = '🦘';
        } else if (code === 'CSK') {
            bg = 'from-yellow-400 via-amber-500 to-yellow-600'; border = 'border-blue-500'; symbol = '🦁';
        } else if (code === 'MI') {
            bg = 'from-blue-500 via-blue-700 to-indigo-900'; border = 'border-amber-400'; symbol = '⚡';
        } else if (code === 'RCB') {
            bg = 'from-red-600 via-rose-800 to-red-950'; border = 'border-amber-400'; symbol = '👑';
        } else if (code === 'KKR') {
            bg = 'from-purple-700 via-purple-900 to-indigo-950'; border = 'border-amber-400'; symbol = '⚔️';
        } else if (code === 'ENG') {
            bg = 'from-red-600 via-blue-800 to-slate-900'; border = 'border-white'; symbol = '🦁';
        } else if (code === 'SA') {
            bg = 'from-emerald-600 via-green-800 to-emerald-950'; border = 'border-yellow-400'; symbol = '🇿🇦';
        }

        return `
            <div class="relative ${size} rounded-2xl bg-gradient-to-br ${bg} border-2 ${border} flex flex-col items-center justify-center shadow-lg flex-shrink-0">
                <span class="text-xs leading-none select-none">${symbol}</span>
                <span class="text-[9px] font-black text-white tracking-tight leading-tight mt-0.5">${code}</span>
            </div>
        `;
    }

    const DEFAULT_MATCHES_FALLBACK = [
        {
            id: 'm_ind_aus',
            title: 'India vs Australia',
            series: 'T20 International Trophy 2026',
            format: 'T20',
            status: 'UPCOMING',
            timeStr: 'Starts in 01h 45m',
            venue: 'Wankhede Stadium, Mumbai',
            teamA: { name: 'India', short: 'IND', flag: '🏏' },
            teamB: { name: 'Australia', short: 'AUS', flag: '🦘' },
            megaPrize: '₹10,000',
            totalContests: 4
        },
        {
            id: 'm_csk_mi',
            title: 'CSK vs MI',
            series: 'Indian T20 Super League 2026',
            format: 'T20',
            status: 'UPCOMING',
            timeStr: 'Starts in 05h 30m',
            venue: 'MA Chidambaram Stadium, Chennai',
            teamA: { name: 'Chennai Super Kings', short: 'CSK', flag: '🦁' },
            teamB: { name: 'Mumbai Indians', short: 'MI', flag: '🔵' },
            megaPrize: '₹25,000',
            totalContests: 4
        }
    ];

    function getSocket() {
        return window.socket || (typeof socket !== 'undefined' ? socket : null);
    }

    // ----------------------------------------------------
    // SOCKET BINDINGS & REAL-TIME EVENT HANDLERS
    // ----------------------------------------------------
    function initCricketSockets() {
        const s = getSocket();
        if (!s) return;
        if (s._cricket_bound) return;
        s._cricket_bound = true;

        s.on('cricket_matches_list', function (matches) {
            if (matches && matches.length) {
                window.cricState.matches = matches;
                applyLobbyFilter();
            }
        });

        s.on('cricket_match_detail_data', function (data) {
            window.cricState.currentMatchData = data;
            window.cricState.currentMatch = data.match;
            renderMatchDetailView();
        });

        s.on('cricket_live_update', function (data) {
            updateLiveScoreArena(data);
        });

        s.on('cricket_leaderboard_data', function (data) {
            renderLeaderboard(data);
        });

        s.on('cricket_winner_announced', function (data) {
            triggerWinnerCelebration(data);
        });

        s.on('cricket_team_saved', function (data) {
            window.cricState.editingTeamId = null;
            if (window.cricAudio) window.cricAudio.play('coin');
            if (typeof showToast === 'function') {
                const actionWord = data.isUpdate ? 'Updated' : 'Created';
                showToast(`🎉 ${data.team.teamName} ${actionWord}!`, 'success');
            }
            const sock = getSocket();
            if (sock && window.cricState.currentMatch) {
                sock.emit('get_cricket_match_detail', { matchId: window.cricState.currentMatch.id });
            }
            setCricSubView('detail');
            switchCricDetailTab('myteams');
        });

        s.on('cricket_contest_joined', function (data) {
            if (window.cricAudio) window.cricAudio.play('coin');
            if (typeof showToast === 'function') {
                showToast('🎉 Contest Joined Successfully!', 'success');
            }
            closeCricketJoinModal();
            const sock = getSocket();
            if (sock && window.cricState.currentMatch) {
                sock.emit('get_cricket_match_detail', { matchId: window.cricState.currentMatch.id });
            }
            switchCricDetailTab('mycontests');
        });
    }

    initCricketSockets();
    document.addEventListener('DOMContentLoaded', initCricketSockets);

    // ----------------------------------------------------
    // INITIALIZATION & VIEW NAVIGATION
    // ----------------------------------------------------
    window.initCricketView = function () {
        setCricSubView('lobby');
        initCricketSockets();
        if (window.cricAudio) window.cricAudio.updateIcon();

        const toRender = (window.cricState.matches && window.cricState.matches.length) ? window.cricState.matches : DEFAULT_MATCHES_FALLBACK;
        renderMatchesLobby(toRender);

        const s = getSocket();
        if (s) {
            s.emit('get_cricket_matches');
        }
    };

    function setCricSubView(view) {
        window.cricState.activeSubView = view;
        const lobby = document.getElementById('cricLobbyView');
        const detail = document.getElementById('cricMatchDetailView');
        const builder = document.getElementById('cricTeamBuilderView');
        const capvc = document.getElementById('cricCapVcView');
        const headerTitle = document.getElementById('cricHeaderTitle');
        const headerSub = document.getElementById('cricHeaderSub');

        if (lobby) lobby.classList.add('hidden');
        if (detail) detail.classList.add('hidden');
        if (builder) builder.classList.add('hidden');
        if (capvc) capvc.classList.add('hidden');

        if (view === 'lobby') {
            if (lobby) lobby.classList.remove('hidden');
            if (headerTitle) headerTitle.innerText = 'BKG Fantasy Cricket';
            if (headerSub) headerSub.innerText = 'Dream11 Style Real Cash Contests';
        } else if (view === 'detail') {
            if (detail) detail.classList.remove('hidden');
            if (headerTitle) headerTitle.innerText = window.cricState.currentMatch ? window.cricState.currentMatch.title : 'Match Contests';
            if (headerSub) headerSub.innerText = window.cricState.currentMatch ? window.cricState.currentMatch.series : 'Upcoming Contest';
        } else if (view === 'builder') {
            if (builder) builder.classList.remove('hidden');
            const teamNum = (window.cricState.currentMatchData && window.cricState.currentMatchData.myTeams ? window.cricState.currentMatchData.myTeams.length : 0) + 1;
            if (headerTitle) headerTitle.innerText = `Create Team ${teamNum}`;
            if (headerSub) headerSub.innerText = window.cricState.currentMatch ? window.cricState.currentMatch.title : 'Select 11 Players';
        } else if (view === 'capvc') {
            if (capvc) capvc.classList.remove('hidden');
            if (headerTitle) headerTitle.innerText = 'Choose C & VC';
            if (headerSub) headerSub.innerText = 'Captain gets 2x • Vice-Captain gets 1.5x';
        }
    }

    window.handleCricketBack = function () {
        const current = window.cricState.activeSubView;
        if (current === 'capvc') {
            setCricSubView('builder');
        } else if (current === 'builder') {
            if (window.cricState.selectedPlayerIds.length > 0) {
                if (confirm('Discard changes and return to contests?')) {
                    setCricSubView('detail');
                }
            } else {
                setCricSubView('detail');
            }
        } else if (current === 'detail') {
            setCricSubView('lobby');
            const s = getSocket();
            if (s) s.emit('get_cricket_matches');
        } else {
            if (typeof switchView === 'function') {
                switchView('home');
            }
        }
    };

    // ----------------------------------------------------
    // MATCHES LOBBY & FILTERING
    // ----------------------------------------------------
    window.filterCricLobby = function (status, btnEl) {
        window.cricState.lobbyFilter = status;

        const buttons = document.querySelectorAll('.cric-filter-btn');
        buttons.forEach(btn => {
            btn.className = 'cric-filter-btn px-2.5 py-0.5 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1';
        });

        if (btnEl) {
            btnEl.className = 'cric-filter-btn px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-theme-gold text-black shadow flex items-center gap-1';
        }

        applyLobbyFilter();
    };

    function applyLobbyFilter() {
        const filter = window.cricState.lobbyFilter || 'ALL';
        const allMatches = window.cricState.matches && window.cricState.matches.length ? window.cricState.matches : DEFAULT_MATCHES_FALLBACK;

        let filtered = allMatches;
        if (filter === 'LIVE') {
            filtered = allMatches.filter(m => m.status === 'LIVE');
        } else if (filter === 'UPCOMING') {
            filtered = allMatches.filter(m => m.status === 'UPCOMING');
        }

        renderMatchesLobby(filtered);
    }

    function renderMatchesLobby(matches) {
        const container = document.getElementById('cricMatchesContainer');
        if (!container) return;

        if (!matches || matches.length === 0) {
            container.innerHTML = `
                <div class="bg-[#12141c] rounded-2xl p-8 text-center border border-[#212433]">
                    <i class="fa-solid fa-cricket-bat-ball text-4xl text-gray-500 mb-3"></i>
                    <p class="text-sm font-bold text-gray-300">No Matches Found</p>
                    <p class="text-xs text-gray-500 mt-1">Try selecting another filter or check back soon.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = matches.map(m => {
            const isLive = m.status === 'LIVE';
            const isCompleted = m.status === 'COMPLETED';

            let statusBadge = '';
            if (isLive) {
                statusBadge = `
                    <span class="text-red-400 font-black font-mono flex items-center gap-1.5 bg-red-950/80 px-2.5 py-0.5 rounded-full border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                        <span>LIVE IN-PLAY</span>
                    </span>
                `;
            } else if (isCompleted) {
                statusBadge = `
                    <span class="text-emerald-400 font-bold font-mono flex items-center gap-1 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        <i class="fa-solid fa-check-circle text-[10px]"></i> COMPLETED
                    </span>
                `;
            } else {
                statusBadge = `
                    <span class="text-amber-400 font-bold font-mono flex items-center gap-1 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        <i class="fa-regular fa-clock text-[10px]"></i> ${m.timeStr}
                    </span>
                `;
            }

            const shieldA = getTeamShield(m.teamA.short, m.teamA.name);
            const shieldB = getTeamShield(m.teamB.short, m.teamB.name);

            return `
                <div onclick="openCricketMatch('${m.id}')" class="bg-gradient-to-b from-[#141620] to-[#0e1017] hover:from-[#191c28] hover:to-[#12141c] rounded-2xl p-4 border ${isLive ? 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.25)]' : 'border-[#222536] hover:border-theme-gold/50'} cursor-pointer shadow-xl transition-all active:scale-[0.99] relative overflow-hidden group">
                    <!-- Top Series & Status -->
                    <div class="flex items-center justify-between text-[11px] pb-2.5 border-b border-[#1f2230]">
                        <span class="text-gray-400 font-bold truncate max-w-[200px] flex items-center gap-1.5">
                            <i class="fa-solid fa-trophy text-theme-gold text-[10px]"></i> ${m.series}
                        </span>
                        ${statusBadge}
                    </div>

                    <!-- Teams & Shields vs -->
                    <div class="grid grid-cols-3 items-center py-3.5 px-1">
                        <!-- Team A -->
                        <div class="flex items-center gap-3">
                            ${shieldA}
                            <div>
                                <span class="text-base font-black text-white block leading-tight tracking-wide">${m.teamA.short}</span>
                                ${m.teamA.score ? `<span class="text-[11px] font-black text-amber-300 font-mono block leading-tight">${m.teamA.score}</span>` : ''}
                                <span class="text-[10px] text-gray-400 font-medium block truncate max-w-[85px]">${m.teamA.name}</span>
                            </div>
                        </div>

                        <!-- VS Badge -->
                        <div class="text-center">
                            <span class="bg-[#171924] text-amber-400 font-black text-[11px] px-3 py-1 rounded-full border border-[#272b3c] shadow-inner">
                                VS
                            </span>
                            <span class="block text-[10px] text-gray-400 font-mono mt-1 font-bold">${m.format}</span>
                        </div>

                        <!-- Team B -->
                        <div class="flex items-center justify-end gap-3 text-right">
                            <div>
                                <span class="text-base font-black text-white block leading-tight tracking-wide">${m.teamB.short}</span>
                                ${m.teamB.score ? `<span class="text-[11px] font-black text-amber-300 font-mono block leading-tight">${m.teamB.score}</span>` : ''}
                                <span class="text-[10px] text-gray-400 font-medium block truncate max-w-[85px]">${m.teamB.name}</span>
                            </div>
                            ${shieldB}
                        </div>
                    </div>

                    <!-- Live Cricbuzz Scoreboard Banner -->
                    ${(isLive && m.liveStatus) ? `
                    <div class="mb-2 py-1 px-2.5 bg-red-950/40 border border-red-500/20 rounded-xl flex items-center justify-between text-[10px] text-red-300 font-mono">
                        <span class="flex items-center gap-1.5 truncate max-w-[80%]">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            <span class="truncate">${m.liveStatus}</span>
                        </span>
                        <span class="text-[9px] text-gray-400 font-sans font-bold flex items-center gap-1 shrink-0">
                            <i class="fa-solid fa-satellite-dish text-red-400 text-[8px]"></i> Cricbuzz Live
                        </span>
                    </div>` : ''}

                    <!-- Footer Mega Prize & Action -->
                    <div class="pt-2.5 border-t border-[#1f2230] flex items-center justify-between text-xs">
                        <div class="flex items-center gap-1.5">
                            <span class="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-yellow-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
                                <i class="fa-solid fa-crown text-[9px]"></i> MEGA PRIZE
                            </span>
                            <span class="text-theme-gold font-black font-mono text-sm">${m.megaPrize}</span>
                        </div>
                        <div class="flex items-center gap-1 text-[11px] text-emerald-400 font-black group-hover:translate-x-1 transition-transform">
                            <span>${isLive ? 'Live Arena' : 'Enter Contests'}</span>
                            <i class="fa-solid fa-chevron-right text-[10px]"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ----------------------------------------------------
    // MATCH DETAIL & CONTESTS
    // ----------------------------------------------------
    window.openCricketMatch = function (matchId) {
        initCricketSockets();
        const s = getSocket();
        if (s) {
            s.emit('get_cricket_match_detail', { matchId: matchId });
        }
        setCricSubView('detail');
    };

    function renderMatchDetailView() {
        const data = window.cricState.currentMatchData;
        if (!data || !data.match) return;
        const m = data.match;

        // Hero Stadium Banner
        const banner = document.getElementById('cricMatchBanner');
        if (banner) {
            const shieldA = getTeamShield(m.teamA.short, m.teamA.name, 'w-12 h-12');
            const shieldB = getTeamShield(m.teamB.short, m.teamB.name, 'w-12 h-12');

            banner.innerHTML = `
                <div class="flex items-center justify-between text-[11px] text-gray-400 mb-3 pb-2 border-b border-[#202332]">
                    <span class="truncate max-w-[220px] font-medium flex items-center gap-1.5">
                        <i class="fa-solid fa-stadium text-yellow-400"></i> ${m.venue}
                    </span>
                    <span class="${m.status === 'LIVE' ? 'text-red-400 font-black' : 'text-amber-400 font-bold'} font-mono">
                        ${m.status === 'LIVE' ? '🔴 LIVE IN-PLAY' : '<i class="fa-regular fa-clock"></i> ' + m.timeStr}
                    </span>
                </div>
                <div class="flex items-center justify-between px-2">
                    <div class="flex items-center gap-2.5">
                        ${shieldA}
                        <div>
                            <span class="text-base font-black text-white block leading-tight">${m.teamA.short}</span>
                            <span class="text-[10px] text-gray-400 font-medium block truncate max-w-[90px]">${m.teamA.name}</span>
                        </div>
                    </div>
                    <div class="text-center">
                        <span class="text-xs font-black text-amber-400 bg-[#161824] px-2.5 py-1 rounded-full border border-[#272b3c] shadow-inner">VS</span>
                        <span class="block text-[10px] font-mono text-gray-400 mt-0.5 font-bold">${m.format}</span>
                    </div>
                    <div class="flex items-center justify-end gap-2.5 text-right">
                        <div>
                            <span class="text-base font-black text-white block leading-tight">${m.teamB.short}</span>
                            <span class="text-[10px] text-gray-400 font-medium block truncate max-w-[90px]">${m.teamB.name}</span>
                        </div>
                        ${shieldB}
                    </div>
                </div>
            `;
        }

        // Live score arena visibility
        const arena = document.getElementById('cricLiveScoreArena');
        if (arena) {
            if (m.status === 'LIVE' || (m.liveData && m.liveData.runs > 0)) {
                arena.classList.remove('hidden');
                if (m.liveData) {
                    updateLiveScoreArena({ matchId: m.id, liveData: m.liveData, squad: m.squad });
                }
            } else {
                arena.classList.add('hidden');
            }
        }

        // Tab counts
        const teamCountEl = document.getElementById('cricMyTeamsCount');
        const contestCountEl = document.getElementById('cricMyContestsCount');
        if (teamCountEl) teamCountEl.innerText = data.myTeams ? data.myTeams.length : 0;
        if (contestCountEl) contestCountEl.innerText = data.myEntries ? data.myEntries.length : 0;

        const createBtnText = document.getElementById('cricCreateTeamBtnText');
        if (createBtnText) {
            const count = data.myTeams ? data.myTeams.length : 0;
            createBtnText.innerText = count > 0 ? `CREATE TEAM (Team ${count + 1})` : 'CREATE TEAM';
        }

        // Render Contests, Teams, Joined entries
        renderContestsList(m.contests);
        renderMyTeamsList(data.myTeams || []);
        renderMyContestsList(data.myEntries || [], m.contests);

        if (window.cricState.activeDetailTab === 'leaderboard') {
            fetchLeaderboard();
        }
    }

    function renderContestsList(contests) {
        const container = document.getElementById('cricTabContentContests');
        if (!container) return;

        if (!contests || contests.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-gray-400 text-xs">No contests available right now.</div>`;
            return;
        }

        container.innerHTML = contests.map(c => {
            const fillPct = Math.min(100, Math.round((c.filledSpots / c.totalSpots) * 100));
            const spotsLeft = Math.max(0, c.totalSpots - c.filledSpots);
            const isFull = spotsLeft <= 0;

            let tagBadge = '';
            let borderStyle = 'border-[#222536]';
            if (c.tag === 'MEGA') {
                tagBadge = `<span class="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">🔥 MEGA CONTEST</span>`;
                borderStyle = 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]';
            } else if (c.tag === '1v1') {
                tagBadge = `<span class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">⚡ HEAD TO HEAD</span>`;
                borderStyle = 'border-purple-500/40';
            } else {
                tagBadge = `<span class="bg-[#1b1e2c] text-amber-300 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border border-[#2b2f44]">${c.tag}</span>`;
            }

            return `
                <div class="bg-gradient-to-b from-[#141622] to-[#0d0f17] border ${borderStyle} rounded-2xl p-4 shadow-xl hover:border-theme-gold/60 transition-all">
                    <!-- Title & Tag -->
                    <div class="flex items-center justify-between mb-2.5">
                        <div class="flex items-center gap-2">
                            ${tagBadge}
                            <span class="text-xs font-black text-gray-200">${c.title}</span>
                        </div>
                        <span class="text-[11px] text-amber-400 font-bold font-mono flex items-center gap-1">
                            <i class="fa-solid fa-crown text-[9px]"></i> 1st: ₹${c.firstPrize.toLocaleString()}
                        </span>
                    </div>

                    <!-- Prize Pool & Entry Fee -->
                    <div class="flex items-center justify-between my-2.5">
                        <div>
                            <span class="text-[9px] text-gray-400 uppercase tracking-widest block font-black">Prize Pool</span>
                            <span class="text-xl font-black text-theme-gold font-mono tracking-tight">₹${c.prizePool.toLocaleString()}</span>
                        </div>
                        <div>
                            <button onclick="promptJoinContest('${c.id}')" ${isFull ? 'disabled' : ''} class="${isFull ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-green-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'} font-black text-xs px-5 py-2.5 rounded-xl active:scale-95 transition-all flex items-center gap-1.5">
                                <span>${isFull ? 'FULL' : '₹' + c.entryFee}</span>
                                ${!isFull ? '<i class="fa-solid fa-arrow-right text-[10px]"></i>' : ''}
                            </button>
                        </div>
                    </div>

                    <!-- Progress Bar (Spots) -->
                    <div class="mt-3">
                        <div class="w-full bg-[#0a0b12] rounded-full h-1.5 overflow-hidden border border-[#1e2130]">
                            <div class="bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-500 h-1.5 rounded-full transition-all" style="width: ${fillPct}%"></div>
                        </div>
                        <div class="flex items-center justify-between text-[10px] text-gray-400 font-bold mt-1.5">
                            <span class="${spotsLeft < 10 ? 'text-red-400' : 'text-emerald-400'} font-mono">${spotsLeft} spots left</span>
                            <span class="font-mono text-gray-500">${c.totalSpots} spots</span>
                        </div>
                    </div>

                    <!-- Perks & Prize Breakdown Row -->
                    ${(c.prizes && c.prizes.length > 0) ? `
                    <div class="mt-2 pt-2 border-t border-[#1a1c2a] flex items-center gap-1.5 flex-wrap">
                        <span class="text-[9px] text-gray-500 font-bold uppercase">Prizes:</span>
                        ${c.prizes.map(p => `<span class="bg-[#181c2b] text-amber-300 font-bold px-2 py-0.5 rounded text-[10px] border border-[#282f48]">Rank #${p.rank}: ₹${p.amount}</span>`).join(' ')}
                    </div>
                    ` : ''}

                    <div class="mt-2 pt-2 border-t border-[#1a1c2a] flex items-center justify-between text-[10px] text-gray-400 font-medium">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-trophy text-amber-400"></i> ${(c.prizes && c.prizes.length > 1) ? c.prizes.length + ' Winners' : '1 Winner Takes All'}</span>
                        <span class="flex items-center gap-1"><i class="fa-solid fa-shield-check text-emerald-400"></i> Guaranteed Payout</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderMyTeamsList(teams) {
        const container = document.getElementById('cricTabContentMyTeams');
        if (!container) return;

        if (!teams || teams.length === 0) {
            container.innerHTML = `
                <div class="bg-[#12141c] rounded-2xl p-8 text-center border border-[#212433]">
                    <i class="fa-solid fa-shirt text-3xl text-gray-600 mb-2"></i>
                    <p class="text-xs font-bold text-gray-300">You haven't created any team yet</p>
                    <button onclick="openTeamBuilder()" class="mt-3 bg-gradient-to-r from-emerald-500 to-green-600 text-black font-black text-xs px-5 py-2.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        CREATE YOUR FIRST TEAM
                    </button>
                </div>
            `;
            return;
        }

        const match = window.cricState.currentMatch;
        container.innerHTML = teams.map(t => {
            const capPlayer = match && match.squad ? match.squad.find(p => p.id === t.captainId) : null;
            const vcPlayer = match && match.squad ? match.squad.find(p => p.id === t.viceCaptainId) : null;

            return `
                <div class="bg-gradient-to-b from-[#141622] to-[#0e1017] border border-[#242738] rounded-2xl p-4 shadow-xl relative overflow-hidden">
                    <div class="flex items-center justify-between pb-2.5 border-b border-[#1f2230]">
                        <span class="text-xs font-black text-white flex items-center gap-1.5">
                            <i class="fa-solid fa-shield text-theme-gold"></i> ${t.teamName}
                        </span>
                        <span class="text-[10px] text-gray-400 font-mono">${t.createdDate}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-3 py-3">
                        <div class="bg-[#0b0c12] p-2.5 rounded-xl border border-[#1f2230] flex items-center gap-2">
                            <span class="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black text-xs flex items-center justify-center shadow">C</span>
                            <div class="truncate">
                                <span class="text-[9px] text-gray-400 block font-bold uppercase">Captain (2x)</span>
                                <span class="text-xs font-black text-white truncate block">${capPlayer ? capPlayer.name : 'Captain'}</span>
                            </div>
                        </div>

                        <div class="bg-[#0b0c12] p-2.5 rounded-xl border border-[#1f2230] flex items-center gap-2">
                            <span class="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-black text-xs flex items-center justify-center shadow">VC</span>
                            <div class="truncate">
                                <span class="text-[9px] text-gray-400 block font-bold uppercase">Vice-Captain (1.5x)</span>
                                <span class="text-xs font-black text-white truncate block">${vcPlayer ? vcPlayer.name : 'Vice-Captain'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between pt-2.5 border-t border-[#1f2230] text-[11px]">
                        <span class="text-gray-400 font-mono">Credits: <b class="text-theme-gold">${t.totalCredits}/100</b></span>
                        <div class="flex items-center gap-3">
                            <button onclick="editSavedTeam('${t.id}')" class="text-amber-400 font-black flex items-center gap-1.5 hover:underline">
                                <i class="fa-solid fa-pen-to-square text-xs"></i> Edit
                            </button>
                            <button onclick="previewSavedTeam('${t.id}')" class="text-emerald-400 font-black flex items-center gap-1.5 hover:underline">
                                <i class="fa-solid fa-eye text-xs"></i> Pitch Preview
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderMyContestsList(entries, contests) {
        const container = document.getElementById('cricTabContentMyContests');
        if (!container) return;

        if (!entries || entries.length === 0) {
            container.innerHTML = `
                <div class="bg-[#12141c] rounded-2xl p-8 text-center border border-[#212433]">
                    <i class="fa-solid fa-trophy text-3xl text-gray-600 mb-2"></i>
                    <p class="text-xs font-bold text-gray-300">No Joined Contests</p>
                    <p class="text-[11px] text-gray-500 mt-1">Join a contest to compete on the leaderboard!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = entries.map(e => {
            const contest = contests ? (contests.find(c => c.id === e.contestId) || { title: 'Fantasy Contest', prizePool: 0, firstPrize: 0 }) : { title: 'Fantasy Contest', prizePool: 0, firstPrize: 0 };
            return `
                <div class="bg-gradient-to-b from-[#141622] to-[#0e1017] border border-emerald-500/40 rounded-2xl p-4 shadow-xl">
                    <div class="flex items-center justify-between pb-2 border-b border-[#1f2230]">
                        <span class="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-check"></i> JOINED ENTRY
                        </span>
                        <span class="text-[10px] text-gray-400 font-mono">${e.date}</span>
                    </div>

                    <div class="py-2.5">
                        <h4 class="text-xs font-black text-white">${contest.title}</h4>
                        <div class="flex items-center justify-between mt-1 text-xs">
                            <span class="text-gray-400">Entry: <b class="text-white font-mono">₹${e.entryFee}</b></span>
                            <span class="text-theme-gold font-black font-mono">1st: ₹${contest.firstPrize.toLocaleString()}</span>
                        </div>
                    </div>

                    <div class="pt-2 border-t border-[#1f2230] flex items-center justify-between text-[11px] text-gray-400">
                        <span>Entry ID: <b class="font-mono text-gray-300">${e.id.substr(0, 14)}...</b></span>
                        <button onclick="switchCricDetailTab('leaderboard'); fetchLeaderboard('${e.contestId}');" class="text-yellow-400 font-black hover:underline flex items-center gap-1">
                            <span>View Leaderboard</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ----------------------------------------------------
    // TAB SWITCHING & LEADERBOARD HANDLING
    // ----------------------------------------------------
    window.switchCricDetailTab = function (tab) {
        if (window.cricAudio) window.cricAudio.play('click');
        window.cricState.activeDetailTab = tab;

        const tabContests = document.getElementById('cricTabContests');
        const tabLeaderboard = document.getElementById('cricTabLeaderboard');
        const tabMyTeams = document.getElementById('cricTabMyTeams');
        const tabMyContests = document.getElementById('cricTabMyContests');

        const contentContests = document.getElementById('cricTabContentContests');
        const contentLeaderboard = document.getElementById('cricTabContentLeaderboard');
        const contentMyTeams = document.getElementById('cricTabContentMyTeams');
        const contentMyContests = document.getElementById('cricTabContentMyContests');

        const allTabs = [
            { btn: tabContests, cnt: contentContests, key: 'contests' },
            { btn: tabLeaderboard, cnt: contentLeaderboard, key: 'leaderboard' },
            { btn: tabMyTeams, cnt: contentMyTeams, key: 'myteams' },
            { btn: tabMyContests, cnt: contentMyContests, key: 'mycontests' }
        ];

        allTabs.forEach(t => {
            if (t.btn) {
                if (t.key === tab) {
                    t.btn.className = 'py-2.5 text-xs font-black text-theme-gold border-b-2 border-theme-gold flex items-center justify-center gap-1';
                } else {
                    t.btn.className = 'py-2.5 text-xs font-bold text-gray-400 hover:text-white flex items-center justify-center gap-1';
                }
            }
            if (t.cnt) {
                if (t.key === tab) {
                    t.cnt.classList.remove('hidden');
                } else {
                    t.cnt.classList.add('hidden');
                }
            }
        });

        if (tab === 'leaderboard') {
            fetchLeaderboard();
        }
    };

    window.fetchLeaderboard = function (contestId) {
        if (window.cricAudio) window.cricAudio.play('click');
        const match = window.cricState.currentMatch;
        if (!match) return;

        if (contestId) {
            window.cricState.selectedContestId = contestId;
        } else if (!window.cricState.selectedContestId && match.contests && match.contests.length > 0) {
            window.cricState.selectedContestId = match.contests[0].id;
        }

        const s = getSocket();
        if (s) {
            s.emit('get_cricket_leaderboard', {
                matchId: match.id,
                contestId: window.cricState.selectedContestId
            });
        }
    };

    function renderLeaderboard(data) {
        if (!data) return;
        const match = window.cricState.currentMatch;
        if (!match || match.id !== data.matchId) return;

        // Cache participants for click-to-inspect
        window.cricState.currentLeaderboardParticipants = data.participants || [];

        // 1. Contest Chips
        const chipsContainer = document.getElementById('cricLbContestChips');
        if (chipsContainer && match.contests) {
            chipsContainer.innerHTML = match.contests.map(c => {
                const isActive = c.id === data.contestId;
                return `
                    <button onclick="fetchLeaderboard('${c.id}')"
                            class="whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs transition-all ${isActive ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black shadow-lg scale-102' : 'bg-[#141622] text-gray-300 font-bold border border-[#222536] hover:text-white'}">
                        ${c.title}
                    </button>
                `;
            }).join('');
        }

        // 2. Prize Showcase Card
        const prizePoolEl = document.getElementById('cricLbPrizePool');
        const firstPrizeEl = document.getElementById('cricLb1stPrize');
        const secondPrizeEl = document.getElementById('cricLb2ndPrize');
        const thirdPrizeEl = document.getElementById('cricLb3rdPrize');

        if (prizePoolEl) prizePoolEl.innerText = `₹${data.prizePool.toLocaleString()}`;
        if (firstPrizeEl) firstPrizeEl.innerText = `₹${data.firstPrize.toLocaleString()}`;
        if (secondPrizeEl) secondPrizeEl.innerText = `₹${Math.round(data.firstPrize * 0.4).toLocaleString()}`;
        if (thirdPrizeEl) thirdPrizeEl.innerText = `₹${Math.round(data.firstPrize * 0.2).toLocaleString()}`;

        // 3. User Standing Box
        const userBox = document.getElementById('cricLbUserStandingBox');
        if (userBox) {
            if (data.userStanding) {
                userBox.classList.remove('hidden');
                const uTeam = document.getElementById('cricLbUserTeamName');
                const uCapVc = document.getElementById('cricLbUserCapVc');
                const uPts = document.getElementById('cricLbUserPoints');
                const uWin = document.getElementById('cricLbUserWinning');

                if (uTeam) uTeam.innerText = data.userStanding.teamName || 'Your Team';
                if (uCapVc) uCapVc.innerText = `C: ${data.userStanding.capName} • VC: ${data.userStanding.vcName}`;
                if (uPts) uPts.innerText = `${data.userStanding.points} pts`;
                if (uWin) {
                    uWin.innerText = data.userStanding.winningAmt > 0 ? `Won: ₹${data.userStanding.winningAmt.toLocaleString()}` : 'In Play';
                }

                const liveTeamName = document.getElementById('cricUserLiveTeamName');
                const livePoints = document.getElementById('cricUserLivePoints');
                const liveRank = document.getElementById('cricUserLiveRank');

                if (liveTeamName) liveTeamName.innerText = data.userStanding.teamName;
                if (livePoints) livePoints.innerText = `Points: ${data.userStanding.points} pts`;
                if (liveRank) {
                    const r = data.userStanding.rank;
                    liveRank.innerText = `Rank #${r} ${r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : ''}`;
                }
            } else {
                userBox.classList.add('hidden');
            }
        }

        // 4. Participants Table
        const totalTeamsEl = document.getElementById('cricLbTotalTeams');
        if (totalTeamsEl) totalTeamsEl.innerText = data.participants ? data.participants.length : 0;

        const listContainer = document.getElementById('cricLbParticipantsList');
        if (!listContainer) return;

        if (!data.participants || data.participants.length === 0) {
            listContainer.innerHTML = `<div class="p-8 text-center text-gray-500">No participants yet. Be the first to join!</div>`;
            return;
        }

        listContainer.innerHTML = data.participants.map(p => {
            let rankBadge = '';
            if (p.rank === 1) {
                rankBadge = `<span class="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-black font-black text-xs flex items-center justify-center shadow-md border border-yellow-300">1</span>`;
            } else if (p.rank === 2) {
                rankBadge = `<span class="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-black font-black text-xs flex items-center justify-center shadow-md border border-slate-300">2</span>`;
            } else if (p.rank === 3) {
                rankBadge = `<span class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black text-xs flex items-center justify-center shadow-md border border-amber-500">3</span>`;
            } else {
                rankBadge = `<span class="w-6 h-6 rounded-full bg-[#181a24] text-gray-400 font-bold text-xs flex items-center justify-center border border-[#272a3c]">#${p.rank}</span>`;
            }

            let winningBadge = '';
            if (p.winningAmt > 0) {
                winningBadge = `<span class="text-xs font-black text-emerald-400 font-mono">₹${p.winningAmt.toLocaleString()}</span>`;
            } else {
                winningBadge = `<span class="text-[10px] text-gray-500 font-bold">-</span>`;
            }

            return `
                <div onclick="previewParticipantTeam('${p.id}', '${p.teamId || ''}')"
                     class="p-3 flex items-center justify-between cursor-pointer hover:bg-[#161824] transition-colors ${p.isUser ? 'bg-gradient-to-r from-emerald-950/70 via-[#131622] to-[#0e1017] border-l-4 border-l-emerald-400' : ''}">
                    <!-- Rank & Info -->
                    <div class="flex items-center gap-3">
                        ${rankBadge}
                        <div>
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold ${p.isUser ? 'text-emerald-300 font-black' : 'text-white'} text-xs">${p.displayName}</span>
                                ${p.isUser ? '<span class="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.2 rounded border border-emerald-500/30">YOU</span>' : ''}
                            </div>
                            <div class="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                <span>${p.teamName}</span>
                                <span>•</span>
                                <span class="text-gray-300">C: <b>${p.capName}</b></span>
                                <span>•</span>
                                <span class="text-gray-300">VC: <b>${p.vcName}</b></span>
                            </div>
                        </div>
                    </div>

                    <!-- Points & Projected Winning -->
                    <div class="text-right">
                        <div class="text-sm font-black text-white font-mono">${p.points} pts</div>
                        <div class="mt-0.5">${winningBadge}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ----------------------------------------------------
    // LIVE TICKER & BALL-BY-BALL UPDATES
    // ----------------------------------------------------
    function updateLiveScoreArena(data) {
        if (!data || !data.liveData) return;
        const currentMatch = window.cricState.currentMatch;
        if (!currentMatch || currentMatch.id !== data.matchId) return;

        currentMatch.liveData = data.liveData;
        if (data.squad) currentMatch.squad = data.squad;

        const arena = document.getElementById('cricLiveScoreArena');
        if (arena) arena.classList.remove('hidden');

        const scoreEl = document.getElementById('cricLiveTeamScore');
        const oversEl = document.getElementById('cricLiveOvers');
        const crrEl = document.getElementById('cricLiveOverCrr');
        const commentaryEl = document.getElementById('cricLiveCommentaryText');

        if (scoreEl) scoreEl.innerText = `${data.liveData.battingTeam || 'IND'} ${data.liveData.runs}/${data.liveData.wickets}`;
        if (oversEl) oversEl.innerText = `(${data.liveData.overs}.${data.liveData.balls} Ov)`;
        if (crrEl) crrEl.innerText = `CRR: ${data.liveData.crr || '9.00'}`;
        if (commentaryEl) commentaryEl.innerText = data.liveData.lastEvent || 'Live match action in progress...';

        const ballsContainer = document.getElementById('cricRecentBallsContainer');
        if (ballsContainer && data.liveData.recentBalls) {
            const lastBall = data.liveData.recentBalls[data.liveData.recentBalls.length - 1];
            if (lastBall === '6' || lastBall === '4') {
                if (window.cricAudio) window.cricAudio.play('boundary');
            } else if (lastBall === 'W') {
                if (window.cricAudio) window.cricAudio.play('wicket');
            }

            ballsContainer.innerHTML = data.liveData.recentBalls.map(b => {
                if (b === '6') {
                    return `<span class="w-6 h-6 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs flex items-center justify-center shadow-[0_0_8px_rgba(217,70,239,0.8)] animate-bounce">6</span>`;
                } else if (b === '4') {
                    return `<span class="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-[0_0_8px_rgba(37,99,235,0.8)]">4</span>`;
                } else if (b === 'W') {
                    return `<span class="w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse">W</span>`;
                } else if (b === '0' || b === '.') {
                    return `<span class="w-6 h-6 rounded-full bg-[#1b1d28] text-gray-400 font-bold text-xs flex items-center justify-center border border-[#2b2f42]">•</span>`;
                } else {
                    return `<span class="w-6 h-6 rounded-full bg-[#1e2230] text-white font-black text-xs flex items-center justify-center border border-[#2e3448]">${b}</span>`;
                }
            }).join('');
        }

        if (window.cricState.activeDetailTab === 'leaderboard') {
            fetchLeaderboard();
        }
    }

    // ----------------------------------------------------
    // WINNER CELEBRATION MODAL TRIGGER
    // ----------------------------------------------------
    function triggerWinnerCelebration(data) {
        if (!data) return;

        const modal = document.getElementById('cricWinnerModal');
        if (!modal) return;

        const matchTitleEl = document.getElementById('cricWinnerMatchTitle');
        const amountEl = document.getElementById('cricWinnerAmount');
        const rankEl = document.getElementById('cricWinnerRank');
        const pointsEl = document.getElementById('cricWinnerPoints');

        if (matchTitleEl) matchTitleEl.innerText = `${data.matchTitle} • ${data.contestTitle || 'Mega Contest'}`;
        if (amountEl) amountEl.innerText = `+₹${data.amount.toLocaleString()}`;
        if (rankEl) {
            rankEl.innerText = `Rank #${data.rank} ${data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : '🎖️'}`;
        }
        if (pointsEl) pointsEl.innerText = `${data.points} Pts`;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        launchCricConfetti();
        if (window.cricAudio) window.cricAudio.play('win');

        if (typeof updateBalanceUI === 'function' && data.newBalance !== undefined) {
            updateBalanceUI(data.newBalance);
        }

        const s = getSocket();
        if (s) {
            s.emit('get_profile');
        }
    }

    window.closeCricketWinnerModal = function () {
        stopCricConfetti();
        const modal = document.getElementById('cricWinnerModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        if (window.cricState.currentMatch) {
            openCricketMatch(window.cricState.currentMatch.id);
        }
    };

    // ----------------------------------------------------
    // TEAM BUILDER LOGIC (Dream11 AAA Player Cards)
    // ----------------------------------------------------
    window.openTeamBuilder = function () {
        if (window.cricAudio) window.cricAudio.play('click');
        window.cricState.editingTeamId = null;
        window.cricState.selectedPlayerIds = [];
        window.cricState.selectedCaptainId = null;
        window.cricState.selectedViceCaptainId = null;
        window.cricState.currentActiveRole = 'WK';
        setCricSubView('builder');
        switchCricRole('WK');
        renderTeamBuilderUI();

        const proceedBtn = document.getElementById('cricProceedCapVcBtn');
        if (proceedBtn) {
            proceedBtn.innerHTML = `<span>PROCEED TO C / VC</span> <i class="fa-solid fa-arrow-right text-xs"></i>`;
        }
    };

    window.editSavedTeam = function (teamId) {
        if (window.cricAudio) window.cricAudio.play('click');
        const data = window.cricState.currentMatchData;
        if (!data || !data.myTeams) return;
        const team = data.myTeams.find(t => t.id === teamId);
        if (!team) return;

        window.cricState.editingTeamId = team.id;
        window.cricState.selectedPlayerIds = [...(team.playerIds || [])];
        window.cricState.selectedCaptainId = team.captainId;
        window.cricState.selectedViceCaptainId = team.viceCaptainId;
        window.cricState.currentActiveRole = 'WK';

        setCricSubView('builder');
        switchCricRole('WK');
        renderTeamBuilderUI();

        const proceedBtn = document.getElementById('cricProceedCapVcBtn');
        if (proceedBtn) {
            proceedBtn.innerHTML = `<span>UPDATE C / VC &amp; SAVE</span> <i class="fa-solid fa-arrow-right text-xs"></i>`;
        }

        if (typeof showToast === 'function') {
            showToast(`Editing ${team.teamName}. Modify squad and tap Update!`, 'info');
        }
    };

    window.switchCricRole = function (role) {
        window.cricState.currentActiveRole = role;
        const roles = ['WK', 'BAT', 'AR', 'BOWL'];
        roles.forEach(r => {
            const tab = document.getElementById(`cricRoleTab${r}`);
            if (tab) {
                if (r === role) {
                    tab.className = 'py-2.5 text-xs font-black text-theme-gold border-b-2 border-theme-gold flex items-center justify-center gap-1';
                } else {
                    tab.className = 'py-2.5 text-xs font-bold text-gray-400 hover:text-white flex items-center justify-center gap-1';
                }
            }
        });

        const guideText = document.getElementById('cricRoleGuideText');
        if (guideText) {
            const info = ROLE_LIMITS[role];
            guideText.innerHTML = `<i class="fa-solid fa-circle-info text-yellow-400 text-[10px]"></i> Select ${info.min} - ${info.max} ${info.name}s`;
        }

        renderPlayersList();
    };

    window.toggleCricketPlayer = function (playerId) {
        const match = window.cricState.currentMatch;
        if (!match) return;
        const player = match.squad.find(p => p.id === playerId);
        if (!player) return;

        const sel = window.cricState.selectedPlayerIds;
        const idx = sel.indexOf(playerId);

        if (idx !== -1) {
            sel.splice(idx, 1);
            if (window.cricState.selectedCaptainId === playerId) window.cricState.selectedCaptainId = null;
            if (window.cricState.selectedViceCaptainId === playerId) window.cricState.selectedViceCaptainId = null;
        } else {
            if (sel.length >= 11) {
                if (typeof showToast === 'function') showToast('Already selected 11 players!', 'error');
                return;
            }

            const curCredits = sel.reduce((sum, id) => {
                const p = match.squad.find(x => x.id === id);
                return sum + (p ? p.credits : 0);
            }, 0);

            if (curCredits + player.credits > 100.0) {
                if (typeof showToast === 'function') showToast('Credits limit exceeded (Max 100 Cr)!', 'error');
                return;
            }

            const teamCount = sel.filter(id => {
                const p = match.squad.find(x => x.id === id);
                return p && p.team === player.team;
            }).length;

            if (teamCount >= 7) {
                if (typeof showToast === 'function') showToast(`Max 7 players allowed from ${player.team}!`, 'error');
                return;
            }

            const roleCount = sel.filter(id => {
                const p = match.squad.find(x => x.id === id);
                return p && p.role === player.role;
            }).length;

            if (roleCount >= ROLE_LIMITS[player.role].max) {
                if (typeof showToast === 'function') showToast(`Max ${ROLE_LIMITS[player.role].max} ${ROLE_LIMITS[player.role].name}s allowed!`, 'error');
                return;
            }

            sel.push(playerId);
        }

        renderTeamBuilderUI();
    };

    function renderTeamBuilderUI() {
        const match = window.cricState.currentMatch;
        if (!match) return;
        const sel = window.cricState.selectedPlayerIds;

        // Team counts
        const teamACount = sel.filter(id => {
            const p = match.squad.find(x => x.id === id);
            return p && p.team === match.teamA.short;
        }).length;
        const teamBCount = sel.filter(id => {
            const p = match.squad.find(x => x.id === id);
            return p && p.team === match.teamB.short;
        }).length;

        const badgeA = document.getElementById('cricTeamACountBadge');
        const badgeB = document.getElementById('cricTeamBCountBadge');
        if (badgeA) badgeA.innerText = `${match.teamA.short}: ${teamACount}`;
        if (badgeB) badgeB.innerText = `${match.teamB.short}: ${teamBCount}`;

        // Credits calculation
        const usedCredits = sel.reduce((sum, id) => {
            const p = match.squad.find(x => x.id === id);
            return sum + (p ? p.credits : 0);
        }, 0);
        const leftCredits = (100.0 - usedCredits).toFixed(1);
        const credDisplay = document.getElementById('cricCreditsLeftDisplay');
        if (credDisplay) {
            credDisplay.innerHTML = `<i class="fa-solid fa-coins text-yellow-400 text-xs"></i> ${leftCredits} / 100`;
        }

        // 11 Glowing Slots Indicator
        const dotsContainer = document.getElementById('cricPlayerDotsContainer');
        if (dotsContainer) {
            let dotsHtml = '';
            for (let i = 0; i < 11; i++) {
                if (i < sel.length) {
                    const p = match.squad.find(x => x.id === sel[i]);
                    const isTeamA = p && p.team === match.teamA.short;
                    dotsHtml += `
                        <span class="w-4 h-3 rounded-md ${isTeamA ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-[0_0_8px_rgba(37,99,235,0.8)]' : 'bg-gradient-to-tr from-amber-400 to-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'} flex items-center justify-center text-[7px] text-black font-black">
                            ✓
                        </span>`;
                } else {
                    dotsHtml += `<span class="w-4 h-3 rounded-md bg-[#1c1f2b] border border-[#2b2f42]"></span>`;
                }
            }
            dotsContainer.innerHTML = dotsHtml;
        }

        const countDisplay = document.getElementById('cricPlayerCountDisplay');
        if (countDisplay) countDisplay.innerText = `${sel.length}/11`;

        // Role tab counts
        ['WK', 'BAT', 'AR', 'BOWL'].forEach(r => {
            const c = sel.filter(id => {
                const p = match.squad.find(x => x.id === id);
                return p && p.role === r;
            }).length;
            const el = document.getElementById(`cricCount${r}`);
            if (el) el.innerText = c;
        });

        // Validation for NEXT button
        const wkCount = sel.filter(id => { const p = match.squad.find(x => x.id === id); return p && p.role === 'WK'; }).length;
        const batCount = sel.filter(id => { const p = match.squad.find(x => x.id === id); return p && p.role === 'BAT'; }).length;
        const arCount = sel.filter(id => { const p = match.squad.find(x => x.id === id); return p && p.role === 'AR'; }).length;
        const bowlCount = sel.filter(id => { const p = match.squad.find(x => x.id === id); return p && p.role === 'BOWL'; }).length;

        const isValid = sel.length === 11 &&
            wkCount >= 1 && batCount >= 3 && arCount >= 1 && bowlCount >= 3 &&
            usedCredits <= 100.0 &&
            teamACount <= 7 && teamBCount <= 7;

        const nextBtn = document.getElementById('cricProceedCapVcBtn');
        if (nextBtn) {
            nextBtn.disabled = !isValid;
        }

        renderPlayersList();
    }

    // ----------------------------------------------------
    // PROFESSIONAL DREAM11 PLAYER CARDS (Replaces boring letter circles)
    // ----------------------------------------------------
    function renderPlayersList() {
        const match = window.cricState.currentMatch;
        if (!match) return;
        const container = document.getElementById('cricPlayersListContainer');
        if (!container) return;

        const role = window.cricState.currentActiveRole;
        const players = match.squad.filter(p => p.role === role);
        const sel = window.cricState.selectedPlayerIds;

        container.innerHTML = players.map(p => {
            const isSelected = sel.includes(p.id);
            const isTeamA = p.team === match.teamA.short;
            const jerseySvg = getJerseySvg(p.team, 40);

            return `
                <div onclick="toggleCricketPlayer('${p.id}')"
                     class="flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-gradient-to-r from-emerald-950/70 via-[#151922] to-[#12141c] border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] scale-[1.01]' : 'bg-[#13151f] border border-[#232635] hover:border-amber-500/50 hover:bg-[#171926]'}">
                    
                    <!-- Left: Realistic 3D Jersey & Player Info -->
                    <div class="flex items-center gap-3">
                        <div class="relative flex-shrink-0">
                            ${jerseySvg}
                            <span class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black shadow" title="In Playing 11"></span>
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-black ${isSelected ? 'text-emerald-300' : 'text-white'} tracking-wide">${p.name}</span>
                                <span class="text-[9px] font-black px-1.5 py-0.2 rounded ${isTeamA ? 'bg-blue-950 text-blue-300 border border-blue-500/40' : 'bg-amber-950 text-yellow-300 border border-yellow-500/40'}">${p.team}</span>
                                <span class="text-[9px] font-bold text-gray-400 bg-[#1c1e2b] px-1.5 py-0.2 rounded border border-[#2c3044]">${p.role}</span>
                            </div>
                            <div class="text-[10px] text-gray-400 font-medium flex items-center gap-2 mt-1">
                                <span>Sel by <b class="text-gray-200 font-bold">${p.selPct}%</b></span>
                                <span>•</span>
                                <span>Points: <b class="text-emerald-400 font-mono font-bold">${p.points}</b></span>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Credits & Radiant Toggle Button -->
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <span class="text-xs font-black text-theme-gold font-mono block">${p.credits.toFixed(1)} Cr</span>
                        </div>
                        <div class="w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-105' : 'bg-[#1e202d] text-amber-400 border border-[#2f3246] hover:border-amber-400'}">
                            <i class="fa-solid ${isSelected ? 'fa-check text-sm font-black' : 'fa-plus text-xs'}"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ----------------------------------------------------
    // CAPTAIN & VICE-CAPTAIN SELECTOR
    // ----------------------------------------------------
    window.proceedToCapVc = function () {
        if (window.cricState.selectedPlayerIds.length !== 11) {
            if (typeof showToast === 'function') showToast('Please select exactly 11 players first!', 'error');
            return;
        }
        setCricSubView('capvc');
        renderCapVcList();
    };

    window.backToTeamBuilder = function () {
        setCricSubView('builder');
    };

    function renderCapVcList() {
        const match = window.cricState.currentMatch;
        if (!match) return;
        const container = document.getElementById('cricCapVcListContainer');
        if (!container) return;

        const selIds = window.cricState.selectedPlayerIds;
        const players = match.squad.filter(p => selIds.includes(p.id));

        container.innerHTML = players.map(p => {
            const isCap = window.cricState.selectedCaptainId === p.id;
            const isVc = window.cricState.selectedViceCaptainId === p.id;
            const jerseySvg = getJerseySvg(p.team, 34);

            return `
                <div class="flex items-center justify-between p-3 rounded-2xl bg-[#13151f] border border-[#232635] shadow-md">
                    <div class="flex items-center gap-3">
                        ${jerseySvg}
                        <div>
                            <span class="text-xs font-black text-white block leading-tight">${p.name}</span>
                            <span class="text-[10px] text-gray-400 font-medium">${p.role} • ${p.team} • <b class="text-amber-400">${p.credits} Cr</b></span>
                        </div>
                    </div>

                    <!-- Captain & Vice Captain Buttons -->
                    <div class="flex items-center gap-2">
                        <button onclick="selectCaptain('${p.id}')"
                                class="px-3 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1 ${isCap ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.7)] scale-105' : 'bg-[#1e202d] text-gray-400 hover:text-white border border-[#2b2f42]'}">
                            <span>👑 C</span>
                            <span class="text-[9px] opacity-80">(2x)</span>
                        </button>
                        <button onclick="selectViceCaptain('${p.id}')"
                                class="px-3 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1 ${isVc ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)] scale-105' : 'bg-[#1e202d] text-gray-400 hover:text-white border border-[#2b2f42]'}">
                            <span>⭐ VC</span>
                            <span class="text-[9px] opacity-80">(1.5x)</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        updateSaveTeamBtnState();
    }

    window.selectCaptain = function (playerId) {
        if (window.cricAudio) window.cricAudio.play('click');
        if (window.cricState.selectedCaptainId === playerId) {
            window.cricState.selectedCaptainId = null;
        } else {
            window.cricState.selectedCaptainId = playerId;
            if (window.cricState.selectedViceCaptainId === playerId) {
                window.cricState.selectedViceCaptainId = null;
            }
        }
        renderCapVcList();
    };

    window.selectViceCaptain = function (playerId) {
        if (window.cricAudio) window.cricAudio.play('click');
        if (window.cricState.selectedViceCaptainId === playerId) {
            window.cricState.selectedViceCaptainId = null;
        } else {
            window.cricState.selectedViceCaptainId = playerId;
            if (window.cricState.selectedCaptainId === playerId) {
                window.cricState.selectedCaptainId = null;
            }
        }
        renderCapVcList();
    };

    function updateSaveTeamBtnState() {
        const canSave = window.cricState.selectedCaptainId &&
            window.cricState.selectedViceCaptainId &&
            window.cricState.selectedCaptainId !== window.cricState.selectedViceCaptainId;

        const btn = document.getElementById('cricSaveTeamBtn');
        if (btn) btn.disabled = !canSave;
    }

    window.submitCricketTeam = function () {
        const s = getSocket();
        if (!s) return;
        const match = window.cricState.currentMatch;
        if (!match) return;

        if (window.cricAudio) window.cricAudio.play('coin');

        s.emit('save_cricket_team', {
            matchId: match.id,
            teamId: window.cricState.editingTeamId || undefined,
            playerIds: window.cricState.selectedPlayerIds,
            captainId: window.cricState.selectedCaptainId,
            viceCaptainId: window.cricState.selectedViceCaptainId
        });
    };

    // ----------------------------------------------------
    // CONTEST JOIN MODAL
    // ----------------------------------------------------
    window.promptJoinContest = function (contestId) {
        if (window.cricAudio) window.cricAudio.play('click');
        const data = window.cricState.currentMatchData;
        if (!data || !data.match) return;
        const contest = data.match.contests.find(c => c.id === contestId);
        if (!contest) return;

        if (!data.myTeams || data.myTeams.length === 0) {
            if (confirm('You need to create an 11-player team before joining a contest! Would you like to create one now?')) {
                openTeamBuilder();
            }
            return;
        }

        window.cricState.selectedContest = contest;
        const modal = document.getElementById('cricJoinModal');
        if (!modal) return;

        document.getElementById('cricModalContestTitle').innerText = contest.title;
        document.getElementById('cricModalEntryFee').innerText = `₹${contest.entryFee}`;
        document.getElementById('cricModalPrizePool').innerText = `₹${contest.prizePool.toLocaleString()}`;

        const select = document.getElementById('cricModalTeamSelect');
        if (select) {
            select.innerHTML = data.myTeams.map(t => `<option value="${t.id}">${t.teamName} (${t.totalCredits} Cr)</option>`).join('');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    window.closeCricketJoinModal = function () {
        const modal = document.getElementById('cricJoinModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };

    window.confirmJoinContest = function () {
        const s = getSocket();
        if (!s) return;
        const match = window.cricState.currentMatch;
        const contest = window.cricState.selectedContest;
        const select = document.getElementById('cricModalTeamSelect');
        if (!match || !contest || !select) return;

        const teamId = select.value;
        if (!teamId) {
            if (typeof showToast === 'function') showToast('Please select a team!', 'error');
            return;
        }

        if (window.cricAudio) window.cricAudio.play('coin');

        s.emit('join_cricket_contest', {
            matchId: match.id,
            contestId: contest.id,
            teamId: teamId
        });
    };

    // ----------------------------------------------------
    // 3D VIRTUAL STADIUM PITCH PREVIEW
    // ----------------------------------------------------
    window.openPitchPreviewModal = function () {
        if (window.cricAudio) window.cricAudio.play('click');
        const match = window.cricState.currentMatch;
        if (!match) return;
        const selIds = window.cricState.selectedPlayerIds;
        if (selIds.length === 0) {
            if (typeof showToast === 'function') showToast('Select some players to preview!', 'error');
            return;
        }

        renderPitchModal(selIds, window.cricState.selectedCaptainId, window.cricState.selectedViceCaptainId, 'Team Preview');
    };

    window.previewSavedTeam = function (teamId) {
        if (window.cricAudio) window.cricAudio.play('click');
        const data = window.cricState.currentMatchData;
        if (!data || !data.myTeams) return;
        const team = data.myTeams.find(t => t.id === teamId);
        if (!team) return;

        renderPitchModal(team.playerIds, team.captainId, team.viceCaptainId, team.teamName);
    };

    window.previewParticipantTeam = function (participantId, teamId) {
        if (window.cricAudio) window.cricAudio.play('click');
        const data = window.cricState.currentMatchData;
        const match = window.cricState.currentMatch;
        if (!match) return;

        if (teamId && data && data.myTeams) {
            const myTeam = data.myTeams.find(t => t.id === teamId);
            if (myTeam) {
                renderPitchModal(myTeam.playerIds, myTeam.captainId, myTeam.viceCaptainId, `${myTeam.teamName} (Your Squad)`);
                return;
            }
        }

        // Check leaderboard cached participants
        const participants = window.cricState.currentLeaderboardParticipants || [];
        const p = participants.find(x => x.id === participantId);
        if (p && p.playerIds && p.playerIds.length === 11) {
            renderPitchModal(p.playerIds, p.captainId, p.viceCaptainId, `${p.displayName} (${p.teamName})`);
            return;
        }

        const squad = match.squad || [];
        const wks = squad.filter(p => p.role === 'WK').slice(0, 1);
        const bats = squad.filter(p => p.role === 'BAT').slice(0, 4);
        const ars = squad.filter(p => p.role === 'AR').slice(0, 2);
        const bowls = squad.filter(p => p.role === 'BOWL').slice(0, 4);
        const selSquad = [...wks, ...bats, ...ars, ...bowls];
        const cap = selSquad[1] ? selSquad[1].id : (selSquad[0] ? selSquad[0].id : null);
        const vc = selSquad[5] ? selSquad[5].id : (selSquad[2] ? selSquad[2].id : null);

        renderPitchModal(selSquad.map(p => p.id), cap, vc, 'Opponent Team Preview');
    };

    function renderPitchModal(playerIds, capId, vcId, title) {
        const match = window.cricState.currentMatch;
        if (!match) return;
        const modal = document.getElementById('cricPitchModal');
        if (!modal) return;

        const titleEl = document.getElementById('cricPitchModalTitle');
        if (titleEl) titleEl.innerText = title;

        const squad = match.squad.filter(p => playerIds.includes(p.id));
        const wks = squad.filter(p => p.role === 'WK');
        const bats = squad.filter(p => p.role === 'BAT');
        const ars = squad.filter(p => p.role === 'AR');
        const bowls = squad.filter(p => p.role === 'BOWL');

        function renderPitchRow(players, roleLabel, roleIcon) {
            return `
                <div class="text-center my-3 relative">
                    <span class="inline-block text-[9px] font-black uppercase tracking-widest text-emerald-100 bg-black/60 px-3 py-0.5 rounded-full border border-emerald-500/30 mb-2 shadow">
                        ${roleIcon} ${roleLabel}
                    </span>
                    <div class="flex items-center justify-center gap-4 flex-wrap">
                        ${players.map(p => {
                const isC = capId === p.id;
                const isVC = vcId === p.id;
                const jerseySvg = getJerseySvg(p.team, 42);

                return `
                                <div class="flex flex-col items-center group cursor-pointer">
                                    <!-- 3D Jersey Token with Badges -->
                                    <div class="relative transition-transform group-hover:scale-110">
                                        ${jerseySvg}
                                        ${isC ? `
                                            <span class="absolute -top-1.5 -right-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-lg border border-yellow-200 animate-pulse">
                                                👑 2x
                                            </span>` : ''}
                                        ${isVC ? `
                                            <span class="absolute -top-1.5 -right-2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-lg border border-blue-200">
                                                ⭐ 1.5x
                                            </span>` : ''}
                                    </div>
                                    <!-- Frosted Name Pill -->
                                    <span class="text-[10px] font-black text-white bg-black/80 px-2 py-0.5 rounded-full mt-1 border border-white/20 truncate max-w-[80px] shadow">
                                        ${p.name.split(' ').pop()}
                                    </span>
                                    <!-- Credits -->
                                    <span class="text-[9px] font-mono text-amber-300 font-bold mt-0.5">${p.credits} Cr</span>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        const pitchContent = document.getElementById('cricPitchContent');
        if (pitchContent) {
            pitchContent.innerHTML = `
                ${renderPitchRow(wks, 'Wicket-Keepers', '🧤')}
                ${renderPitchRow(bats, 'Batters', '🏏')}
                ${renderPitchRow(ars, 'All-Rounders', '⚡')}
                ${renderPitchRow(bowls, 'Bowlers', '🎯')}
            `;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    window.closePitchModal = function () {
        const modal = document.getElementById('cricPitchModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };

    window.toggleCricketRulesModal = function () {
        const modal = document.getElementById('cricRulesModal');
        if (modal) {
            modal.classList.toggle('hidden');
            modal.classList.toggle('flex');
        }
    };

})();
