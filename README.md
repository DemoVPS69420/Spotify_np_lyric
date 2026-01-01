# Spotify Now Playing & Lyrics Widget

[![Tiếng Việt](https://img.shields.io/badge/Language-Tiếng%20Việt-red)](README_VN.md)

A customizable, real-time "Now Playing" overlay for Spotify that displays synced lyrics. Designed for OBS streaming or as a desktop widget.

## 🌟 Features

*   **Real-time Now Playing:** Shows track name, artist, and album art with a dynamic background gradient extracted from the cover art.
*   **Spotify Canvas Support:** Automatically fetches and displays the looping video background for supported tracks, bringing your overlay to life.
*   **Synced Lyrics (Karaoke Style):** Displays time-synced lyrics with active line highlighting.
*   **Smooth Scrolling Animation:** New in 2.0! Features a beautiful "Scroll Up" animation powered by **Anime.js**, providing a premium Apple Music-like experience.
*   **Advanced Lyrics Fetching System:**
    1.  **Local Cache:** Fast loading for previously played songs.
    2.  **Spotify Internal API (via PHP):** Fetches official time-synced lyrics directly from Spotify (requires `SP_DC` cookie).
    3.  **YouTube Music (via Python):** Uses `ytmusicapi` to fetch lyrics from YouTube Music as a high-quality fallback.
        *   **Smart ISRC Search:** Uses the International Standard Recording Code to find the exact song match on YouTube Music, solving issues with different languages (e.g., Kanji vs Romaji titles).
        *   **Synced Support:** Automatically parses timestamped lyrics if available.
    4.  **Lrclib.net Fallback:** If all else fails, falls back to the open-source Lrclib database.
    5.  **Smart Filtering:** Automatically rejects "fake synced" lyrics (timestamps all 00:00.00) and searches for better sources.
*   **Smart UI Behavior:**
    *   **Adaptive UI:** The player art container automatically resizes to match the Canvas aspect ratio (e.g., expanding from 1:1 to 9:16 for vertical videos).
    *   Auto-shows when the song changes or resumes.
    *   Auto-hides the player after 10 seconds of inactivity (lyrics remain visible while singing).
    *   **Outro Mode:** Automatically reappears and stays visible during the last 20 seconds of the track.
    *   **Smart Lyrics:** Hides the "next line" preview if the instrumental gap is longer than 10 seconds.
*   **Customizable:**
    *   **Edit Mode:** Drag and drop to reposition widgets.
    *   **Scaling:** Adjust the size of the player and lyrics independently.
    *   **Animation Style:** Choose between "Default (Fade)" or "Scroll Up".
    *   **Settings saved:** Positions and scales are saved to your browser/local storage.

## 🛠️ Architecture

This project uses a hybrid **Node.js + PHP + Python** architecture to maximize reliability:

1.  **Frontend (HTML/JS):** Polls the Node.js server every second for status. Handles UI rendering, lyric parsing (LRC regex), and animation interpolation via `Anime.js`.
2.  **Backend (Node.js - Port 8888):**
    *   Handles Spotify OAuth (Login/Token refreshing).
    *   Serves the UI.
    *   Manages the API endpoints.
    *   Orchestrates the PHP and Python microservices.
3.  **Microservices:**
    *   **PHP (Port 8100):** Runs `spotify-lyrics-api` locally to bypass Spotify's blocks.
    *   **Python:** Runs `ytmusicapi` script to fetch lyrics from YouTube Music when Spotify fails.

## 📋 Prerequisites

Before running, ensure you have:

1.  **Node.js:** Installed on your machine.
2.  **PHP:** Installed and added to your system PATH (Enable `curl`, `mbstring`, `openssl`).
3.  **Python:** Installed for YouTube Music support.
4.  **Spotify Premium Account:** (Recommended).

## 🚀 Setup Guide

### 1. Install Dependencies
Open a terminal in the project folder and run:
```bash
npm install
```

### 2. Configure PHP
Ensure `extension=curl`, `extension=mbstring`, `extension=openssl` are enabled in `php.ini`.

### 3. Setup Spotify & YouTube Music Auth

**A. Spotify (SP_DC Cookie)**
Create a `.env` file:
```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SP_DC=your_sp_dc_cookie_value_here
```

**B. YouTube Music (Optional but Recommended)**
To enable synced lyrics from YouTube Music, create a `ytmusic_auth.json` file in the root folder with your browser headers/cookies:
```json
{
    "User-Agent": "Mozilla/5.0 ...",
    "Cookie": "..."
}
```
*Tip: You can grab these headers using the Network tab (F12) on music.youtube.com.*

### 4. Run the App
```bash
node server.js
```

## 🎮 Usage

1.  Open `http://127.0.0.1:8888` and login.
2.  Click the **Settings (Gear Icon)** to switch between "Default" and "Scroll Up" lyric animations.
3.  **OBS Setup:** Add a Browser Source pointing to the local URL.

## 🛠️ Utilities

*   **Clean Bad Lyrics:** Run `node scan_fake_synced.js` to automatically scan and remove lyrics that are falsely marked as synced (all timestamps 00:00).

## 🤝 Credits

*   Original PHP Logic: [akashrchandran/spotify-lyrics-api](https://github.com/akashrchandran/spotify-lyrics-api)
*   YouTube Music API: [sigma67/ytmusicapi](https://github.com/sigma67/ytmusicapi)
*   Animation Engine: [Anime.js](https://animejs.com/)
