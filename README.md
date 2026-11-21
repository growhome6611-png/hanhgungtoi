# 700 bài thuốc dưỡng sinh – Trị bệnh bằng Hành, Gừng, Tỏi

Ứng dụng web để tra cứu nội dung sách **700 bài thuốc dưỡng sinh – Trị bệnh bằng Hành, Gừng, Tỏi** trên điện thoại. Sau khi đưa lên Vercel, bạn có thể thêm biểu tượng ra màn hình chính của Android hoặc iPhone.

Ứng dụng chạy bằng HTML, CSS và JavaScript; không cần API key, cơ sở dữ liệu hay tài khoản đăng nhập. Nội dung được chuyển từ bản PDF bạn cung cấp và giữ liên kết đối chiếu với trang gốc.

Tài liệu nguồn: **Trương Chí Hoa**, **Ngọc Minh dịch**, **Nhà xuất bản Thanh Hoá**; tệp PDF gồm **371 trang**. Cụm “700 bài thuốc” thuộc tên sách. Số mục tra cứu hiển thị trong ứng dụng được tính từ dữ liệu đã biên tập, không mặc định bằng số trong nhan đề.

## Mở ngay trên máy tính

1. Giải nén toàn bộ gói ZIP.
2. Mở tệp **`Mo_Ung_Dung.html`** bằng Chrome, Edge hoặc Safari. Tệp này đã chứa giao diện và toàn bộ dữ liệu chữ, nên đọc và tìm kiếm được khi không có mạng, không cần cài Node.js.
3. Giữ thư mục `source` cạnh tệp HTML để mở PDF đối chiếu.

Bản tệp phù hợp với máy tính. Điện thoại nên dùng địa chỉ Vercel rồi thêm ra màn hình chính theo hướng dẫn bên dưới. Ghi chú của bản tệp và bản web được lưu riêng theo trình duyệt; dùng chức năng xuất/nhập sao lưu để chuyển giữa hai bản.

Nội dung gồm **276 chủ đề trong 10 chương**, được tách thành **722 bài thuốc và 8 mục tham khảo**. Word giữ đầy đủ 371 trang nguồn; ứng dụng bỏ hiển thị lặp hai trang scan trùng để tra cứu gọn hơn.

## Chất lượng bản chuyển đổi

Đây là bản số hóa từ sách scan. Bản Word giữ 371 trang theo thứ tự nguồn; phần nội dung là chữ có thể sửa, riêng hai trang bìa/nhan đề đầu được giữ bằng hình ảnh. Đã rà bố cục từng trang, mục lục, số bài, nhãn trường và nhiều chỗ nhận dạng đáng ngờ. Bản chữ vẫn có thể còn lỗi OCR và chưa được thẩm định nội dung y khoa.

Một số trang của nguồn bị mờ hoặc cắt mất chữ, kể cả phần nguyên liệu và số lượng. Các mục có vấn đề đã nhận diện được có ghi chú trong ứng dụng; Word có bình luận tại các trang liên quan. Ký hiệu **[chữ mờ]** hoặc dấu **…** ở chỗ mất mép cho biết chưa khôi phục đủ chữ. Dùng liên kết **PDF gốc** để đối chiếu khi cần.

## Đưa ứng dụng lên Vercel

### Cách nhanh: tải gói ZIP bằng Vercel Drop

