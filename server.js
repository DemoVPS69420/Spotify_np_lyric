const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const querystring = require('querystring');
const open = require('open');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

dotenv.config();

// [FIX] Validate required environment variables before starting
const REQUIRED_ENV = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SP_DC'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`\n[FATAL] Missing required environment variables: ${missingEnv.join(', ')}`);
    console.error('Please check your .env file and add the missing values.\n');
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 8888;
const PHP_PORT = 8100;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

// Store tokens in memory
let accessToken = null;
let refreshToken = null;
let tokenExpirationTime = null;

// Token refresh lock — prevent concurrent refresh calls (race condition fix)
let isRefreshing = false;
let refreshPromise = null;

// OAuth state store — CSRF protection
const oauthStates = new Set();

// PHP Server Process Reference
let phpServerProcess = null;

// Helper to generate random string for state
const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

// Start PHP Server
function startPhpServer() {
    const phpDir = path.join(__dirname, 'spotify-lyrics-api-main');
    const scriptPath = 'php_server.php'; // The custom script we created
    
    console.log(`Starting PHP Server on port ${PHP_PORT}...`);
    
    // Pass SP_DC via env
    const env = { ...process.env, SP_DC: process.env.SP_DC };

    phpServerProcess = spawn('php', ['-S', `127.0.0.1:${PHP_PORT}`, scriptPath], {
        cwd: phpDir,
        env: env,
        stdio: 'inherit' // Pipe output to console for debugging
    });

    phpServerProcess.on('error', (err) => {
        console.error('Failed to start PHP server:', err.message);
    });

    phpServerProcess.on('close', (code) => {
        // [FIX] Auto-restart PHP server if it crashes unexpectedly
        // code === null means it was killed intentionally (SIGINT/exit)
        if (code !== 0 && code !== null) {
            console.warn(`PHP server crashed (exit code ${code}). Restarting in 3 seconds...`);
            setTimeout(() => {
                console.log('Restarting PHP server...');
                startPhpServer();
            }, 3000);
        } else {
            console.log(`PHP server stopped (code ${code})`);
        }
    });
}

// Ensure PHP server is killed on exit
process.on('exit', () => {
    if (phpServerProcess) phpServerProcess.kill();
});
process.on('SIGINT', () => {
    if (phpServerProcess) phpServerProcess.kill();
    process.exit();
});

// Login Route
app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    // [FIX] Store state for CSRF verification in callback
    oauthStates.add(state);
    // Auto-remove after 10 minutes to prevent memory leak
    setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);

    const scope = 'user-read-currently-playing user-read-playback-state';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            state: state
        }));
});

// Callback Route
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const returnedState = req.query.state || null;

    // [FIX] Verify OAuth state to prevent CSRF attacks
    if (!returnedState || !oauthStates.has(returnedState)) {
        console.error('OAuth state mismatch — possible CSRF attack. Rejecting callback.');
        return res.status(403).send('Authorization failed: invalid state parameter. Please try logging in again.');
    }
    oauthStates.delete(returnedState); // One-time use

    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
            }
        });

        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token;
        tokenExpirationTime = Date.now() + (response.data.expires_in * 1000);

        res.redirect('/');
    } catch (error) {
        console.error('Error in callback:', error.response ? error.response.data : error.message);
        res.send('Error logging in. Check console for details.');
    }
});

// Refresh Token Helper
const refreshAccessToken = async () => {
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
            }
        });

        accessToken = response.data.access_token;
        if (response.data.refresh_token) {
            refreshToken = response.data.refresh_token;
        }
        tokenExpirationTime = Date.now() + (response.data.expires_in * 1000);
        console.log('Token refreshed!');
    } catch (error) {
        console.error('Error refreshing token:', error.response ? error.response.data : error.message);
    }
};

// [FIX] Token refresh with lock — prevents concurrent refresh calls (race condition)
const ensureValidToken = async () => {
    if (Date.now() > tokenExpirationTime - 300000) {
        if (!isRefreshing) {
            isRefreshing = true;
            refreshPromise = refreshAccessToken().finally(() => {
                isRefreshing = false;
                refreshPromise = null;
            });
        }
        // All concurrent callers await the same single refresh promise
        await refreshPromise;
    }
};

// Now Playing API Endpoint
app.get('/api/now-playing', async (req, res) => {
    if (!accessToken) {
        return res.json({ loggedIn: false });
    }

    // [FIX] Use locked refresh to prevent race condition
    await ensureValidToken();

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });

        // [FIX] was `> 400`, should be `>= 400` to catch Bad Request (400) too
        if (response.status === 204 || response.status >= 400) {
            return res.json({ isPlaying: false });
        }

        const data = response.data;
        
        // Handle Ads or generic episodes if needed, but assuming music tracks mostly
        const item = data.item;
        
        if (!item) {
             return res.json({ isPlaying: false });
        }

        const trackData = {
            loggedIn: true,
            isPlaying: data.is_playing,
            id: item.id,
            name: item.name,
            artist: item.artists.map(artist => artist.name).join(', '),
            albumArt: item.album.images[0].url,
            progress: data.progress_ms,
            duration: item.duration_ms,
            isrc: item.external_ids ? item.external_ids.isrc : null
        };

        res.json(trackData);

    } catch (error) {
        console.error('Error fetching now playing:', error.message);
        res.json({ error: 'Failed to fetch data' });
    }
});


