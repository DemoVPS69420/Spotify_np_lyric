const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SERVER_URL = 'http://127.0.0.1:8888';

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("Usage: node set_delay.js <offset_in_seconds>");
        console.log("Example: node set_delay.js -0.5  (Advance lyrics by 0.5s)");
        console.log("Example: node set_delay.js 1     (Delay lyrics by 1s)");
        return;
    }

    const offsetSeconds = parseFloat(args[0]);
    if (isNaN(offsetSeconds)) {
        console.error("Invalid offset. Please provide a number (seconds).");
        return;
    }
    
    const offsetMs = Math.round(offsetSeconds * 1000);

    try {
        // 1. Get Current Playing ID
        const npResponse = await axios.get(`${SERVER_URL}/api/now-playing`);
        if (!npResponse.data.loggedIn) {
            console.error("Error: Not logged in to Spotify.");
            return;
        }
        if (!npResponse.data.isPlaying) {
            console.error("Error: Nothing is playing right now.");
            return;
        }

        const trackId = npResponse.data.id;
        const trackName = npResponse.data.name;
        
        // 2. Locate Lyric File
        const lyricsDir = path.join(__dirname, 'lyrics');
        const filePath = path.join(lyricsDir, `${trackId}.json`);

        if (!fs.existsSync(filePath)) {
            console.error(`Error: No lyric file found for "${trackName}" (${trackId}).`);
            return;
        }

        // 3. Read and Update
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let data = JSON.parse(fileContent);

        // Initialize offset if not present
        const currentOffset = data.offset || 0;
        const newOffset = currentOffset + offsetMs;

        data.offset = newOffset;

        // 4. Save
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        console.log(`✅ Updated delay for "${trackName}"`);
        console.log(`   Old Offset: ${currentOffset}ms`);
        console.log(`   Adjustment: ${offsetMs > 0 ? '+' : ''}${offsetMs}ms`);
        console.log(`   New Offset: ${newOffset}ms`);
        console.log(`
(Refresh the overlay to see changes)`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

main();
