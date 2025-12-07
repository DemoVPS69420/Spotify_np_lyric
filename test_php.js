const axios = require('axios');

async function testPhpServer() {
    const trackId = "7qiZfU4dY1lWllzX7mPBI3"; // Ed Sheeran - Shape of You (Very popular, definitely has lyrics)
    console.log(`Testing PHP Server for track ID: ${trackId}`);
    
    try {
        const response = await axios.get('http://127.0.0.1:8100/', {
            params: {
                trackid: trackId,
                format: 'lrc'
            }
        });
        
        console.log("PHP Server Response Status:", response.status);
        console.log("PHP Server Data Preview:", JSON.stringify(response.data).substring(0, 500));
        
        if (response.data.error) {
            console.error("PHP returned an error:", response.data.message);
        } else {
            console.log("SUCCESS! Lyrics found via PHP.");
        }
        
    } catch (error) {
        console.error("Failed to connect to PHP server:", error.message);
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Data:", error.response.data);
        }
    }
}

testPhpServer();
