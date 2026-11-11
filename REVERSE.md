# Saltline — báo cáo reverse

[MEOW] Kết quả ngày 10/11/2026: đã thu hồi bundle và CSS của [game công khai](https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp), tạo bản chạy local, đọc cấu trúc chương trình và kiểm chứng 22 hành vi runtime. Không thay đổi gameplay, đồ họa hoặc phiên bản dependency.

## 1. Phạm vi và độ chắc chắn

Nguồn thu hồi là HTML của frame công khai được artifact nhúng. HTML thô nằm trong `evidence/game-page.html`; URL nguồn, biến đổi và mã kiểm tra file nằm trong [manifest](/Users/meow/rea/saltline-reverse/evidence/recovery-manifest.json:1).

`game.js` giống từng byte với `evidence/game.bundle.js`:

```text
SHA-256: 8d0057dc4d6dac77e20be2ef1f2b623e19346b5803fde1b3dbabbab508d75d9d
Kích thước: 1.391.985 byte
```

Thay đổi để chạy local chỉ gồm bỏ runtime nhúng của Claude, đưa CSS/JavaScript sang file riêng và thêm khung HTML có charset/viewport. [Script phục hồi](/Users/meow/rea/saltline-reverse/recover.py:1) tái tạo được kết quả này từ bằng chứng đã lưu.

`game.pretty.js` là bundle được định dạng lại, vẫn còn tên biến rút gọn. Không tìm thấy `sourceMappingURL` trong bundle được kiểm tra. Tên các hệ thống trong bảng dưới là cách diễn giải chức năng từ mã, không phải tên thư mục nguồn đã khôi phục.

## 2. Kiến trúc chương trình

Game dùng **Three.js r180**, renderer WebGL và JavaScript thuần. Phiên bản `180` có trong [mã engine](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:431), đồng thời kiểm tra runtime xác nhận WebGL2. Không có bước build hoặc thư viện ngoài cần cài để chạy bundle đã thu hồi.

| Hệ thống | Hàm trong bundle | Điểm đọc |
| --- | --- | --- |
| Renderer, camera, hậu kỳ | `Hg` | [36902](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36902) |
| Vật liệu tạo bằng mã | `Gg` | [39765](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39765) |
| Va chạm/vật lý | `d3` | [40156](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:40156) |
| Bố trí màn chơi | `C1` | [50596](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:50596) |
| Phông cảnh | `pv` | [54079](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54079) |
| Mặt đất và phản chiếu | `O1` | [55386](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55386) |
| Hiệu ứng | `Cf` | [57447](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:57447) |
| Web Audio | `c_` | [61883](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:61883) |
| Đầu vào | `v_` | [63161](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63161) |
| Nhân vật người chơi | `x_` | [63654](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63654) |
| Xét trúng đạn và sát thương | `zv` | [64079](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64079) |
| Súng và chuyển động súng | `dm` | [66780](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:66780) |
| Quản lý kẻ địch | `Em` | [70321](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:70321) |
| HUD | `hM` | [70892](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:70892) |
| Trạng thái nhiệm vụ | `mM` | [71841](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71841) |
| Khởi tạo và nối hệ thống | `QC` | [72590](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72590) |

[Vòng lặp chính](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72771) lấy đầu vào, cập nhật nhiệm vụ, nhân vật/súng/kẻ địch, môi trường/hiệu ứng, âm thanh/HUD rồi vẽ khung hình. Bước thời gian bị chặn tối đa 0,05 giây. Các hệ thống dùng đối tượng ngữ cảnh chung và sự kiện để trao đổi trạng thái.

Bundle tự cung cấp `window.__G`, `__ready`, `__errors` và `__stats` để quan sát. Bộ kiểm tra dùng các điểm truy cập có sẵn này, không chèn hook vào `game.js`. [Điểm xuất ngữ cảnh](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72602).

## 3. Luật chơi và các thông số

Vòng nhiệm vụ chính là **title → intro → playing → complete/dead**, có pause/resume và retry. Mỗi lượt bắt đầu lại sẽ reset nhân vật, súng, kẻ địch và relay. Mục tiêu là cắt ba relay rồi đến vùng thoát cạnh thuyền. [Bộ điều khiển nhiệm vụ](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71841).

### Nhân vật và súng

