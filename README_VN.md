# Widget Spotify "Now Playing" & Lời Bài Hát

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)

Một overlay hiển thị bài hát đang phát trên Spotify kèm theo lời bài hát chạy chữ karaoke (synced lyrics). Được thiết kế tối ưu cho livestream OBS hoặc làm widget trang trí màn hình.

## 🌟 Tính Năng Nổi Bật

*   **Real-time Now Playing:** Hiển thị tên bài, ca sĩ, và ảnh bìa (album art) với hiệu ứng nền gradient tự động trích xuất màu từ ảnh bìa.
*   **Hỗ trợ Spotify Canvas:** Tự động tải và hiển thị video nền lặp lại (looping video) cho bài hát, giúp overlay sống động hơn.
*   **Lời Bài Hát Karaoke:** Lời bài hát chạy theo thời gian thực (time-synced), highlight dòng đang hát và cuộn mượt mà.
*   **Hệ Thống Lấy Lời Thông Minh:**
    1.  **Cache Cục Bộ:** Tải siêu nhanh cho các bài đã từng nghe.
    2.  **Spotify Internal API (qua PHP):** Lấy lời bài hát chuẩn "chính chủ" từ Spotify (cần cookie `SP_DC`).
    3.  **Lrclib.net Fallback:** Nếu Spotify không có hoặc lỗi, tự động tìm kiếm trên kho dữ liệu mở Lrclib.
*   **Hành Vi Thông Minh (Smart UI):**
    *   **Giao diện Thích ứng (Adaptive UI):** Khung ảnh album tự động thay đổi kích thước để phù hợp với tỉ lệ của Canvas (ví dụ: mở rộng từ hình vuông 1:1 sang dọc 9:16).
    *   Tự động hiện khi đổi bài hoặc bấm play.
    *   Tự động ẩn player sau 10 giây nếu không tương tác (lời bài hát vẫn hiện để bạn hát theo).
    *   **Chế độ Outro:** Tự động hiện lại và giữ nguyên màn hình trong 20 giây cuối bài hát.
    *   **Ngắt Lời Thông Minh:** Nếu đoạn dạo nhạc (instrumental) dài hơn 10 giây, sẽ không hiện trước câu tiếp theo để tránh rối mắt.
*   **Tùy Biến Dễ Dàng:**
    *   **Chế độ Edit:** Kéo thả vị trí Player và Lyrics thoải mái.
    *   **Scaling:** Chỉnh kích thước to/nhỏ tùy ý bằng thanh trượt.
    *   **Tự động lưu:** Vị trí và kích thước được lưu lại trong trình duyệt.

## 🛠️ Kiến Trúc

Dự án sử dụng mô hình lai **Node.js + PHP** để đảm bảo độ ổn định cao nhất:

1.  **Frontend (HTML/JS):** Gọi về server mỗi giây để cập nhật trạng thái. Xử lý hiển thị, phân tích file LRC (Regex), và hiệu ứng chuyển động.
2.  **Backend (Node.js - Port 8888):**
    *   Xử lý đăng nhập Spotify (OAuth).
    *   Chạy giao diện web.
    *   Quản lý các API (`/api/now-playing`, `/api/lyrics`, `/api/canvas`).
    *   **Canvas API Proxy:** Proxy các request đến Spotify Canvas API và cache video tại local để tiết kiệm băng thông.
    *   Điều khiển server PHP chạy ngầm.
3.  **Microservice (PHP - Port 8100):**
    *   Chạy mã nguồn `spotify-lyrics-api` cục bộ.
    *   Dùng cURL của PHP để giả lập Web Player, giúp vượt qua lỗi chặn "403 Forbidden" của Spotify mà Node.js thường gặp phải.

## 📋 Yêu Cầu Cài Đặt

Trước khi chạy, hãy đảm bảo máy bạn đã có:

1.  **Node.js:** Đã cài đặt.
2.  **PHP:** Đã cài đặt và thêm vào biến môi trường (PATH) của Windows.
    *   **Quan trọng:** Bạn PHẢI bật các extension `curl`, `mbstring`, và `openssl` trong file `php.ini`.
3.  **Tài khoản Spotify Premium:** (Khuyến nghị để lấy lời bài hát tốt nhất, tài khoản Free có thể hạn chế).

## 🚀 Hướng Dẫn Setup

### 0. Tải Mã Nguồn

Đầu tiên, bạn cần tải toàn bộ mã nguồn về máy:

*   **Cách 1 (Khuyên dùng): Clone với Git**
    ```bash
    git clone https://github.com/DemoVPS69420/Spotify_np_lyric.git
    cd Spotify_np_lyric
    ```
    (Hãy thay `https://github.com/DemoVPS69420/Spotify_np_lyric.git` bằng đường link GitHub thực tế của dự án nếu bạn host dự án này).

