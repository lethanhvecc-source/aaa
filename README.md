# Giveaway Tracker trên Netlify

Cấu trúc:

```
public/index.html              <- trang theo dõi (giao diện)
netlify/functions/fetch.mjs    <- proxy tải trang giveaway (thay cho extension Allow CORS)
netlify.toml                   <- cấu hình Netlify
```

Trang web gọi `/api/fetch?url=...`, hàm Netlify tải trang giveaway rồi trả HTML về, nên không còn lỗi CORS và người dùng không cần cài extension.

## Cách đưa lên netlify.app

Kéo-thả thư mục (Netlify Drop) chỉ đưa được phần trang tĩnh, **không chạy được hàm proxy**, nên dùng một trong hai cách sau.

### Cách A: qua GitHub (dễ cập nhật về sau)
1. Tạo repo GitHub mới, đẩy toàn bộ thư mục này lên.
2. Vào https://app.netlify.com > **Add new site** > **Import an existing project** > chọn repo.
3. Build command để trống, Publish directory là `public` (đã có trong `netlify.toml`). Bấm **Deploy**.
4. Sau khi xong sẽ có địa chỉ dạng `https://ten-ban-chon.netlify.app` (đổi tên ở **Site configuration > Change site name**).

### Cách B: dùng Netlify CLI (không cần GitHub)
```bash
cd giveaway-tracker-netlify
npx netlify-cli login
npx netlify-cli deploy --prod --dir=public --functions=netlify/functions
```
Lần đầu CLI sẽ hỏi tạo site mới, cứ làm theo hướng dẫn.

## Tên miền được phép

Mặc định proxy chỉ tải các tên miền đuôi `.club` (các trang hiện tại đều là `.club`). Muốn thêm đuôi khác, vào **Site configuration > Environment variables**, thêm biến:

```
ALLOWED_SUFFIXES = .club,.com
```

rồi deploy lại. Đặt `*` sẽ cho mọi tên miền, không nên vì ai biết địa chỉ site cũng dùng được proxy của bạn.

## Lưu ý
- Danh sách link, nick và cài đặt tự động cập nhật được lưu trong trình duyệt của từng người (localStorage), không lưu trên server.
- Nếu site giveaway chặn địa chỉ IP của máy chủ Netlify thì hàm sẽ báo lỗi, khi đó thẻ hiện "Lỗi kết nối" và Console (F12) ghi rõ mã lỗi.
- Quét quá dày với nhiều link có thể làm hết hạn mức hàm miễn phí của Netlify. Nên để chu kỳ 30 giây trở lên.
