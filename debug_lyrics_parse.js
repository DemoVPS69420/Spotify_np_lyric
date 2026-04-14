const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lyrics', '4BLkz8cHw7DRsJMgYVWbBI.json');

try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log("File read successfully.");
    
    const data = JSON.parse(fileContent);
    console.log("JSON parsed successfully.");
    
    if (!data.syncedLyrics) {
        console.log("No syncedLyrics found in JSON.");
        process.exit(0);
    }

    const lrc = data.syncedLyrics;
    console.log("First 100 chars of lrc:", lrc.substring(0, 100));

    const lines = lrc.split('\n');
    console.log(`Split into ${lines.length} lines.`);

    const regex = /^μφωνα(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    
    let matchCount = 0;
    let failCount = 0;

    lines.forEach((line, i) => {
        // Skip empty lines for report brevity
        if (!line.trim()) return;

        const match = line.match(regex);
        if (match) {
            matchCount++;
            if (i < 5) {
                console.log(`Line ${i} MATCH: Time=${match[1]}:${match[2]}.${match[3]} Text="${match[4].trim()}"`);
            }
        } else {
            failCount++;
            console.log(`Line ${i} FAIL: "${line}"`);
        }
    });

    console.log(`
Summary: ${matchCount} matches, ${failCount} failures.`);

} catch (err) {
    console.error("Error:", err.message);
}
