# 📸 PhotoXinhh - Ứng Dụng Web & Kiosk Photobooth

Hệ thống ứng dụng Photobooth chuẩn Hàn Quốc (Life Four Cuts / Photoism) cho phép chụp ảnh trực tiếp tại booth hoặc tải ảnh lên để ghép vào các mẫu khung dải (Photo Strip) thời thượng, hỗ trợ xuất in 300 DPI và quét QR tải về điện thoại.

---

## 🚀 1. Cách chạy ứng dụng Web

1. **Cài đặt thư viện (nếu chưa cài):**
   ```bash
   npm install
   ```

2. **Chạy máy chủ phát triển (Dev Server):**
   ```bash
   npm run dev
   ```
   👉 Mở trình duyệt và truy cập: [http://localhost:5173](http://localhost:5173)

3. **Build bản Production:**
   ```bash
   npm run build
   ```

---

## ✨ 2. Các tính năng chính đã tích hợp

1. **Phòng Chụp Live Kiosk (Camera Modal):**
   - Hỗ trợ **Webcam**, **Continuity Camera (iPhone)**, **OBS Virtual Camera** hoặc **Fake Camera (Giả lập ảnh mẫu Studio)**.
   - Chế độ đếm ngược 3s kèm hiệu ứng âm thanh tít tít & chớp sáng Flash màn hình.
   - Chụp tự động chuỗi 2, 3 hoặc 4 kiểu ảnh liên tiếp để đổi dáng.

2. **Thư viện Khung Photobooth Đa Dạng (PhotoXinhh Gallery):**
   - **iOS Widget 18**, **Thẻ sinh viên AOF Card**, **Pink Star Y2K**, **Dương Domic Cyan**, **Zootopia**, **Cream Soda**, **35mm Classic Film**, **Seoul Minimal White/Black**, v.v.
   - Bộ lọc danh mục & thanh tìm kiếm khung theo tên.

3. **Tự Tạo & Tải Khung Riêng (+ Dùng Khung Riêng):**
   - Tùy biến số lượng ô ảnh (2 ô, 3 ô, 4 ô), màu nền, màu chữ viền và thông điệp chữ.

4. **Trình Render Canvas Chuẩn In Ấn 300 DPI:**
   - Kéo phóng to/thu nhỏ (Zoom), căn chỉnh vị trí ảnh trong từng ô.
   - Bộ lọc màu: *Trắng hồng Hàn Quốc, Vintage, Trắng đen, Tone lạnh, Pastel*.
   - Gắn sticker biểu cảm dễ thương (🎀, ⭐, 💖, 🍒, 🧸...).

5. **Xuất In & Chia Sẻ QR Code (Export Modal):**
   - Tải file ảnh chất lượng cao 300 DPI (`.png`).
   - Hỗ trợ xem trước 2 chế độ in: **Dải đơn (2x6 inch)** hoặc **Dải đôi (4x6 inch)** có sẵn đường cắt (chuẩn máy in nhiệt DNP RX1HS / HiTi P525L).
   - Tự động tạo **Mã QR** để khách quét bằng điện thoại tải ảnh gốc.

---

## 🛠 3. Cấu trúc thư mục

```
Photobooth/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # Thanh điều hướng, nút chế độ, full màn hình
│   │   ├── CameraCaptureModal.tsx # Phòng chụp ảnh trực tiếp & âm thanh
│   │   ├── FrameSelector.tsx      # Bộ sưu tập chọn mẫu khung
│   │   ├── CanvasRenderer.tsx     # Bộ dựng ảnh Canvas & xuất 300 DPI
│   │   ├── CustomFrameModal.tsx   # Modal tạo khung tùy chỉnh
│   │   ├── ExportModal.tsx        # Xuất in & mã QR
│   │   └── AdBanner.tsx           # Khung quảng cáo dưới chân trang
│   ├── services/
│   │   ├── cameraService.ts       # Kết nối WebRTC & Fake Camera Adapter
│   │   └── printService.ts        # Dựng dải đôi 4x6 & gửi lệnh in ngầm
│   ├── templates/
│   │   ├── presetFrames.ts        # Mẫu khung chuẩn (star1, ios, aof, film...)
│   │   └── samplePhotos.ts        # Kho ảnh mẫu test giả lập
│   ├── utils/
│   │   └── audio.ts               # Bộ phát âm thanh Web Audio (đếm ngược, shutter)
│   ├── types/
│   │   └── photobooth.ts          # Định nghĩa kiểu dữ liệu
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
└── vite.config.ts
```

---

## 📦 4. Hướng dẫn đóng gói thành Desktop App (Electron) khi cần

Khi bạn sẵn sàng đóng gói thành phần mềm máy tính kết nối máy in nhiệt & DSLR:

1. Cài thêm Electron:
   ```bash
   npm install --save-dev electron electron-builder
   ```
2. Thêm file `electron/main.js` để tạo cửa sổ Kiosk Fullscreen và đăng ký IPC lệnh in ngầm (`webContents.print({ silent: true })`).
# photobooth_photoxinhh
