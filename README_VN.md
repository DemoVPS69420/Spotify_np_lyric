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

## 🚀 Hướng Dẫn Setup Chi Tiết

### 0. Tải Mã Nguồn

*   **Cách 1: Clone bằng Git**
    ```bash
    git clone https://github.com/DemoVPS69420/Spotify_np_lyric.git
    cd Spotify_np_lyric
    ```
*   **Cách 2: Tải file ZIP**
    1.  Bấm nút **"Code"** màu xanh trên GitHub -> chọn **"Download ZIP"**.
    2.  Giải nén ra thư mục.

### 1. Cài Đặt Thư Viện
Mở terminal tại thư mục dự án và chạy:
```bash
npm install
```

### 2. Cấu Hình PHP (Quan trọng)
1.  Tìm file `php.ini` trong thư mục cài đặt PHP SAU KHI CÀI (Nếu mặc định sẽ là C:\Users\[Tên PC/User]\AppData\Local).
2.  Mở bằng Notepad.
3.  Tìm và **xóa dấu chấm phẩy (;)** ở đầu các dòng sau để kích hoạt:
    ```ini
    extension=curl
    extension=mbstring
    extension=openssl
    ```

### 3. Cấu Hình Spotify

#### A. Tạo App trên Developer Dashboard
1.  Truy cập [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2.  Tạo App mới.
3.  Vào phần Settings, thêm **Redirect URI**:
    ```
    http://127.0.0.1:8888/callback
    ```
4.  Lưu lại và copy **Client ID**, **Client Secret**.

#### B. Lấy Cookie SP_DC
1.  Đăng nhập [open.spotify.com](https://open.spotify.com).
2.  Bấm **F12** -> Tab **Application** (hoặc Storage) -> **Cookies**.
3.  Tìm cookie tên là `sp_dc` và copy giá trị.

#### C. Lưu Cấu Hình
Tạo file `.env` ở thư mục gốc:
```env
SPOTIFY_CLIENT_ID=client_id_cua_ban
SPOTIFY_CLIENT_SECRET=client_secret_cua_ban
SP_DC=cookie_sp_dc_cua_ban
```

### 4. Cấu Hình YouTube Music (Để lấy lyric tốt hơn)
1.  Tạo file `ytmusic_auth.json` ở thư mục gốc.
2.  Đăng nhập [music.youtube.com](https://music.youtube.com).
3.  Bấm **F12** -> Tab **Network**. Reload trang.
4.  Bấm vào một request bất kỳ (ví dụ `browse`).
5.  Tìm phần **Request Headers**, copy `Cookie` và `User-Agent`.
6.  Dán vào `ytmusic_auth.json`:
    ```json
    {
        "User-Agent": "Mozilla/5.0 ...",
        "Cookie": "..."
    }
    ```

### 5. Chạy Ứng Dụng
Chạy file `start.bat` HOẶC gõ lệnh:
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
*   Spotify Canvas API: [Paxsenix0/Spotify-Canvas-API](https://github.com/Paxsenix0/Spotify-Canvas-API)
*   Lrclib: [lrclib.net](https://lrclib.net/) (nguồn lời bài hát dự phòng).
*   Animation Engine: [Anime.js](https://animejs.com/)
