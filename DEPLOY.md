# Hướng dẫn deploy production

## Yêu cầu
- Docker + Docker Compose v2
- Domain hoặc IP server

## Các bước

### 1. Clone repo và build frontend
```bash
git clone https://github.com/BongBang104/quan-ly-ksvkl.git
cd quan-ly-ksvkl
npm install
npm run build        # tạo thư mục dist/ — bắt buộc trước khi docker compose up
```

### 2. Tạo file .env từ .env.example
```bash
cp .env.example .env
```

Chỉnh sửa `.env`:
```
DB_USER=postgres
DB_PASSWORD=<mật_khẩu_mạnh>
DB_NAME=atc_pro
JWT_SECRET=<openssl rand -base64 48>
FRONTEND_URL=https://yourdomain.com   # URL thật của server
HIDDEN_ADMIN_ID=<id_khó_đoán>        # đổi khỏi tctsvip
```

### 3. Khởi động
```bash
docker compose up -d
```

### 4. Lấy mật khẩu superadmin lần đầu
```bash
docker compose logs backend | grep "ONE-TIME PASSWORD"
```

### 5. Kiểm tra
```bash
docker compose ps        # tất cả phải ở trạng thái healthy/running
curl http://localhost/api/health
curl http://localhost/analytics/health
```

## Lưu ý bảo mật
- Không commit file `.env` lên git
- JWT_SECRET phải ≥ 32 ký tự, sinh ngẫu nhiên
- HIDDEN_ADMIN_ID nên đổi khỏi `tctsvip`
- Đặt firewall chỉ mở port 80 (và 443 nếu có HTTPS)