// Helper: Fetch Lyrics from Local PHP Server
async function fetchLyricsFromPhp(trackId) {
    try {
        const response = await axios.get(`http://127.0.0.1:${PHP_PORT}/`, {
            params: {
                trackid: trackId,
                format: 'lrc'
            },
            timeout: 10000 // Give PHP some time to generate token if needed
        });

        if (response.data && !response.data.error && response.data.lines) {
            const lines = response.data.lines;
            // Convert to LRC string
            const lrcString = lines.map(line => `[${line.timeTag}] ${line.words}`).join('\n');
            return lrcString;
        }
    } catch (error) {
        console.error('PHP API Error:', error.message);
        if (error.response && error.response.data) {
            console.error('PHP API Error Detail:', error.response.data);
        }
    }
    return null;
}

// Helper: Fetch Lyrics from YouTube Music (via Python)
function fetchLyricsFromYouTube(trackName, artistName, isrc) {
    return new Promise((resolve) => {
        const args = ['fetch_yt_lyrics.py', trackName, artistName];
        if (isrc) args.push(isrc);

        const pythonProcess = spawn('python', args);
        let dataString = '';
        let resolved = false;

        // [FIX] Kill Python process after 20 seconds to prevent hanging requests
        const processTimeout = setTimeout(() => {
            if (!resolved) {
                console.warn('Python process timed out after 20s — killing it.');
                pythonProcess.kill('SIGKILL');
                resolved = true;
                resolve(null);
            }
        }, 20000);

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            clearTimeout(processTimeout);
            if (resolved) return; // Already resolved by timeout
            resolved = true;

            if (code !== 0) {
                console.log(`Python script exited with code ${code}`);
                return resolve(null);
            }
            try {
                const result = JSON.parse(dataString);
                if (result.lyrics) {
                    resolve(result); // Return full object
                } else {
                    if (result.error) console.log(`YTM Error: ${result.error}`);
                    resolve(null);
                }
            } catch (e) {
                console.error('Failed to parse Python output:', e);
                resolve(null);
            }
        });
    });
}

