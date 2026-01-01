# Widget Spotify "Now Playing" & Lời Bài Hát

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)

Một overlay hiển thị bài hát đang phát trên Spotify kèm theo lời bài hát chạy chữ karaoke (synced lyrics). Được thiết kế tối ưu cho livestream OBS hoặc làm widget trang trí màn hình.

## 🌟 Tính Năng Nổi Bật

*   **Real-time Now Playing:** Hiển thị tên bài, ca sĩ, và ảnh bìa (album art) với hiệu ứng nền gradient tự động trích xuất màu từ ảnh bìa.
*   **Hỗ trợ Spotify Canvas:** Tự động tải và hiển thị video nền lặp lại (looping video) cho bài hát, giúp overlay sống động hơn.
*   **Lời Bài Hát Karaoke:** Lời bài hát chạy theo thời gian thực (time-synced), highlight dòng đang hát.
*   **Hiệu ứng Cuộn Chữ (Mới!):** Hỗ trợ chế độ "Scroll Up" mượt mà (sử dụng Anime.js), mang lại trải nghiệm giống Apple Music.
*   **Hệ Thống Lấy Lời Thông Minh:**
    1.  **Cache Cục Bộ:** Tải siêu nhanh cho các bài đã từng nghe.
    2.  **Spotify Internal API (qua PHP):** Lấy lời bài hát chuẩn "chính chủ" từ Spotify (cần cookie `SP_DC`).
    3.  **YouTube Music (qua Python):** Tự động tìm lyric từ YouTube Music nếu Spotify thất bại (Hỗ trợ lyric synced!).
        *   **Tìm kiếm bằng ISRC:** Sử dụng mã định danh bài hát quốc tế để tìm chính xác bài hát trên YouTube Music, giải quyết triệt để lỗi khác tên (Kanji/Romaji) giữa các nền tảng.
    4.  **Lrclib.net Fallback:** Nếu tất cả đều thất bại, tự động tìm kiếm trên kho dữ liệu mở Lrclib.
    5.  **Lọc Lyric Lỗi:** Tự động phát hiện lyric "fake sync" (toàn bộ là 00:00.00) và tìm nguồn khác thay thế.
*   **Hành Vi Thông Minh (Smart UI):**
    *   **Giao diện Thích ứng (Adaptive UI):** Khung ảnh album tự động thay đổi kích thước để phù hợp với tỉ lệ của Canvas (ví dụ: mở rộng từ hình vuông 1:1 sang dọc 9:16).
    *   Tự động hiện khi đổi bài hoặc bấm play.
    *   Tự động ẩn player sau 10 giây nếu không tương tác (lời bài hát vẫn hiện để bạn hát theo).
    *   **Chế độ Outro:** Tự động hiện lại và giữ nguyên màn hình trong 20 giây cuối bài hát.
    *   **Ngắt Lời Thông Minh:** Nếu đoạn dạo nhạc (instrumental) dài hơn 10 giây, sẽ không hiện trước câu tiếp theo để tránh rối mắt.
*   **Tùy Biến Dễ Dàng:**
    *   **Chế độ Edit:** Kéo thả vị trí Player và Lyrics thoải mái.
    *   **Scaling:** Chỉnh kích thước to/nhỏ tùy ý bằng thanh trượt.
    *   **Hiệu ứng:** Chọn giữa "Mặc định (Hiện/Ẩn)" hoặc "Cuộn chữ (Scroll Up)".
    *   **Tự động lưu:** Vị trí và kích thước được lưu lại trong trình duyệt.

## 🛠️ Kiến Trúc

Dự án sử dụng mô hình lai **Node.js + PHP + Python** để đảm bảo độ ổn định cao nhất:

1.  **Frontend (HTML/JS):** Gọi về server mỗi giây để cập nhật trạng thái. Xử lý hiển thị, phân tích file LRC, và hiệu ứng chuyển động với `Anime.js`.
2.  **Backend (Node.js - Port 8888):**
    *   Xử lý đăng nhập Spotify (OAuth).
    *   Chạy giao diện web.
    *   Quản lý các API endpoint.
    *   Điều phối các microservice PHP và Python.
3.  **Microservices:**
    *   **PHP (Port 8100):** Chạy `spotify-lyrics-api` để vượt qua lỗi chặn của Spotify.
    *   **Python:** Chạy script `ytmusicapi` để lấy lyric dự phòng từ YouTube Music.

## 📋 Yêu Cầu Cài Đặt

Trước khi chạy, hãy đảm bảo máy bạn đã có:

1.  **Node.js:** Đã cài đặt.
2.  **PHP:** Đã cài đặt và thêm vào biến môi trường (Enable `curl`, `mbstring`, `openssl`).
3.  **Python:** Cần thiết nếu muốn dùng nguồn YouTube Music.
4.  **Tài khoản Spotify Premium:** (Khuyến nghị).

## 🚀 Hướng Dẫn Setup

### 1. Cài Đặt Thư Viện
Mở terminal tại thư mục dự án và chạy:
```bash
npm install
```

### 2. Cấu Hình PHP
Đảm bảo bật `extension=curl`, `extension=mbstring`, `extension=openssl` trong `php.ini`.

### 3. Cấu Hình Tài Khoản

**A. Spotify (SP_DC Cookie)**
Tạo file `.env` và điền thông tin:
```env
SPOTIFY_CLIENT_ID=client_id_cua_ban
SPOTIFY_CLIENT_SECRET=client_secret_cua_ban
SP_DC=cookie_sp_dc_cua_ban
```

**B. YouTube Music (Không bắt buộc nhưng khuyên dùng)**
Để lấy lyric synced từ YouTube Music, tạo file `ytmusic_auth.json` ở thư mục gốc và dán cookie/header của bạn vào:
```json
{
    "User-Agent": "Mozilla/5.0 ...",
    "Cookie": "..."
}
```
*Mẹo: Lấy cookie bằng cách nhấn F12 (Network tab) tại music.youtube.com.*

### 4. Chạy Ứng Dụng
```bash
node server.js
```

## 🎮 Cách Sử Dụng

1.  Mở `http://127.0.0.1:8888` và đăng nhập.
2.  Bấm **Settings (Bánh Răng)** để chọn hiệu ứng lyric mong muốn.
3.  **Setup OBS:** Thêm "Browser Source" dẫn link local.

## 🛠️ Công Cụ Bổ Trợ

*   **Dọn dẹp lyric lỗi:** Chạy lệnh `node scan_fake_synced.js` để tự động quét và xóa các file lyric bị lỗi "fake sync" (toàn bộ 00:00), giúp hệ thống tự tìm lại nguồn tốt hơn.

## 🤝 Credits

*   Logic PHP gốc: [akashrchandran/spotify-lyrics-api](https://github.com/akashrchandran/spotify-lyrics-api)
*   YouTube Music API: [sigma67/ytmusicapi](https://github.com/sigma67/ytmusicapi)
*   Animation Engine: [Anime.js](https://animejs.com/)
