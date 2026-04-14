const fs = require('fs');
const path = require('path');

const LYRICS_DIR = path.join(__dirname, 'lyrics');
const NO_SYNC_DIR = path.join(__dirname, 'no_lyric_or_no_sync');

// Đảm bảo thư mục đích tồn tại
if (!fs.existsSync(NO_SYNC_DIR)) {
    fs.mkdirSync(NO_SYNC_DIR, { recursive: true });
}

function scan() {
    console.log('--- Đang bắt đầu quét lyric lỗi (fake sync 00:00) ---');
    
    const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
    let movedCount = 0;

    files.forEach(file => {
        const filePath = path.join(LYRICS_DIR, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (data.syncedLyrics) {
                const lines = data.syncedLyrics.split('\n');
                const zeroTimestamps = lines.filter(l => l.includes('[00:00.00]') || l.includes('[00:00:00]')).length;
                
                // Nếu hơn 60% số dòng là 00:00 (và có ít nhất 2 dòng)
                if (lines.length > 1 && zeroTimestamps > lines.length * 0.6) {
                    console.log(`[LỖI] Phát hiện ${file} bị fake sync (${zeroTimestamps}/${lines.length} dòng). Đang di chuyển...`);
                    
                    const targetPath = path.join(NO_SYNC_DIR, file);
                    
                    // Cập nhật lại nội dung file để đánh dấu là chưa sync
                    data.syncedLyrics = null;
                    data.note = "Moved by scanner: Detected fake 00:00 timestamps.";
                    
                    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
                    fs.unlinkSync(filePath); // Xóa file cũ ở thư mục chính
                    
                    movedCount++;
                }
            }
        } catch (err) {
            console.error(`Lỗi khi đọc file ${file}:`, err.message);
        }
    });

    console.log('--------------------------------------------------');
    console.log(`Quét hoàn tất! Đã dọn dẹp ${movedCount} file lỗi.`);
}

scan();
