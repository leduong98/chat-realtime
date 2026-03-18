## 1-1 Realtime Chat (HTTP + SSE)

Ứng dụng chat peer‑to‑peer (P2P) giữa 2 trình duyệt, sử dụng:

- **Next.js App Router** (JavaScript, không TypeScript)
- **TailwindCSS**
- **HTTP POST** để gửi tin nhắn
- **Server-Sent Events (SSE)** để nhận tin nhắn
- **Không dùng database**, lịch sử lưu cục bộ bằng `localStorage`

### 1. Chạy local

Yêu cầu:

- Node.js >= 18 (đang dùng Node 24)
- npm

Lệnh chạy:

```bash
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`.

### 2. Cách 2 người kết nối chat

1. Mở `http://localhost:3000/chat` trên **máy A** và **máy B** (cùng LAN hoặc deploy lên Vercel).
2. Mỗi máy sẽ có **userId** (random) hiển thị trên header.
3. Để chat 1-1:
   - Người A gửi `userId` cho người B và ngược lại (qua bất kỳ kênh nào).
   - **Cả 2 máy đều phải thêm peer của nhau**:
     - Máy A: nhập `peerId` = `userId` của máy B → bấm **Kết nối mới** → **Thêm & mở chat**
     - Máy B: nhập `peerId` = `userId` của máy A → bấm **Kết nối mới** → **Thêm & mở chat**
   - Lý do: message gửi theo `toId` nên nếu chỉ 1 bên thêm peer thì chỉ chat 1 chiều.
4. **Quan trọng (ephemeral):**
   - Server **không lưu message**.
   - Server chỉ đẩy message nếu người nhận đang mở SSE (`/api/stream`) tại thời điểm gửi.
   - Nếu người nhận offline/không mở SSE → message **mất** (đúng yêu cầu).
5. Mỗi máy:
   - Lưu lịch sử chat cục bộ trong `localStorage` với cấu trúc:

     ```json
     {
       "chatId": "peer-username-or-id",
       "senderId": "local-or-peer-id",
       "message": "nội dung hoặc base64",
       "timestamp": 1710000000000
     }
     ```

   - Khi reload trang, lịch sử trên **máy đó** vẫn còn; máy kia có lịch sử riêng.

### 3. Tính năng chính

- **Realtime đơn giản (không WebSocket/WebRTC)**:
  - `POST /api/send` để gửi tin.
  - `GET /api/stream?userId=...` (SSE) để nhận tin.
- **UI Chat**:
  - Header hiển thị `username`, trạng thái kết nối, nút copy địa chỉ chat.
  - Khu vực chat dạng bubble, phân biệt tin nhắn gửi/nhận.
  - Input gồm:
    - Ô nhập text.
    - Nút gửi.
    - Nút emoji + emoji picker.
    - Nút gửi ảnh nhỏ (base64).
- **Emoji**:
  - Tích hợp `emoji-mart`.
  - Click emoji để chèn vào ô input.
- **Trạng thái & UX**:
  - Hiển thị trạng thái: `connecting`, `connected`, `disconnected`.
  - Typing indicator: hiển thị khi peer đang nhập.
  - Auto scroll xuống tin nhắn mới (theo chiều render).
- **LocalStorage**:
  - Lưu tin nhắn dạng:

    ```json
    {
      "chatId": "peerId",
      "senderId": "userId",
      "message": "string hoặc base64 image",
      "timestamp": 1710000000000
    }
    ```

- **Bonus**:
  - Typing indicator (best-effort).
  - Sound notification (best-effort).

### 4. Deploy lên Vercel

1. Push code lên GitHub/GitLab.
2. Vào Vercel, chọn **New Project** và import repo.
3. Vercel tự detect Next.js:
   - Build command: `npm run build`
   - Output: `.next`
4. Deploy, sau khi xong bạn sẽ có URL dạng `https://your-app.vercel.app`.
5. Hai người chỉ cần mở `https://your-app.vercel.app/chat` rồi nhập `peerId` để chat.

