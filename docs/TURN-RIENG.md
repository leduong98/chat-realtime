# Cách có TURN riêng

TURN riêng giúp ít bị firewall chặn hơn relay công khai. Hai hướng phổ biến:

---

## Cách 1: Tự host coturn trên VPS (kiểm soát hoàn toàn)

### Bước 1: Thuê VPS

- Bất kỳ VPS nào (DigitalOcean, Vultr, AWS EC2, …), **Ubuntu 22.04**, mở port **3478** (UDP/TCP) và **443** (TLS).

### Bước 2: Cài đặt coturn

```bash
sudo apt update
sudo apt install -y coturn
sudo systemctl enable coturn
```

### Bước 3: Cấu hình

Tạo/sửa file cấu hình:

```bash
sudo nano /etc/turnserver.conf
```

Nội dung tối thiểu (thay `YOUR_PUBLIC_IP` bằng IP public của VPS, `youruser` / `yourpass` là username/password bạn chọn):

```conf
listening-port=3478
tls-listening-port=443
external-ip=YOUR_PUBLIC_IP
realm=yourdomain.com
server-name=yourdomain.com

# User tĩnh (username: youruser, password: yourpass)
lt-cred-mech
user=youruser:yourpass

# TLS (cert có thể dùng Let's Encrypt)
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Chỉ dùng khi đã có TLS
no-tlsv1
no-tlsv1_1
```

Nếu chưa có TLS, có thể tạm bỏ 2 dòng `cert`/`pkey` và dùng port 3478 không mã hóa (ít an toàn hơn).

### Bước 4: Bật coturn và mở firewall

```bash
# Bật daemon
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl restart coturn

# Mở port (ufw)
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Bước 5: Khai báo trong app

Trên Vercel (hoặc `.env.local`), thêm:

```env
NEXT_PUBLIC_TURN_URI=turn:YOUR_PUBLIC_IP:3478?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=youruser
NEXT_PUBLIC_TURN_CREDENTIAL=yourpass
```

Nếu dùng TLS với domain:

```env
NEXT_PUBLIC_TURN_URI=turns:yourdomain.com:443?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=youruser
NEXT_PUBLIC_TURN_CREDENTIAL=yourpass
```

---

## Cách 2: Dùng Metered (TURN-as-a-service)

**Có gói free:** 20GB TURN/tháng, không cần thẻ tín dụng. Đăng ký tại https://dashboard.metered.ca hoặc https://www.metered.ca/tools/openrelay

### Bước 1: Đăng ký

- Vào https://dashboard.metered.ca (hoặc https://www.metered.ca/tools/openrelay), tạo tài khoản miễn phí.
- Vào mục **TURN Server** / **Open Relay** trong dashboard.

### Bước 2: Tạo credential và lấy URI

- Trong dashboard: **TURN Server** → tạo credential (Generate / Add Credential). Bạn sẽ thấy **username** và **password** (credential).
- **Lấy TURN URI** (dashboard không hiện rõ “URI”, làm một trong hai cách sau):
  - **Cách A:** Tìm nút **“Show ICE Servers Array”** (hoặc tương tự) trong trang TURN Credentials. Khi bấm sẽ hiện mảng JSON, trong đó có phần `urls` dạng `turn:xxx.metered.live:443?transport=tcp` — dùng **đúng chuỗi `urls` đó** làm TURN URI.
  - **Cách B:** Tự ghép URI từ tên app của bạn. Trong dashboard thường có **tên app** (hoặc xem URL dạng `dashboard.metered.ca/...` hoặc mục App/Settings). URI sẽ là:
    - `turn:<TÊN_APP>.metered.live:443?transport=tcp`  
    Ví dụ app tên `my-chat` thì URI: `turn:my-chat.metered.live:443?transport=tcp`  
    **Username** và **Credential** (password) chính là cặp bạn thấy trong mục **TURN Credentials**.

### Bước 3: Khai báo trong app

Trên Vercel (hoặc `.env.local`), dùng đúng **một** dòng URI (thay bằng URI bạn lấy ở bước 2):

```env
NEXT_PUBLIC_TURN_URI=turn:<TÊN_APP>.metered.live:443?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=<username_trong_TURN_Credentials>
NEXT_PUBLIC_TURN_CREDENTIAL=<password_trong_TURN_Credentials>
```

- Build lại app (Vercel build lại khi push hoặc Redeploy).
- Chỉ khi có đủ 3 biến trên thì app mới dùng TURN riêng; không set thì vẫn dùng relay công khai mặc định.

---

## Gợi ý

| Cách        | Ưu điểm                    | Nhược điểm              |
|------------|----------------------------|---------------------------|
| **Coturn VPS** | Kiểm soát, IP riêng, ít bị blocklist | Phải tự cấu hình, bảo trì |
| **Metered**    | Nhanh, không cần host      | Giới hạn băng thông, có thể tốn phí khi vượt free |

Nếu mạng rất chặt (công ty/trường), ưu tiên **TURN trên VPS của bạn** (cách 1) với domain/IP riêng.
