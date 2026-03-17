## P2P WebRTC Chat

Ứng dụng chat peer‑to‑peer (P2P) giữa 2 trình duyệt, sử dụng:

- **Next.js App Router** (JavaScript, không TypeScript)
- **TailwindCSS**
- **WebRTC DataChannel** cho luồng chat trực tiếp
- **WebSocket signaling** trong `pages/api/signal.js`
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
2. Lần đầu mở, app sẽ:
   - Tạo `userId` random và lưu vào `localStorage`.
   - Hỏi `username` và lưu vào `localStorage`.
3. Ở góc phải header, mỗi người có **địa chỉ chat** dạng:

   - `chat://username#1234`

   Nhấn nút **“Copy địa chỉ”** để copy.

4. Để kết nối:
   - Người A copy địa chỉ của mình gửi cho B (qua bất kỳ kênh nào).
   - Người B dán địa chỉ đó vào ô **Connect** rồi bấm **Connect**.
   - Signaling qua HTTP polling (`/api/signal`) trao đổi offer/answer + ICE.
   - Sau khi bắt tay xong, tin nhắn đi qua **WebRTC DataChannel** (P2P hoặc relay qua TURN).

5. **Máy sau firewall / NAT chặt:** App đã bật **TURN relay** (Open Relay, free). Khi kết nối trực tiếp P2P bị chặn, trình duyệt tự relay qua TURN (port 443) nên vẫn chat được. Muốn dùng TURN riêng: set biến môi trường `NEXT_PUBLIC_TURN_URI`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` (xem `.env.example`).

6. Mỗi máy:
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

- **Kết nối P2P**:
  - WebRTC `RTCPeerConnection` + `DataChannel` cho chat.
  - WebSocket signaling đơn giản ở `pages/api/signal.js`.
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
  - Gửi ảnh nhỏ base64.
  - Dark mode (theo Tailwind & `prefers-color-scheme`).
  - Notification khi có tin nhắn mới (khi tab bị ẩn và user cho phép Notification).

### 4. Deploy lên Vercel

1. Push code lên GitHub/GitLab.
2. Vào Vercel, chọn **New Project** và import repo.
3. Vercel tự detect Next.js:
   - Build command: `npm run build`
   - Output: `.next`
4. Deploy, sau khi xong bạn sẽ có URL dạng `https://your-app.vercel.app`.
5. Hai người chỉ cần mở `https://your-app.vercel.app/chat` rồi kết nối như phần trên.