*   **Cách 2: Tải file ZIP**
    1.  Truy cập trang [repository GitHub](https://github.com/DemoVPS69420/Spotify_np_lyric).
    2.  Bấm nút màu xanh lá "Code" và chọn "Download ZIP".
    3.  Giải nén file ZIP vào một thư mục bạn muốn.
    4.  Mở terminal/cmd và điều hướng đến thư mục vừa giải nén.

### 1. Cài Đặt Thư Viện
Mở terminal tại thư mục dự án và chạy:
```bash
npm install
```

### 2. Cấu Hình PHP
1.  Tìm file `php.ini` trong thư mục cài PHP của bạn.
2.  Mở bằng Notepad và tìm các dòng sau, xóa dấu chấm phẩy `;` ở đầu dòng để kích hoạt:
    ```ini
    extension=curl
    extension=mbstring
    extension=openssl
    ```

### 3. Tạo Ứng Dụng Spotify
1.  Truy cập [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2.  Tạo một App mới.
3.  Trong phần cài đặt App, thêm **Redirect URI** này vào:
    ```
    http://127.0.0.1:8888/callback
    ```
4.  Copy **Client ID** và **Client Secret**.

### 4. Lấy Cookie SP_DC
Cần thiết để lấy lời bài hát và Canvas video từ server Spotify.
1.  Mở trình duyệt (Chrome/Edge/Firefox) vào [open.spotify.com](https://open.spotify.com).
2.  Đăng nhập tài khoản của bạn.
3.  Nhấn **F12** để mở Developer Tools.
4.  Vào tab **Application** (hoặc Storage trên Firefox) -> **Cookies** -> `https://open.spotify.com`.
5.  Tìm cookie tên là `sp_dc` và copy giá trị của nó.

### 5. Thêm Giá Trị/Data Để Lấy Dữ Liệu
Tạo file `.env` ở thư mục gốc (hoặc sửa file có sẵn) và điền thông tin:

```env
SPOTIFY_CLIENT_ID=client_id_cua_ban
SPOTIFY_CLIENT_SECRET=client_secret_cua_ban
SP_DC=cookie_sp_dc_cua_ban
```

## ▶️ Chạy Ứng Dụng

Bạn có thể chạy bằng 2 cách:

**Cách 1: Click đúp vào file `start.bat`**

**Cách 2: Dùng Terminal**
```bash
node server.js
```
*Lưu ý: Server Node sẽ tự động bật server PHP chạy ngầm, bạn không cần bật thủ công.*

## 🎮 Cách Sử Dụng

1.  Mở trình duyệt truy cập `http://127.0.0.1:8888`.
2.  Bấm **"Login with Spotify"**.
3.  Bật nhạc trên app Spotify (PC hoặc điện thoại).
4.  **Chỉnh sửa giao diện:** Bấm nút Bánh Răng (Settings) để:
    *   Kéo thả vị trí Player và Lyrics.
    *   Dùng thanh trượt để chỉnh độ to nhỏ.
    *   Bấm "Save" để lưu lại.
5.  **Setup OBS:** Thêm một "Browser Source" mới, dẫn link `http://127.0.0.1:8888`, chỉnh kích thước `1920x1080` (nhớ tích chọn "Shutdown source when not visible" để tiết kiệm tài nguyên).

## 🐛 Khắc Phục Lỗi (Troubleshooting)

*   **Không hiện lời bài hát?**
    *   Kiểm tra cửa sổ console (`node server.js`).
    *   Nếu thấy lỗi "PHP API returned null": Cookie `SP_DC` có thể đã hết hạn. Hãy lấy cái mới.
    *   Nếu thấy lỗi "Call to undefined function curl_init": Bạn chưa bật `extension=curl` trong `php.ini`.
*   **Overlay không hiện gì cả?**
    *   Đảm bảo bạn đang phát nhạc trên Spotify.
    *   Kiểm tra xem link `http://127.0.0.1:8888` có vào được không.

## 📂 Cấu Trúc Thư Mục

*   `server.js`: Server chính (Node.js).
*   `public/`: Giao diện (HTML, CSS, JS).
*   `public/canvases/`: Thư mục cache cho các video Spotify Canvas đã tải.
*   `lyrics/`: Nơi lưu cache lời bài hát đã tải.
*   `spotify-lyrics-api-main/`: Mã nguồn PHP xử lý việc lấy lời bài hát.
*   `Spotify-Canvas-API-main/`: Module tương tác với Spotify Canvas API.

## 🤝 Credits

*   Logic PHP gốc: [akashrchandran/spotify-lyrics-api](https://github.com/akashrchandran/spotify-lyrics-api)
*   Spotify Canvas API: [Paxsenix0/Spotify-Canvas-API](https://github.com/Paxsenix0/Spotify-Canvas-API)
*   Lrclib: [lrclib.net](https://lrclib.net/) (nguồn lời bài hát dự phòng).
