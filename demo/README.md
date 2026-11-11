# [MEOW] Sirocco — demo đặt/gỡ bom đấu bot

> **Snapshot Git hiện tại:** phần sửa tay/vũ khí đang thực hiện. [Bài kiểm mới](artifacts/hands-weapons/report.json) chưa đạt vì AK còn 8 mesh thay vì 7 bucket; chưa hoàn tất kiểm lại toàn bộ runtime. Kết quả 43/23 ca bên dưới là mốc kiểm chứng trước lượt sửa này. Xem [tiến độ](artifacts/game-progress.md).

Demo chơi đơn lấy cảm hứng CS:GO/Dust II: map sa mạc tự dựng, hai khu A/B, bốn bot người, AK-47/M4A1 và luật round. Bản hiện tại triển khai theo [TECHNIQUES.md](/Users/meow/rea/saltline-reverse/TECHNIQUES.md). Đây không phải bản sao chính xác Dust II hoặc toàn bộ luật thi đấu CS:GO.

## Chạy

```sh
cd /Users/meow/rea/saltline-reverse
python3 -m http.server 5189 --bind 127.0.0.1
```

Mở [Sirocco](http://127.0.0.1:5189/demo/), chọn nhiệm vụ và súng, bấm Bắt đầu. [Saltline gốc](http://127.0.0.1:5189/) chạy riêng.

- WASD di chuyển; chuột hoặc IJKL/mũi tên nhìn; click hoặc Enter bắn.
- Shift đi chậm; C/Ctrl ngồi; Space nhảy; R nạp đạn.
- Giữ E đặt bom 3,2 giây hoặc gỡ bom 5 giây; thả để hủy tiến độ.
- P/Esc tạm dừng; F toàn màn hình; nút Âm bật/tắt tiếng.

Tấn công: trong 105 giây tới A/B đặt bom, bảo vệ trong 40 giây hoặc loại toàn bộ bot. Bot còn sống có thể tới gỡ bom trong 10 giây. Phòng thủ là bài tập retake: bom đã đặt, có 55 giây tiếp cận/gỡ; hạ hết bot vẫn cần gỡ bom. Người chơi chết kết thúc round ngay, kể cả khi đã đặt bom. Không hồi máu tự động hoặc hồi sinh giữa round.

## Tổ chức source

| File | Trách nhiệm |
| --- | --- |
| `src/main.js` | Tích hợp renderer/FX gốc, fixed-step 60 Hz, nhiệm vụ, input, HUD, sát thương, thắng/thua và reset |
| `src/render-diagnostics.js` | Ghi nhận các pass thực tế, liên kết thông số hậu kỳ với shader, chế độ xem từng pass |
| `src/map.js` | Bố trí nhà/cổng/cover, geometry cạnh vát, vertex AO, PBR, bạt/bao cát, atlas, static batches và collider |
| `src/ground.js` | Mask CPU dùng chung cho shader mặt đất khô và truy vấn loại bề mặt |
| `src/weapons.js` | AK/M4, tay loft gốc, 9 spring, reload keyframe, magazine/bolt riêng và flash 8 quad |
| `src/bots.js` | Rig 16 bone, geometry dùng chung, SkinnedMesh/Skeleton riêng từng bot, controller chuyển động và AI |
| `src/audio.js` | Công thức DSP gốc, cache buffer, lịch sinh chia lát, 45 voice, reverb, 5 stem và master compressor/soft clip |
| `build-engine.py` | Kiểm hash bundle Saltline, chỉ thay lời gọi bootstrap bằng export API |
| `saltline-engine.js` | Engine adapter sinh từ script trên; không sửa trực tiếp |
| `tests/verify.mjs` | 43 kiểm tra gameplay bằng input và fixture có kiểm soát |
| `tests/techniques.mjs` | 23 kiểm tra cơ chế theo TECHNIQUES, tài nguyên và ảnh debug |
| `tests/motion.mjs` | Chạy vòng game thật, chụp bot đi bộ/reload và mã hóa chuỗi ảnh theo thời gian |
| `tests/procedural.mjs` | Entrypoint tương thích, gọi bộ `techniques.mjs` mới |

Trang chạy trực tiếp bằng HTML/ES module, không cần npm hoặc bundler. Engine giữ Three.js r180/WebGL2, không dùng React Three Fiber. QA đọc Playwright có sẵn tại `/Users/meow/rea/trumviahe/node_modules/playwright/index.mjs`, dùng Chrome của máy; script motion còn cần `/opt/homebrew/bin/ffmpeg`. Chuyển QA sang máy khác cần chỉnh các đường dẫn này. Bản game không phụ thuộc thư mục chứa Playwright. Giao diện demo dùng font hệ thống Arial/Helvetica.

## Kỹ thuật đã áp dụng

Renderer dùng trực tiếp factory Saltline: bầu trời shader, môi trường PMREM, bóng PCSS, HDR/depth, pass riêng cho súng và chuỗi AO → volumetric → composite → motion blur → bloom → exposure → color grade → final. Màu nắng, sương và cường độ hậu kỳ được chỉnh cho map sa mạc. Cơ chế gốc được giữ trong adapter; không viết một renderer khác để mô phỏng lại.

Asset dựng bằng code theo mét. Factory GPU gốc sinh texture PBR; map dùng vertex color/AO, cạnh vát và merge theo material. Map có 22 mesh tĩnh kể cả mặt đất, một atlas biển và bảy cụm bạt/bao cát từ factory gốc. Mặt đất dùng mask CPU bốn kênh và chi tiết tuần hoàn; shader mô phỏng độ sần, không làm biến dạng mặt va chạm.

Tay dùng helper loft gốc, recoil dùng 9 lò xo giảm chấn, reload có keyframe vị trí/quaternion và băng đạn rời súng. Bot dùng một geometry chung, mỗi con có Skeleton 16 bone và SkinnedMesh riêng; mỗi vertex gắn cứng với một bone như kỹ thuật gốc. Controller điều khiển bone trực tiếp, không có animation clip nhập từ ngoài.

VFX dùng nguyên factory gốc với năm batch, tracer 48 slot, khói, decal, vỏ đạn và debris có pool giới hạn. Audio dùng lại công thức tổng hợp; adapter đổi cách kích hoạt và phối âm cho nhiệm vụ Sirocco. Bảng đối chiếu, bằng chứng và phần không áp dụng nằm trong [final-evidence.md](/Users/meow/rea/saltline-reverse/demo/artifacts/final-evidence.md).

## Quality và chế độ kiểm tra

| URL | Tác dụng |
| --- | --- |
| [Mặc định](http://127.0.0.1:5189/demo/) | Khởi động preset high, texture 1024, HDR/MSAA 4; giữ cơ chế giảm chất lượng động của engine |
| [Low](http://127.0.0.1:5189/demo/?quality=low) | Texture 512, render scale 0,7, MSAA 0, shadow 2048, tắt AO và motion blur |
| [Không hậu kỳ](http://127.0.0.1:5189/demo/?post=0) | Đối chiếu ảnh khi tắt pipeline hậu kỳ |
| [Clay](http://127.0.0.1:5189/demo/?debug=clay) / [normals](http://127.0.0.1:5189/demo/?debug=normals) | Kiểm hình khối và hướng bề mặt bằng đường render debug |
| [AO](http://127.0.0.1:5189/demo/?pass=post-ao) / [volumetric](http://127.0.0.1:5189/demo/?pass=post-vol) | Hiện output pass thật của pipeline |
| [Mask mặt đất](http://127.0.0.1:5189/demo/?grounddebug=mask) | Hiện dữ liệu mask trên mặt đất |

`?quality=medium` và `?quality=ultra` cũng được hỗ trợ. `?seed=993` đổi biến thiên bề mặt/chi tiết, không sinh layout mới. `?dynres=0` cố định độ phân giải cho QA; `?mb=0` tắt motion blur. Không đưa `?test=1` vào link chơi thông thường vì nó mở các hook fixture.

## Kiểm chứng

Sau khi bật server, chạy từ thư mục `demo`:

```sh
python3 build-engine.py
node tests/verify.mjs
node tests/techniques.mjs
node tests/motion.mjs
```

Bản kiểm chứng hiện tại: **43/43 gameplay, 23/23 TECHNIQUES và lượt motion đều đạt**, không ghi nhận lỗi runtime. Đã kiểm cú pháp 14 file JavaScript, tái tạo adapter cho cùng hash, và xác nhận ba file Saltline gốc giữ nguyên hash. Báo cáo và ảnh nằm trong [bằng chứng hiện tại](/Users/meow/rea/saltline-reverse/demo/artifacts/final-evidence.md). Thư mục `artifacts/procedural` là kết quả lịch sử của bản trước; không dùng số 11 ca/233 draw calls của bản đó để mô tả bản này.

Sáu frame tại 1280 × 720, high, seed 71, khóa độ phân giải: 84–131 draw calls và 160.564–297.644 tam giác, gồm pass bóng/hậu kỳ. Đây chưa phải benchmark FPS hoặc tổng VRAM. Lượt motion thu ảnh theo khoảng thời gian rồi ghép video; không phải quay liên tục mọi frame.

## Giới hạn

Hình ảnh ở mức procedural demo; tạo hình bot, AK/M4 và thông số gameplay không khớp đầy đủ CS:GO. Chưa có multiplayer, economy/mua súng, lựu đạn smoke/flash hoặc đồng đội. Test có fixture cô lập nhiệm vụ và AI; chưa xác nhận một trận thắng tự nhiên hoàn chỉnh bằng tay. Đã kiểm audio bằng trạng thái phát/pause/mute, chưa đánh giá chất lượng nghe. Viewport hẹp đã kiểm bố cục, chưa có điều khiển cảm ứng đầy đủ hoặc benchmark thiết bị dài hạn.

Sirocco được cập nhật local trong đợt này. Route online `/gameaaa` là đợt phát hành Saltline gốc trước đó; chưa phát hành Sirocco lên route đó.

Phân tích workflow và prompt đề xuất: [ORIGINAL-WORKFLOW.md](/Users/meow/rea/saltline-reverse/ORIGINAL-WORKFLOW.md). Không có prompt nguyên văn của tác giả trong dữ liệu thu hồi.
