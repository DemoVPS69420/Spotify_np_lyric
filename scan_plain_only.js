const fs = require('fs');
const path = require('path');

const LYRICS_DIR = path.join(__dirname, 'lyrics');
const NO_SYNC_DIR = path.join(__dirname, 'no_lyric_or_no_sync');

// Đảm bảo thư mục đích tồn tại
if (!fs.existsSync(NO_SYNC_DIR)) {
    fs.mkdirSync(NO_SYNC_DIR, { recursive: true });
}

function scan() {
    console.log('--- Đang quét lyric chỉ có văn bản (Plain Text Only) ---');
    
    // Lấy danh sách file JSON
    const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
    let movedCount = 0;

    files.forEach(file => {
        const filePath = path.join(LYRICS_DIR, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            
            // Điều kiện: KHÔNG có syncedLyrics (hoặc rỗng) NHƯNG CÓ plainLyrics
            const hasNoSync = !data.syncedLyrics || data.syncedLyrics.trim() === '';
            const hasPlain = data.plainLyrics && data.plainLyrics.trim().length > 0;

            if (hasNoSync && hasPlain) {
                console.log(`[CHUYỂN] ${file}: Chỉ có plain text, thiếu sync. Đang di chuyển...`);
                
                const targetPath = path.join(NO_SYNC_DIR, file);
                
                // Thêm ghi chú
                data.note = "Moved by scanner: Plain lyrics only (no sync found).";
                
                // Ghi sang thư mục no_sync
                fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
                
                // Xóa file cũ
                fs.unlinkSync(filePath);
                
                movedCount++;
            }
        } catch (err) {
            console.error(`Lỗi đọc file ${file}:`, err.message);
        }
    });

    console.log('--------------------------------------------------');
    console.log(`Hoàn tất! Đã di chuyển ${movedCount} file chưa sync.`);
}

scan();
