const fs = require('fs');
const path = require('path');

const NO_SYNC_DIR = path.join(__dirname, 'no_lyric_or_no_sync');
const LYRICS_DIR = path.join(__dirname, 'lyrics');

console.log('--- Scanning for manually added lyrics ---');

if (!fs.existsSync(NO_SYNC_DIR)) {
    console.log(`Directory ${NO_SYNC_DIR} does not exist.`);
    process.exit(0);
}

const files = fs.readdirSync(NO_SYNC_DIR);
let movedCount = 0;

files.forEach(file => {
    if (!file.endsWith('.json')) return;

    const srcPath = path.join(NO_SYNC_DIR, file);
    
    try {
        const content = fs.readFileSync(srcPath, 'utf8');
        const data = JSON.parse(content);
        
        // Check if syncedLyrics has been added and is not null/empty
        if (data.syncedLyrics && data.syncedLyrics.length > 10) {
            console.log(`[FOUND] Synced lyrics found for: ${data.name} (${file})`);
            
            const destPath = path.join(LYRICS_DIR, file);
            
            // Move file
            // Note: renameSync works as "move" on same drive
            fs.renameSync(srcPath, destPath);
            console.log(`   -> Moved to lyrics folder.`);
            movedCount++;
        }
    } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
    }
});

console.log('--- Scan complete ---');
console.log(`Moved ${movedCount} files.`);