// Lyrics API Endpoint
app.get('/api/lyrics', async (req, res) => {
    const { id, name, artist, duration, isrc } = req.query;

    if (!id || !name || !artist) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // [FIX] Validate id to prevent path traversal attacks (same as /api/canvas)
    if (!/^[a-zA-Z0-9]+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid track id' });
    }

    const filePath = path.join(__dirname, 'lyrics', `${id}.json`);
    const noSyncPath = path.join(__dirname, 'no_lyric_or_no_sync', `${id}.json`);

    // 1. Check local cache (Valid Lyrics)
    let cachedData = null;
    if (fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            if (data.syncedLyrics || data.plainLyrics) {
                console.log(`Cache HIT for ${id}`);
                cachedData = data;
            }
        } catch (err) {
            console.error('Error reading lyrics file:', err);
        }
    } 
    // 2. Check "No Sync/Manual" folder
    else if (fs.existsSync(noSyncPath)) {
        try {
            const fileContent = fs.readFileSync(noSyncPath, 'utf8');
            const data = JSON.parse(fileContent);
            
            // If user manually added synced lyrics to this file
            if (data.syncedLyrics && data.syncedLyrics.length > 0) {
                console.log(`User manually added lyrics for ${id}. Moving to valid cache...`);
                // Move file to main lyrics folder
                fs.renameSync(noSyncPath, filePath);
                cachedData = data;
            } else {
                console.log(`Cache HIT (No Lyrics known) for ${id}. Skipping API fetch.`);
                // Return immediately to avoid useless API calls
                return res.json(data);
            }
        } catch (err) {
            console.error('Error reading no-sync file:', err);
        }
    }
    else {
        console.log(`Cache MISS (File not found) for ${id}`);
    }

    if (cachedData) {
        console.log('Sending cached response...');
        return res.json(cachedData);
    }

    console.log('Proceeding to fetch from APIs...');

    let lyricsData = {
        syncedLyrics: null,
        plainLyrics: null
    };

    // 3. Try PHP API (Spotify Internal via PHP)
    try {
        console.log(`Fetching from PHP API (Spotify): ${name} - ${artist}`);
        const phpLyrics = await fetchLyricsFromPhp(id);
        if (phpLyrics) {
            // Validate: Check if lyrics are fake-synced (all 00:00.00)
            const lines = phpLyrics.split('\n');
            const zeroTimestamps = lines.filter(l => l.includes('[00:00.00]') || l.includes('[00:00:00]')).length;
            
            if (lines.length > 5 && zeroTimestamps > lines.length * 0.6) {
                 console.log(`PHP API returned static lyrics (${zeroTimestamps}/${lines.length} lines are 00:00). Treating as UNSYNCED.`);
                 lyricsData.plainLyrics = phpLyrics.replace(/\[.*?\]/g, '').trim();
                 lyricsData.syncedLyrics = null;
            } else {
                console.log('Found via PHP API!');
                lyricsData.syncedLyrics = phpLyrics;
                lyricsData.plainLyrics = phpLyrics.replace(/\[.*?\]/g, '').trim();
            }
        } else {
             console.log('PHP API returned null (Lyrics not found or Error).');
        }
    } catch (err) {
        console.log('PHP API fetch failed:', err.message);
    }

    // 4. Try YouTube Music (via Python script)
    if (!lyricsData.syncedLyrics) {
        try {
            console.log(`Fetching from YouTube Music: ${name} - ${artist} (ISRC: ${isrc || 'N/A'})`);
            const ytmResult = await fetchLyricsFromYouTube(name, artist, isrc);
            if (ytmResult && ytmResult.lyrics) {
                console.log('Found via YouTube Music!');
                
                if (ytmResult.isSynced) {
                     console.log('YouTube Music returned SYNCED lyrics.');
                     lyricsData.syncedLyrics = ytmResult.lyrics;
                     lyricsData.plainLyrics = ytmResult.lyrics.replace(/\[.*?\]/g, '').trim();
                } else {
                     // Still check regex just in case, but rely on flag
                     if (/\[\d{2}:\d{2}/.test(ytmResult.lyrics)) {
                         lyricsData.syncedLyrics = ytmResult.lyrics;
                         lyricsData.plainLyrics = ytmResult.lyrics.replace(/\[.*?\]/g, '').trim();
                     } else {
                         console.log('YouTube Music found PLAIN lyrics. Will try LRCLib for SYNCED lyrics...');
                         lyricsData.plainLyrics = ytmResult.lyrics;
                     }
                }
            } else {
                console.log('YouTube Music returned null.');
            }
        } catch (err) {
            console.log('YouTube Music fetch failed:', err.message);
        }
    }

    // 5. If no synced lyrics yet, Try Lrclib.net
    if (!lyricsData.syncedLyrics) {
        try {
            console.log(`Fetching from Lrclib (Get): ${name} - ${artist}`);
            // Strategy A: Strict GET
            const response = await axios.get('https://lrclib.net/api/get', {
                params: {
                    track_name: name,
                    artist_name: artist,
                    duration: Math.round(duration / 1000)
                },
                timeout: 8000 
            });
            
            lyricsData.syncedLyrics = response.data.syncedLyrics;
            lyricsData.plainLyrics = response.data.plainLyrics;

        } catch (error) {
            // Strategy B: Fuzzy Search (if strict get fails)
            console.log('Lrclib Strict Get failed/timed out, trying Search...');
            try {
                const searchRes = await axios.get('https://lrclib.net/api/search', {
                    params: {
                        track_name: name,
                        artist_name: artist
                    },
                    timeout: 8000
                });

                // Find best match based on duration
                const candidates = searchRes.data;
                if (candidates && candidates.length > 0) {
                    const targetDuration = duration / 1000; // seconds
                    
                    // Find candidate with closest duration
                    const bestMatch = candidates.reduce((prev, curr) => {
                        return (Math.abs(curr.duration - targetDuration) < Math.abs(prev.duration - targetDuration) ? curr : prev);
                    });

                    // Only accept if duration difference is reasonable (e.g., within 5 seconds)
                    if (Math.abs(bestMatch.duration - targetDuration) < 5) {
                        console.log(`Found via Search: ${bestMatch.trackName} (Diff: ${Math.round(bestMatch.duration - targetDuration)}s)`);
                        lyricsData.syncedLyrics = bestMatch.syncedLyrics;
                        lyricsData.plainLyrics = bestMatch.plainLyrics;
                    }
                }
            } catch (searchError) {
                 console.log('Lrclib Search failed:', searchError.message);
            }
        }
    }

    // 6. Save and Return
    if (lyricsData.syncedLyrics) {
        // Found synced lyrics -> Save to main folder
        fs.writeFileSync(filePath, JSON.stringify(lyricsData));
        return res.json(lyricsData);
    } else {
        // No synced lyrics found
        console.log(`No synced lyrics found for ${id}.`);
        
        const noSyncData = {
            id,
            name,
            artist,
            duration,
            syncedLyrics: null,
            plainLyrics: null, // Don't send plain text to overlay
            note: "No synced lyrics found."
        };
        
        // Save metadata but don't return plain lyrics to avoid display
        fs.writeFileSync(noSyncPath, JSON.stringify(noSyncData, null, 2));
        
        return res.json({ syncedLyrics: null });
    }
});

// --- Canvas Logic ---

// Ensure public/canvases exists
const canvasDir = path.join(__dirname, 'public', 'canvases');
if (!fs.existsSync(canvasDir)) {
    fs.mkdirSync(canvasDir, { recursive: true });
}

// Helper to download 