| Thông số | Giá trị đọc từ mã |
| --- | --- |
| Máu ban đầu | 100 |
| Tốc độ đi / chạy / ngồi / khi ngắm | 3,8 / 6,4 / 1,9 / 2,4 đơn vị thế giới mỗi giây |
| Hồi máu | Chờ 4 giây sau sát thương, hồi 25 điểm/giây |
| Súng | PAC-9 Longshore |
| Băng đạn / dự trữ ban đầu | 30 / 150 |
| Tốc độ bắn | 720 phát/phút |
| Sát thương cơ bản mỗi phát | 26 |
| Tầm xét tia | 300 đơn vị |
| Nạp còn đạn / hết đạn | 2,1 / 2,72 giây |

Nguồn: [cấu hình di chuyển](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63615), [nhân vật](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63697), [tên súng](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64406), [thông số súng](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:66759).

Đạn của người chơi dùng **hitscan**: xét một tia ngay khi bắn, thay vì mô phỏng viên đạn bay từng khung hình. Va chạm với cảnh giới hạn khoảng cách có thể trúng kẻ địch; điểm yếu nhân sát thương 2,2. [Logic xét trúng](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64079).

### Relay và chiến thắng

- Phải ở trong khoảng 2,2 đơn vị, chênh cao không quá 2,5. Khi xa hơn 0,9 đơn vị, hướng nhìn phải đủ gần hướng tới relay; ngưỡng tích vô hướng là 0,45.
- Giữ E tổng cộng 2,4 giây để cắt; thả hoặc rời điều kiện làm tiến độ chuẩn hóa giảm 1,6 mỗi giây.
- Mỗi relay bị cắt kích hoạt một đợt kẻ địch. Ba đợt cấu hình lần lượt là 3 Gull + 1 Hound, 3 + 2, và 4 + 3; giới hạn đang sống là 9.
- Chỉ hoàn tất khi đã cắt cả ba, nhân vật còn sống và vào vùng thoát: bán kính mặc định 2,5, chênh cao dưới 3,5.

Nguồn: [cấu hình nhiệm vụ](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71798), [điều kiện tương tác và thoát](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72335), [xử lý cắt relay](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72400).

Xếp hạng cuối lượt dùng tổng điểm từ thời gian, độ chính xác và số retry: dưới 270 giây được 2 điểm, dưới 400 giây được 1; độ chính xác ít nhất 50% được 2, ít nhất 30% được 1; không retry được 1. Tổng 0–5 ánh xạ sang Messy, Loud, Steady, Clean, Sharp, Surgical. [Công thức tổng kết](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72419).

### Kẻ địch

Gull có 45 máu, sát thương đạn 7, loạt 3; Hound có 140 máu, sát thương bắn 5, loạt 4 và đòn lao 15. AI có kiểm tra tầm nhìn/che khuất, trạng thái tuần tra, giao chiến và tìm kiếm; tiếng súng có thể kích hoạt điều tra. Hệ thống giới hạn số lượt tấn công đồng thời để tránh tất cả kẻ địch cùng bắn.

Nguồn: [Gull](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:68732), [Hound](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:69299), [cấu hình AI](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:70292), [quản lý AI](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:70321). Đây là phân tích mã; chưa thử bao phủ mọi nhánh hành vi AI trong browser.

## 4. Đồ họa và âm thanh

Hình ảnh cảng ướt, container, nhà kho và súng được ghép từ hình học và vật liệu tạo bằng mã. `Gg` chạy shader tạo texture/vật liệu; phần mặt đất kết hợp vũng nước, vệt dầu, khe bê tông, vết nứt và sơn. Mặt nước có phản chiếu phẳng. [Vật liệu](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39765), [shader mặt đất](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54599), [phản chiếu](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54828).

Renderer có camera/lớp riêng cho súng, bóng đổ, hiệu ứng giảm sáng ở góc khuất (AO), ánh sáng xuyên sương, bloom, motion blur, điều chỉnh phơi sáng và chuyển màu HDR về màn hình. Chất lượng tự động hoặc low/medium/high/ultra quyết định độ phân giải bóng, texture và mức hiệu ứng. [Renderer](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36902), [pipeline hậu kỳ](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36722), [bảng chất lượng](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:34913).

Có điều chỉnh độ phân giải theo thời gian khung hình; vì vậy canvas render có thể nhỏ hơn kích thước hiển thị. [Cơ chế điều chỉnh](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37100). Trong một snapshot kiểm tra, renderer ghi 388 draw calls và khoảng 2,01 triệu tam giác, buffer 864 × 486 cho viewport 960 × 540. Đây là một thời điểm quan sát, **không phải benchmark ổn định** hay cam kết FPS trên thiết bị khác.

