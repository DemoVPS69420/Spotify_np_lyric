import sys
import os
import json

# Add the local library path to sys.path so we can import it
current_dir = os.path.dirname(os.path.abspath(__file__))
lib_path = os.path.join(current_dir, 'ytmusicapi-1.11.4')
sys.path.insert(0, lib_path)

try:
    from ytmusicapi import YTMusic
except ImportError as e:
    print(json.dumps({"error": f"Failed to import ytmusicapi: {str(e)}"}))
    sys.exit(1)

def get_lyrics(track_name, artist_name, isrc=None):
    # Check for auth file
    auth_file = 'ytmusic_auth.json'
    yt = None
    
    if os.path.exists(auth_file):
        try:
            with open(auth_file, 'r', encoding='utf-8') as f:
                auth_data = json.load(f)
            from ytmusicapi.helpers import initialize_headers
            yt = YTMusic()
            yt.s.headers.update(auth_data)
        except Exception as e:
            yt = YTMusic()
    else:
        yt = YTMusic()
        
    query = f"{track_name} {artist_name}"
    video_id = None

    try:
        # 1. Strategy A: Search by ISRC (Most accurate)
        if isrc:
            try:
                # Search using ISRC
                isrc_results = yt.search(isrc)
                # Prioritize 'songs', then 'videos'
                for item in isrc_results:
                    if item['resultType'] == 'song' and 'videoId' in item:
                        video_id = item['videoId']
                        # print(f"Found match by ISRC: {item['title']}")
                        break
                
                # If no song found, take the first video
                if not video_id and isrc_results and 'videoId' in isrc_results[0]:
                    video_id = isrc_results[0]['videoId']
            except Exception:
                pass

        # 2. Strategy B: Search by Name + Artist (Fallback)
        if not video_id:
            search_results = yt.search(query, filter='songs')
            if search_results:
                video_id = search_results[0]['videoId']
        
        if not video_id:
            return {"error": "Song not found"}
            
        # 2. Get Watch Playlist (essential to find the 'lyrics' browseId)
        watch_playlist = yt.get_watch_playlist(videoId=video_id)
        
        if not watch_playlist or 'lyrics' not in watch_playlist:
            return {"error": "No lyrics found for this song"}
            
        lyrics_id = watch_playlist['lyrics']
        
        # 3. Get Lyrics content (Request timestamps)
        try:
            lyrics_result = yt.get_lyrics(browseId=lyrics_id, timestamps=True)
        except Exception as e:
            # Fallback: If timestamp parsing fails (e.g. 'cueRange' error), try plain lyrics
            lyrics_result = yt.get_lyrics(browseId=lyrics_id, timestamps=False)
        
        if not lyrics_result or 'lyrics' not in lyrics_result:
            return {"error": "Empty lyrics content"}
            
        # 4. Process Synced Lyrics
        if lyrics_result.get('hasTimestamps') is True:
            # Convert to LRC
            # Assuming start_time is in milliseconds (e.g. 9200)
            lrc_lines = []
            for line in lyrics_result['lyrics']:
                # Handle both object (LyricLine) and dict (just in case)
                if isinstance(line, dict):
                    text = line.get('text', '')
                    start_ms = int(line.get('start_time', 0))
                else:
                    text = getattr(line, 'text', '')
                    start_ms = int(getattr(line, 'start_time', 0))
                
                minutes = start_ms // 60000
                seconds = (start_ms % 60000) / 1000
                time_tag = f"[{minutes:02d}:{seconds:05.2f}]"
                lrc_lines.append(f"{time_tag} {text}")
            
            return {
                "lyrics": "\n".join(lrc_lines),
                "source": "YouTube Music",
                "isSynced": True
            }
        else:
            # Plain text
            return {
                "lyrics": lyrics_result['lyrics'],
                "source": "YouTube Music",
                "isSynced": False
            }

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Expecting arguments: python fetch_yt_lyrics.py "Track Name" "Artist Name" [ISRC]
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
        
    track = sys.argv[1]
    artist = sys.argv[2]
    isrc = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Set encoding for Windows console output to avoid charmap errors
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding='utf-8')

    result = get_lyrics(track, artist, isrc)
    print(json.dumps(result))