1. Đăng nhập tài khoản Vercel của bạn và mở [Vercel Drop](https://vercel.com/drop).
2. Chọn tệp ZIP của ứng dụng hoặc kéo thả tệp vào trang.
3. Chọn tài khoản/nhóm, đặt tên dự án, rồi chọn **Deploy**.
4. Chờ hoàn tất và mở địa chỉ ứng dụng được Vercel cung cấp.

Với cách này, có thể tải nguyên gói ZIP, không cần GitHub. Nên đăng nhập trước để giữ dự án trong tài khoản của bạn. Triển khai không đăng nhập chỉ tồn tại tạm thời và cần **Claim Project** trước khi hết hạn.

Khi cập nhật bằng cách này, đổi `VERSION` trong `sw.js` rồi tải thư mục bản mới vào đúng dự án đã có trong Vercel Dashboard. Tải lại trên trang Drop sẽ tạo một dự án mới.

### Cách qua GitHub: 1. Chuẩn bị mã nguồn

1. Giải nén gói ứng dụng trên máy tính.
2. Tạo một repository mới trên GitHub. Có thể chọn **Private** để giữ mã nguồn trong tài khoản của bạn.
3. Chọn **Add file → Upload files** và tải **các tệp, thư mục bên trong gói đã giải nén** lên repository.
4. Kiểm tra trang đầu repository nhìn thấy `index.html`, `app.js`, `styles.css`, `vercel.json`, cùng các thư mục `data`, `lib`, `icons`, `assets`, `source`.
5. Bấm **Commit changes**.

Không tải nguyên tệp ZIP vào repository để triển khai: Vercel cần nhìn thấy `index.html` trong thư mục gốc của dự án.

### Cách qua GitHub: 2. Tạo dự án Vercel

1. Đăng nhập [Vercel](https://vercel.com/).
2. Chọn **Add New → Project**.
3. Chọn **Import** ở repository vừa tạo.
4. Kiểm tra cấu hình:

| Mục | Giá trị |
| --- | --- |
| Framework Preset | **Other** |
| Root Directory | Thư mục chứa `index.html`; để mặc định nếu tệp ở gốc repository |
| Build Command | Bật Override và **để trống** |
| Output Directory | **`.`**; gói đã khai báo trong `vercel.json` |
| Install Command | **Để trống**; gói không dùng thư viện cài thêm |
| Environment Variables | Không cần nhập |

5. Bấm **Deploy**.
6. Khi Vercel báo **Ready**, mở địa chỉ dạng `https://ten-du-an.vercel.app` để kiểm tra.

Gói đã có `vercel.json` để Vercel đọc đúng cấu hình ứng dụng tĩnh. Nếu repository chứa cả một thư mục bọc ngoài, chọn thư mục đó trong **Root Directory** hoặc chuyển các tệp ứng dụng lên gốc repository.

Ứng dụng chưa có lớp đăng nhập riêng. Quyền riêng tư của repository GitHub không tự làm địa chỉ triển khai Vercel trở thành riêng tư; hãy chọn cách bảo vệ địa chỉ triển khai trong tài khoản Vercel phù hợp với người bạn muốn cho truy cập.

## Cài trên điện thoại Android

1. Mở địa chỉ Vercel bằng **Chrome** trên điện thoại.
2. Đợi nội dung tải xong.
3. Nếu ứng dụng hiện nút cài đặt, chạm nút đó và xác nhận.
4. Hoặc mở menu **⋮** của Chrome, chọn **Cài đặt và tạo lối tắt / Install and create shortcut**, rồi **Cài đặt / Install**. Một số phiên bản ghi **Thêm vào màn hình chính / Add to Home Screen** hoặc **Cài đặt ứng dụng / Install app**.
5. Mở lại bằng biểu tượng **Hành Gừng Tỏi** ở màn hình chính.

Nếu đang mở liên kết trong trình duyệt bên trong một ứng dụng nhắn tin, chọn **Mở bằng Chrome** trước khi cài.

## Cài trên iPhone

1. Mở địa chỉ Vercel bằng **Safari**.
2. Chạm nút **Chia sẻ**.
3. Chọn **Thêm vào Màn hình chính / Add to Home Screen**; có thể cần cuộn danh sách thao tác.
4. Nếu có tùy chọn **Mở dưới dạng ứng dụng web / Open as Web App**, bật tùy chọn đó.
5. Chạm **Thêm / Add** và mở ứng dụng từ biểu tượng mới.

## Tra cứu và sử dụng ngoại tuyến

- Tìm theo nhóm nội dung, bài thuốc hoặc vị thuốc. Có thể gõ tiếng Việt có dấu hoặc không dấu.
- Chọn nhóm để thu hẹp danh sách, sau đó mở mục cần đọc.
- Phần chi tiết giữ các mục và số lượng theo nội dung sách; số trang giúp đối chiếu PDF.
- Lưu các bài thường tra cứu vào mục **Đã lưu**.

Ở lần mở đầu khi có mạng, chờ nhãn trạng thái hiện **“Sẵn sàng offline”**. Khi đó, toàn bộ dữ liệu chữ và các tệp chính của ứng dụng đã được lưu để tra cứu mà không cần kết nối internet.

**PDF gốc được lưu riêng.** Khi đang có mạng, mở **Tùy chọn → Lưu PDF gốc để đọc offline** và chờ thông báo **“PDF gốc đã có bản lưu ngoại tuyến trên thiết bị.”** Sau đó bạn có thể mở các liên kết đối chiếu trang gốc ngay trong ứng dụng khi mất mạng.

Chỉ mở PDF bằng trình xem của điện thoại chưa chắc đã tải toàn bộ tệp. Nếu muốn giữ thêm một bản để đọc ngoài ứng dụng, tải PDF vào thư mục Tệp hoặc Tải xuống của điện thoại.

## Dữ liệu cá nhân và sao lưu

Danh sách đã lưu, ghi chú và tùy chọn đọc được giữ trong trình duyệt trên **thiết bị đang dùng**. Chúng chưa tự đồng bộ giữa điện thoại và máy tính hoặc giữa hai trình duyệt.

Trước khi đổi thiết bị hoặc xóa dữ liệu trình duyệt:

1. Dùng chức năng **Xuất sao lưu** trong ứng dụng và giữ tệp JSON.
2. Trên thiết bị mới, mở cùng ứng dụng rồi dùng **Nhập sao lưu**.
3. Việc nhập gộp các bài đã lưu. Ghi chú đang có được giữ lại; nội dung ghi chú khác trong bản sao lưu được bổ sung để bạn tự rà soát.

Nếu trình duyệt không cho lưu dữ liệu, ứng dụng vẫn có thể hoạt động trong phiên hiện tại nhưng thông tin cá nhân có thể không còn sau khi đóng trang. Xuất bản sao lưu trước khi kết thúc phiên đó.

## Cập nhật phiên bản

1. Chỉnh mã nguồn hoặc nội dung sách trong thư mục ứng dụng.
2. **Đổi hằng `VERSION` ở đầu `sw.js`**, ví dụ từ `2026-11-21-hgt-v1-final` sang `2026-11-21-hgt-v2`. Thao tác này cần thực hiện khi thay đổi các tệp ứng dụng, thư viện JS hoặc `data/book.json`.
3. Nếu dùng GitHub, commit các thay đổi để Vercel triển khai từ repository đã liên kết. Nếu dùng Vercel Drop, tải thư mục mới vào đúng dự án đã có trong Dashboard.
4. Mở ứng dụng khi có mạng. Khi hiện thông báo bản mới, chọn cập nhật.

Ứng dụng chỉ nhận bộ tệp ngoại tuyến mới khi chúng đã được tải đầy đủ. Bản cập nhật không xóa danh sách đã lưu hoặc ghi chú trong trình duyệt.

## Chạy thử trên máy tính

Cài Node.js phiên bản 18 trở lên, mở terminal trong thư mục ứng dụng rồi chạy:

```bash
npm start
```

Mở `http://127.0.0.1:4173`. Không cần chạy `npm install` vì gói không có dependency.

Để dùng cổng khác:

```bash
node scripts/serve.mjs --port 4175
```

Để kiểm tra cú pháp JavaScript:

```bash
npm run check
```

Để mở trực tiếp bằng cách bấm đúp, dùng **`Mo_Ung_Dung.html`**. Tệp `index.html` là bản triển khai web, cần máy chủ local hoặc địa chỉ HTTPS. Sau khi sửa dữ liệu hoặc giao diện, chạy `npm run portable` để tạo lại bản tệp.

## Cấu trúc gói

| Tệp hoặc thư mục | Nội dung |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Giao diện và chức năng tra cứu |
| `Mo_Ung_Dung.html` | Bản tra cứu mở trực tiếp, đã nhúng dữ liệu chữ và hình ảnh |
| `lib/` | Tìm kiếm và quản lý dữ liệu cá nhân |
| `data/book.json` | Dữ liệu bài thuốc được cấu trúc từ sách |
| `source/book.pdf` | PDF gốc để đối chiếu |
| `assets/cover.webp` | Ảnh bìa sách |
| `manifest.webmanifest`, `sw.js` | Cài lên màn hình chính, dùng ngoại tuyến, nhận bản cập nhật |
| `icons/` | Biểu tượng ứng dụng |
| `vercel.json` | Cấu hình triển khai Vercel |
| `scripts/serve.mjs` | Máy chủ chạy thử cục bộ, không cần thư viện cài thêm |

## Tài liệu kỹ thuật chính thức

- [Vercel Drop — triển khai trực tiếp tệp, thư mục hoặc ZIP](https://vercel.com/docs/drop)
- [Vercel — cấu hình build và bỏ qua bước build cho trang HTML/CSS/JS](https://vercel.com/docs/builds/configure-a-build)
- [Vercel — cấu hình bằng vercel.json](https://vercel.com/docs/project-configuration/vercel-json)
- [Google Chrome — sử dụng và cài ứng dụng web](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid)
- [Apple — đưa trang web thành ứng dụng trên iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios)
- [MDN — service worker và bộ nhớ đệm](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
