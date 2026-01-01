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

### 0. Download the Source Code

First, get the project files onto your machine:

*   **Option 1 (Recommended): Clone with Git**
    ```bash
    git clone https://github.com/DemoVPS69420/Spotify_np_lyric.git
    cd Spotify_np_lyric
    ```
    *(Replace with your actual repo URL if different)*

*   **Option 2: Download as ZIP**
    1.  Go to the GitHub repository page.
    2.  Click the green **"Code"** button and select **"Download ZIP"**.
    3.  Extract the contents to a folder.
    4.  Open a terminal in that folder.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure PHP
This is critical for the Spotify API to work.
1.  Locate your `php.ini` file (usually in your PHP installation folder).
2.  Open it with a text editor.
3.  Find and **uncomment** (remove `;`) the following lines:
    ```ini
    extension=curl
    extension=mbstring
    extension=openssl
    ```

### 3. Spotify Configuration (Required)

#### A. Create Spotify App
1.  Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2.  Create a new App.
3.  In App Settings, add this **Redirect URI**:
    ```
    http://127.0.0.1:8888/callback
    ```
4.  Save and copy your **Client ID** and **Client Secret**.

#### B. Get SP_DC Cookie
1.  Open [open.spotify.com](https://open.spotify.com) in your browser and log in.
2.  Press **F12** (Developer Tools).
3.  Go to **Application** (Chrome/Edge) or **Storage** (Firefox) > **Cookies**.
4.  Find `https://open.spotify.com` and copy the value of the `sp_dc` cookie.

#### C. Save Credentials
Create a `.env` file in the root folder:
```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SP_DC=your_sp_dc_cookie
```

### 4. YouTube Music Configuration (Optional)
To enable synced lyrics from YouTube Music (highly recommended as a fallback):
1.  Create a `ytmusic_auth.json` file in the root folder.
2.  Go to [music.youtube.com](https://music.youtube.com) and log in.
3.  Press **F12** > **Network** tab. Refresh the page.
4.  Click on any request (e.g., `browse`).
5.  Scroll down to **Request Headers** and copy the `Cookie` and `User-Agent`.
6.  Paste them into `ytmusic_auth.json` like this:
    ```json
    {
        "User-Agent": "Mozilla/5.0 ...",
        "Cookie": "..."
    }
    ```

### 5. Run the App
Double-click `start.bat` OR run:
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
*   Spotify Canvas API: [Paxsenix0/Spotify-Canvas-API](https://github.com/Paxsenix0/Spotify-Canvas-API)
*   Lrclib: [lrclib.net](https://lrclib.net/) for the fallback database.
*   Animation Engine: [Anime.js](https://animejs.com/)