Âm thanh dùng Web Audio và tạo buffer bằng mã. [Khởi tạo âm thanh](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:61883). Chưa nghe và đánh giá chất lượng/định vị âm thanh; fixture tự động chạy với `noaudio=1`.

Capture kiểm tra chỉ ghi nhận request tới localhost và Google Fonts. HTML gốc tải Big Shoulders Display, IBM Plex Mono và Barlow Condensed từ Google; vì vậy không khẳng định bản phục hồi hoàn toàn ngoại tuyến. [Khai báo font](/Users/meow/rea/saltline-reverse/index.html:8).

## 5. Thiết lập và điểm cần chú ý

Game lưu quality, độ nhạy chuột, invert Y, âm lượng và FOV vào `localStorage` với khóa `saltline.settings.v1`. Chưa thấy lưu tiến độ nhiệm vụ trong bundle được kiểm tra. [Đọc/ghi thiết lập](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71423).

**Cận chiến của người chơi chưa được xác nhận:** UI ghi phím F và input có F/V → `melee`; âm thanh có listener `weapon:melee`. Tuy nhiên, tìm trong bundle chưa thấy nơi tiêu thụ input này để thực hiện đòn đánh hoặc phát sự kiện tương ứng. Đây là dấu hiệu tính năng gốc có thể chưa nối đủ, không phải kết luận đã tái hiện lỗi. Không sửa phần này trong task phục hồi. [Input](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63126), [UI](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71460), [listener âm thanh](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:62584).

## 6. Bằng chứng kiểm chứng

| Nhóm | Kết quả và giới hạn |
| --- | --- |
| Phục hồi | `recover.py` chạy thành công; bundle khớp từng byte; 5/5 file đúng kích thước và SHA-256 trong manifest |
| Cú pháp | `node --check game.js` và `node --check tests/verify.js` đạt |
| Runtime tự động | 22/22 đạt trên Chromium 157.0.8103.50, WebGL2 |
| Chơi trực tiếp | Deploy, đi, bắn, nạp đạn, pause/resume, chết/retry và mở Settings đã thử |
| Thay đổi kích thước | Đã quan sát ở viewport 390 × 844; chưa thử điện thoại cảm ứng thật |
| Lỗi | Capture đạt không có page error và `__errors` rỗng; có 404 cho `favicon.ico` |
| Chưa bao phủ | Thắng tự nhiên toàn màn, toàn bộ AI, gamepad, cảm ứng thật, nghe âm thanh và hiệu năng dài hạn |

22 kiểm tra cụ thể gồm: boot; Three r180; module không dùng fallback; trạng thái ban đầu; di chuyển; bắn; nạp đạn; pause đóng băng thời gian nhiệm vụ; resume; từ chối tương tác khi nhìn sai hướng; giữ E một phần; thả E làm giảm tiến độ; cắt A, B, C; mở điểm thoát; hoàn tất nhiệm vụ; reset lượt; sát thương gây chết; có nút Retry; retry phục hồi lượt; không có lỗi game.

Fixture dùng phím giả lập, đặt vị trí nhân vật và bật bất tử ở bước relay. Nhánh thắng được kiểm chứng bằng trạng thái runtime, không phải một lượt chơi tự nhiên. Hai lượt thử đầu không đạt do thời gian chờ và hướng nhìn của fixture; đã sửa fixture, giữ nguyên bundle, rồi lượt thứ ba đạt. Bằng chứng các lượt đều được giữ lại.

- [Kết quả 22 kiểm tra](/Users/meow/rea/saltline-reverse/evidence/verification-report.json:1).
- [Mã kiểm tra](/Users/meow/rea/saltline-reverse/tests/verify.js:1).
- [Capture đạt đầy đủ](/Users/meow/rea/saltline-reverse/evidence/verification-third.json:1), evidence ID `ev_3854589c34d214bec8f6de004e381579c8e0cac558896d6e4eed17f10e1c64ed`.
- [Gói REA](/Users/meow/rea/saltline-reverse/evidence/rea-evidence-bundle.json:1) gồm capture kiểm tra và screenshot.

Ảnh gameplay local 1280 × 720, chất lượng high, tắt audio để chụp; ảnh chỉ chứng minh hình ảnh ở thời điểm này:

![Saltline chạy local](/Users/meow/rea/saltline-reverse/evidence/gameplay-1280.png)
