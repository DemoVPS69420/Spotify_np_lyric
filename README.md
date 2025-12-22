# Spotify Now Playing & Lyrics Widget

[![Tiếng Việt](https://img.shields.io/badge/Language-Tiếng%20Việt-red)](README_VN.md)

A customizable, real-time "Now Playing" overlay for Spotify that displays synced lyrics. Designed for OBS streaming or as a desktop widget.

## 🌟 Features

*   **Real-time Now Playing:** Shows track name, artist, and album art with a dynamic background gradient extracted from the cover art.
*   **Spotify Canvas Support:** Automatically fetches and displays the looping video background for supported tracks, bringing your overlay to life.
*   **Synced Lyrics (Karaoke Style):** Displays time-synced lyrics with active line highlighting and smooth scrolling.
*   **Advanced Lyrics Fetching System:**
    1.  **Local Cache:** Fast loading for previously played songs.
    2.  **Spotify Internal API (via PHP):** Fetches official time-synced lyrics directly from Spotify (requires `SP_DC` cookie).
    3.  **Lrclib.net Fallback:** If Spotify fails, falls back to the open-source Lrclib database.
*   **Smart UI Behavior:**
    *   **Adaptive UI:** The player art container automatically resizes to match the Canvas aspect ratio (e.g., expanding from 1:1 to 9:16 for vertical videos).
    *   Auto-shows when the song changes or resumes.
    *   Auto-hides the player after 10 seconds of inactivity (lyrics remain visible while singing).
    *   **Outro Mode:** Automatically reappears and stays visible during the last 20 seconds of the track.
    *   **Smart Lyrics:** Hides the "next line" preview if the instrumental gap is longer than 10 seconds.
*   **Customizable:**
    *   **Edit Mode:** Drag and drop to reposition widgets.
    *   **Scaling:** Adjust the size of the player and lyrics independently.
    *   **Settings saved:** Positions and scales are saved to your browser/local storage.

## 🛠️ Architecture

This project uses a hybrid **Node.js + PHP** architecture to maximize reliability:

1.  **Frontend (HTML/JS):** Polls the Node.js server every second for status. Handles UI rendering, lyric parsing (LRC regex), and animation interpolation.
2.  **Backend (Node.js - Port 8888):**
    *   Handles Spotify OAuth (Login/Token refreshing).
    *   Serves the UI.
    *   Manages the API endpoints (`/api/now-playing`, `/api/lyrics`, `/api/canvas`).
    *   **Canvas API Proxy:** Proxies requests to Spotify's Canvas API and caches videos locally to save bandwidth.
    *   Orchestrates the PHP microservice.
3.  **Microservice (PHP - Port 8100):**
    *   Runs a modified version of `spotify-lyrics-api` locally.
    *   Bypasses Spotify's "403 Forbidden" blocks by simulating a Web Player session using PHP's cURL.

## 📋 Prerequisites

Before running, ensure you have:

1.  **Node.js:** Installed on your machine.
2.  **PHP:** Installed and added to your system PATH.
    *   **Crucial:** You must enable `curl`, `mbstring`, and `openssl` extensions in your `php.ini`.
3.  **Spotify Premium Account:** (Recommended for best API access, though Free might work for some features).

## 🚀 Setup Guide

### 0. Download the Source Code

First, get the project files onto your machine:

*   **Option 1 (Recommended): Clone with Git**
    ```bash
    git clone https://github.com/DemoVPS69420/Spotify_np_lyric.git
    cd Spotify_np_lyric
    ```
    (Replace `https://github.com/DemoVPS69420/Spotify_np_lyric.git` with the actual GitHub repository URL if you host this project).

*   **Option 2: Download as ZIP**
    1.  Go to the [GitHub repository page](https://github.com/DemoVPS69420/Spotify_np_lyric).
    2.  Click the green "Code" button and select "Download ZIP".
    3.  Extract the contents of the ZIP file to your desired location.
    4.  Open your terminal/command prompt and navigate to the extracted folder.

### 1. Install Dependencies
Open a terminal in the project folder and run:
```bash
npm install
```

### 2. Configure PHP
1.  Locate your `php.ini` file.
2.  Open it and ensure the following lines are **uncommented** (remove the `;` at the start):
    ```ini
    extension=curl
    extension=mbstring
    extension=openssl
    ```

### 3. Create Spotify Application
1.  Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2.  Create a new App.
3.  In the App settings, add this **Redirect URI**:
    ```
    http://127.0.0.1:8888/callback
    ```
4.  Copy your **Client ID** and **Client Secret**.

### 4. Get Your SP_DC Cookie
This is required for fetching official lyrics and Canvas videos.
1.  Open Chrome/Edge/Firefox and go to [open.spotify.com](https://open.spotify.com).
2.  Log in.
3.  Press **F12** to open Developer Tools.
4.  Go to **Application** tab (Storage in Firefox) -> **Cookies** -> `https://open.spotify.com`.
5.  Find the cookie named `sp_dc` and copy its value.

### 5. Configure Environment Variables
Create a file named `.env` in the root folder (or edit the existing one) and add your credentials:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SP_DC=your_sp_dc_cookie_value_here
```

## ▶️ Running the App

You can start the application using the provided batch file or via terminal:

**Option 1: Double-click `start.bat`**

**Option 2: Terminal**
```bash
node server.js
```
*Note: The Node server will automatically start the background PHP server.*

## 🎮 Usage

1.  Open your browser to `http://127.0.0.1:8888`.
2.  Click **"Login with Spotify"**.
3.  Play music on your Spotify app (Desktop or Mobile).
4.  **Edit UI:** Click the "Settings" (Gear) icon to:
    *   Drag and drop the Player and Lyrics widgets.
    *   Use the sliders to adjust the scale/size.
    *   Click "Save" to persist changes.
5.  **OBS Setup:** Add a "Browser Source" in OBS pointing to `http://127.0.0.1:8888` with width `1920` and height `1080` (check "Shutdown source when not visible" if desired).

## 🐛 Troubleshooting

*   **Lyrics not showing?**
    *   Check the console logs (`node server.js` window).
    *   If you see "PHP API returned null", your `SP_DC` might be expired. Get a new one.
    *   If you see "Call to undefined function curl_init", you didn't enable `extension=curl` in `php.ini`.
*   **Overlay not appearing?**
    *   Ensure you are playing a song on Spotify.
    *   Check if `http://127.0.0.1:8888` loads in your browser.

## 📂 Project Structure

*   `server.js`: Main Node.js application.
*   `public/`: Frontend assets (HTML, CSS, JS).
*   `public/canvases/`: Local cache for downloaded Spotify Canvas videos.
*   `lyrics/`: JSON cache for downloaded lyrics.
*   `spotify-lyrics-api-main/`: PHP source code for the lyrics fetcher.
*   `Spotify-Canvas-API-main/`: Module for interacting with Spotify's Canvas API.

## 🤝 Credits

*   Original PHP Logic: [akashrchandran/spotify-lyrics-api](https://github.com/akashrchandran/spotify-lyrics-api)
*   Spotify Canvas API: [Paxsenix0/Spotify-Canvas-API](https://github.com/Paxsenix0/Spotify-Canvas-API)
*   Lrclib: [lrclib.net](https://lrclib.net/) for the fallback database.
