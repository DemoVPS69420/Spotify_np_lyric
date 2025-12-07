<?php
// Simple router/controller for the API
require_once __DIR__ . '/src/SpotifyException.php';
require_once __DIR__ . '/src/Spotify.php';

use SpotifyLyricsApi\Spotify;
use SpotifyLyricsApi\SpotifyException;

header('Content-Type: application/json');

// Get SP_DC from environment
$sp_dc = getenv('SP_DC');

if (!$sp_dc) {
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => 'SP_DC environment variable not set']);
    exit;
}

$trackId = $_GET['trackid'] ?? null;
$url = $_GET['url'] ?? null;
$format = $_GET['format'] ?? 'json';

if (!$trackId && !$url) {
    http_response_code(400);
    echo json_encode(['error' => true, 'message' => 'trackid or url parameter is required']);
    exit;
}

if ($url && !$trackId) {
    // Extract trackId from URL if possible
    if (preg_match('/track\/([a-zA-Z0-9]+)/', $url, $matches)) {
        $trackId = $matches[1];
    }
}

if (!$trackId) {
     http_response_code(400);
     echo json_encode(['error' => true, 'message' => 'Invalid track ID or URL']);
     exit;
}

try {
    $spotify = new Spotify($sp_dc);
    $spotify->checkTokenExpire();
    
    $lyricsJson = $spotify->getLyrics($trackId);
    $lyricsData = json_decode($lyricsJson, true);

    // DEBUG: Log raw response to a file
    file_put_contents('php_debug_log.txt', print_r($lyricsData, true), FILE_APPEND);

    if (isset($lyricsData['lyrics'])) {
        $lyrics = $lyricsData['lyrics'];
        
        $response = [
            'error' => false,
            'syncType' => $lyrics['syncType'] ?? 'UNSYNCED',
            'lines' => []
        ];

        if ($format === 'lrc') {
             $lrcLines = $spotify->getLrcLyrics($lyrics['lines']);
             $response['lines'] = $lrcLines;
        } else {
             $response['lines'] = $lyrics['lines'];
        }
        
        echo json_encode($response);
    } else {
        http_response_code(404);
        echo json_encode(['error' => true, 'message' => 'Lyrics not found']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => $e->getMessage()]);
}
?>
