# Saltline — bản phục hồi chạy local

## Hai bản trong repo

| Bản | Source | Đường dẫn khi chạy server |
| --- | --- | --- |
| Saltline gốc | `index.html`, `styles.css`, `game.js` | `/` |
| Sirocco | [demo/](demo/) · [hướng dẫn](demo/README.md) | `/demo/` |

Chạy `python3 -m http.server 5189 --bind 127.0.0.1` từ thư mục repo sau khi clone. Hai bản dùng cùng server, không cần npm install. [TECHNIQUES.md](TECHNIQUES.md) và [tiến độ Sirocco](demo/artifacts/game-progress.md) được lưu cùng source. Một số liên kết số dòng trong tài liệu dùng đường dẫn tuyệt đối của workspace ban đầu.

**Trạng thái snapshot Git:** Saltline gốc giữ nguyên hash. Sirocco gồm thay đổi tay/vũ khí đang làm dở; kiểm mới nhất trong [hands-weapons/report.json](demo/artifacts/hands-weapons/report.json) chưa đạt: AK còn 8 mesh thay vì 7 bucket dự kiến. Các kết quả 43/23 ca trong báo cáo trước thuộc phiên bản trước lượt sửa tay/vũ khí, không chứng nhận snapshot hiện tại. Cú pháp 17 file JavaScript đã kiểm đạt trước khi lưu Git.

