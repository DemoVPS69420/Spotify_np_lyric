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
        console.log(`PHP server exited with code ${code}`);
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

// Now Playing API Endpoint
app.get('/api/now-playing', async (req, res) => {
    if (!accessToken) {
        return res.json({ loggedIn: false });
    }

    // Refresh if needed (give 5 minute buffer)
    if (Date.now() > tokenExpirationTime - 300000) {
        await refreshAccessToken();
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });

        if (response.status === 204 || response.status > 400) {
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
            duration: item.duration_ms
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

// Lyrics API Endpoint
app.get('/api/lyrics', async (req, res) => {
    const { id, name, artist, duration } = req.query;

    if (!id || !name || !artist) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const filePath = path.join(__dirname, 'lyrics', `${id}.json`);

    // 1. Check local cache
    if (fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            if (data.syncedLyrics || data.plainLyrics) {
                console.log(`Cache HIT for ${id}`);
                return res.json(data);
            } else {
                console.log(`Cache MISS (Empty Data) for ${id}`);
            }
        } catch (err) {
            console.error('Error reading lyrics file:', err);
        }
    } else {
        console.log(`Cache MISS (File not found) for ${id}`);
    }

    let lyricsData = {
        syncedLyrics: null,
        plainLyrics: null
    };

    // 2. Try PHP API (Spotify Internal via PHP)
    try {
        console.log(`Fetching from PHP API (Spotify): ${name} - ${artist}`);
        const phpLyrics = await fetchLyricsFromPhp(id);
        if (phpLyrics) {
            console.log('Found via PHP API!');
            lyricsData.syncedLyrics = phpLyrics;
            lyricsData.plainLyrics = phpLyrics.replace(/\[.*?\]/g, '').trim();
        } else {
             console.log('PHP API returned null (Lyrics not found or Error).');
        }
    } catch (err) {
        console.log('PHP API fetch failed:', err.message);
    }

    // 3. If no synced lyrics yet, Try Lrclib.net
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
                timeout: 8000 // Increased timeout
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
                    timeout: 8000 // Increased timeout
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

    // 4. Save and Return
    if (lyricsData.syncedLyrics || lyricsData.plainLyrics) {
        fs.writeFileSync(filePath, JSON.stringify(lyricsData));
        return res.json(lyricsData);
    } else {
        return res.status(404).json({ error: 'Lyrics not found' });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    // Start PHP Server when Node server starts
    startPhpServer();

    console.log(`Server running at http://127.0.0.1:${PORT}`);
    console.log(`Please verify that your Spotify App Redirect URI is set to: http://127.0.0.1:${PORT}/callback`);
    console.log(`To login, go to http://127.0.0.1:${PORT}/login`);
});