[MEOW] Chơi Saltline gốc online tại [meowsolo.com/gameaaa](https://meowsolo.com/gameaaa). Xem [cấu hình phát hành](/Users/meow/rea/saltline-reverse/deploy/README.md).

[MEOW] Bản demo mới: [Sirocco — đặt/gỡ bom đấu bot](http://127.0.0.1:5189/demo/). Xem [hướng dẫn demo](/Users/meow/rea/saltline-reverse/demo/README.md) và [phân tích kỹ thuật/quy trình/prompt](/Users/meow/rea/saltline-reverse/ORIGINAL-WORKFLOW.md). Phần dưới mô tả bản Saltline gốc được giữ nguyên.

[MEOW] Đã phục hồi game từ [Claude artifact công khai](https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp) ngày 10/11/2026. `game.js` và `styles.css` giữ nguyên nội dung được gửi tới browser; HTML được tách khỏi lớp nhúng của Claude để chạy độc lập.

Đây là bundle đã đóng gói, có tên biến rút gọn; chưa khôi phục cây mã nguồn và tên biến nguyên gốc. Game dùng Three.js r180, WebGL2 và JavaScript thuần.

## Chạy game

Không cần `npm install` hoặc bước build. Chạy trong Terminal:

```sh
cd /Users/meow/rea/saltline-reverse
python3 -m http.server 5189 --bind 127.0.0.1
```

Mở [Saltline local](http://127.0.0.1:5189/), chọn **Deploy**. Nếu server đã chạy ở cổng này, chỉ cần mở đường dẫn. Nhấn `Ctrl+C` trong Terminal để dừng server.

Mục tiêu: cắt đủ ba relay bằng cách đứng gần, nhìn về relay và giữ **E**, rồi đến thuyền để thoát.

| Điều khiển | Phím/nút |
| --- | --- |
| Di chuyển | WASD |
| Nhìn | Chuột; có phương án dự phòng bằng phím mũi tên hoặc IJKL |
| Bắn / ngắm | Chuột trái / chuột phải; Enter cũng bắn |
| Nạp đạn | R |
| Cắt relay | Giữ E |
| Nhảy / chạy / ngồi | Space / Shift / C hoặc Ctrl |
| Tạm dừng | P hoặc Esc |

UI gốc còn liệt kê F cho đánh cận chiến, nhưng chưa xác nhận thao tác này hoạt động; xem ghi chú trong báo cáo. Browser nhúng có thể không hỗ trợ khóa con trỏ; phương án điều khiển dự phòng của game đã được thử.

## Các file bàn giao

| File | Nội dung |
| --- | --- |
| `index.html`, `styles.css`, `game.js` | Ba file cần để chạy game |
| `REVERSE.md` | Phân tích gameplay, kiến trúc, đồ họa và giới hạn kết luận |
| `ASSETS.md` | Phân loại file, mô hình, texture, vật liệu, âm thanh, UI và nhiệm vụ của từng nhóm |
| `TECHNIQUES.md` | Kỹ thuật sinh hình học, vật liệu, hiệu ứng và âm thanh bằng code, kèm số dòng dẫn chứng |
| [PROCEDURAL-ASSETS-ANALYSIS.md](/Users/meow/rea/saltline-reverse/PROCEDURAL-ASSETS-ANALYSIS.md) | Bài phân tích kỹ thuật hoàn chỉnh về hình học tham số, shader sinh texture, vật liệu PBR, decal và tối ưu tài nguyên của Saltline gốc |
| `evidence/game.pretty.js` | Bundle đã định dạng để đọc, không dùng làm file chạy |
| `evidence/game-page.html` | HTML frame gốc đã thu hồi |
| `evidence/game.bundle.js` | Bundle gốc để đối chiếu |
| `evidence/recovery-manifest.json` | Nguồn, kích thước và SHA-256 của file |
| `evidence/verification-report.json` | Kết quả 22 kiểm tra tự động đã đạt |
| `evidence/verification-third.json` | Capture browser đầy đủ của lượt kiểm tra đạt |
| `evidence/rea-evidence-bundle.json` | Gói bằng chứng REA có thể lưu trữ độc lập |
| `evidence/gameplay-1280.png` | Ảnh gameplay local 1280 × 720 |
| `tests/verify.html`, `tests/verify.js` | Bộ kiểm tra chạy trên bundle gốc |
| `recover.py` | Tái tạo ba file chạy từ HTML gốc đã lưu |
| `progress.md` | Trạng thái và ghi chú bàn giao cho phiên tiếp theo |

## Kiểm chứng

Đã đạt **22/22 kiểm tra runtime**: khởi động, phiên bản engine, module không dùng bản dự phòng, trạng thái đầu, di chuyển, bắn/nạp đạn, pause/resume, điều kiện hướng nhìn của relay, giữ/thả E, cắt cả ba relay, mở điểm thoát, thắng, reset, chết và retry. Kết quả được ghi từ Chromium 157.0.8103.50 với WebGL2.

Để chạy lại, mở [trang kiểm tra](http://127.0.0.1:5189/tests/verify.html) và giữ tab hoạt động tới khi kết quả có `"status": "passed"`. Bộ kiểm tra dùng phím giả lập, đặt vị trí nhân vật và bật bất tử ở bước relay để cô lập luật chơi; đây **không phải lượt thắng tự nhiên bằng tay**. Âm thanh tắt trong fixture.

Các kiểm tra tĩnh đã đạt:

```sh
node --check game.js
node --check tests/verify.js
cmp game.js evidence/game.bundle.js
```

`python3 recover.py` đã chạy thành công và có thể tái tạo bản phục hồi, nhưng sẽ ghi lại `index.html`, `styles.css`, `game.js` và manifest từ bản gốc đã lưu. Không dùng lệnh này để giữ những chỉnh sửa game về sau.

Đã thử trực tiếp deploy, di chuyển, bắn/nạp đạn, pause/resume, chết/retry, mở Settings và đổi viewport tới 390 × 844. Chưa thử thiết bị cảm ứng thực, gamepad, chất lượng âm thanh hoặc hiệu năng dài hạn. Capture đạt không có lỗi JavaScript của game; có HTTP 404 cho `favicon.ico`.

Các font vẫn tải từ Google Fonts theo HTML gốc. Không coi đây là bản đã kiểm chứng ngoại tuyến hoàn toàn.

Đọc [báo cáo reverse](/Users/meow/rea/saltline-reverse/REVERSE.md) để tra kiến trúc và bằng chứng, hoặc [bảng tài nguyên](/Users/meow/rea/saltline-reverse/ASSETS.md) để biết từng thành phần dùng làm gì.
