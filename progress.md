# Saltline reverse — 2026-11-10

## Mục tiêu và phạm vi
- Reverse game công khai https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp.
- Thu hồi bundle được phát cho browser, giải thích cấu trúc/gameplay và tạo bản chạy local có kiểm chứng.
- Chỉ sửa trong `/Users/meow/rea/saltline-reverse`; không đổi gameplay, đồ họa hoặc dependency của game.
- Thành công: mã và nguồn bằng chứng được lưu; local mở đúng title/gameplay; điều khiển, pause/retry và relay được kiểm tra trong phạm vi khả thi.

## Đã xác minh
- Workspace mẹ không phải Git repo; thư mục task là mới, không có baseline test sẵn.
- IAB mở được Saltline; mục tiêu trên UI là cắt ba relay và đến thuyền.
- Frame công khai: https://5326a6ff-d95f-4e59-9b2e-b3f3bcb780e3.frame.claudeusercontent.com/_f/1794242702-61c7/?__frame_v=manifest.50700ebc68dce463.json
- Đã lưu HTML raw `evidence/game-page.html`, SHA-256 `effa3c3eb59d89313adaa9f11ff332b24acc09bb080ccfbbcd454daba3ede631`.
- Bundle có Three.js r180 / WebGLRenderer; không thấy WebGPURenderer. Tên biến đã minify, chưa có source map.
- REA headless ở trang shell gặp Cloudflare. Các capture đó chỉ chứng minh giới hạn truy cập, không chứng minh gameplay.

## Quyết định
- Giữ nguyên bundle và CSS game. Chỉ bỏ wrapper runtime của Claude trong bản local.
- Đọc và áp dụng reverse-engineer-anything, threejs-game-director, threejs-fundamentals, threejs-qa-release (narrow recovery/verification scope).
- Không chuyển WebGPU, nâng Three.js hay dựng lại cảnh từ suy đoán.

## Trạng thái bàn giao: hoàn tất
- Đã tạo `index.html`, `styles.css`, `game.js`; bundle và CSS giữ nguyên. Bundle SHA-256 `8d0057dc4d6dac77e20be2ef1f2b623e19346b5803fde1b3dbabbab508d75d9d`.
- Đã lưu `recover.py`, bản mã định dạng `evidence/game.pretty.js` và manifest nguồn/hash.
- Đã viết `README.md` hướng dẫn chạy, `REVERSE.md` phân tích kiến trúc, luật chơi, AI, renderer, âm thanh và giới hạn.
- Bằng chứng runtime nằm trong `evidence/verification-report.json`, `evidence/verification-third.json` và `evidence/rea-evidence-bundle.json`.
- Ảnh gameplay đã xem: `evidence/gameplay-1280.png`, 1280 × 720. Ảnh từ IAB `gameplay-desktop.jpg` có padding do capture, không dùng làm ảnh bàn giao chính.

## Kiểm chứng đã chạy
- `python3 recover.py`: đạt; `game.js` khớp từng byte với bundle thu hồi.
- `node --check game.js`, `node --check tests/verify.js`: đạt.
- Đối chiếu 5/5 file với kích thước và SHA-256 trong manifest: đạt.
- Kiểm tra bàn giao cuối: trang local trả HTTP 200; mọi đường dẫn file/số dòng trong README và báo cáo tồn tại; hash ảnh gameplay khớp capture đã lưu.
- Runtime Chromium 157.0.8103.50 / WebGL2: 22/22 đạt, gồm relay/facing/hold/decay, cắt đủ ba, extraction → complete, chết và retry.
- Hai capture đầu thất bại do fixture (chờ chuyển động quá ngắn và hướng nhìn bị player update ghi lại); đã sửa fixture, không sửa bundle. Capture thứ ba đạt; giữ lại cả ba.
- Chơi trực tiếp qua IAB: deploy, WASD, Enter bắn, R nạp đạn, P pause/resume, chết và retry, Settings, viewport 390 × 844.
- Capture đạt không có page error hoặc `__errors`; có HTTP 404 favicon.ico. Không sửa game chỉ để xử lý biểu tượng tab.
- Server phục vụ thư mục này tại `http://127.0.0.1:5189/`; tiến trình có thể kết thúc cùng phiên. Nếu cần chạy lại: `python3 -m http.server 5189 --bind 127.0.0.1` trong thư mục task.

## Giới hạn đã ghi trong bàn giao
- Mã phục hồi là shipped bundle; chưa khôi phục source tree hoặc tên biến nguyên gốc, không có source map tìm thấy.
- Test thắng dùng đặt vị trí, phím giả lập và bất tử ở bước relay; chưa chơi thắng tự nhiên toàn màn.
- Chưa kiểm chứng gamepad, cảm ứng trên điện thoại thật, chất lượng âm thanh, mọi nhánh AI hoặc benchmark dài hạn.
- UI/input có F/V melee nhưng chưa thấy đường thực thi đòn đánh người chơi trong bundle; ghi nhận khả năng tính năng gốc chưa nối đủ, chưa kết luận lỗi runtime.
- Google Fonts vẫn là tài nguyên mạng theo HTML gốc; không gọi đây là bản offline hoàn toàn.
- Browser nhúng không cấp pointer lock; phương án điều khiển dự phòng có sẵn của game đã chạy được.

## Tiếp nối nếu có yêu cầu mới
- Không còn phần việc bắt buộc đang bị chặn trong phạm vi phục hồi và phân tích.
- Đọc `REVERSE.md` trước khi sửa logic; `game.pretty.js` là bản đọc, file chạy là `game.js`.
- Không chạy `recover.py` sau khi chỉnh game mà chưa lưu thay đổi: script chủ ý tái tạo bản gốc và ghi đè ba file chạy cùng manifest.
- Không nâng Three.js/đổi renderer hoặc thay gameplay nếu chưa có yêu cầu mới.

## Bổ sung phân tích tài nguyên — 10/11/2026
- Theo yêu cầu tiếp theo của người dùng, đã kiểm kê file và phân tích chức năng tài nguyên trong `ASSETS.md`; thêm đường dẫn trong README.
- Ba file chạy có tổng 1.423.640 byte. Tài nguyên chính được tạo bằng mã: registry gồm 36 loại props, 29 texture sets, 48 material presets, 22 decal factories và 57 định nghĩa audio (93 biến thể, gồm 2 impulse response).
- Các số trên là số định nghĩa tĩnh, không phải file rời hay số tài nguyên runtime đang cấp phát.
- Radio được xác minh là hàng đợi text/phụ đề; chưa thấy xử lý voice-over/TTS trong bundle. Ảnh trong evidence là ảnh kiểm chứng, không phải texture game.
- Chỉ bổ sung tài liệu; không thay core game, không chạy lại kiểm tra gameplay hoặc nghe audio trong lượt này.
- Kiểm chứng bổ sung: 5/5 file trong recovery manifest giữ nguyên hash/kích thước; 57 đường dẫn file/số dòng trong ASSETS và README hợp lệ; đếm lại registry xác nhận 36 props, 29 texture sets và 48 material presets.

## Demo chiến thuật theo yêu cầu tiếp theo — 11/11/2026
- Đã viết ORIGINAL-WORKFLOW.md, phân biệt bằng chứng/suy luận và prompt tái dựng đề xuất.
- User chọn đặt/gỡ bom đấu bot, map kiểu Dust II; triển khai riêng trong demo/, giữ bản Saltline gốc.
- Kiểm chứng cuối 43/43 PASS; xem demo/artifacts/final-evidence.md và demo/artifacts/game-progress.md.
- URL demo http://127.0.0.1:5189/demo/ ; chạy server ở root task nếu phiên trước đã dừng.

## Bài phân tích asset dạng Markdown — 11/11/2026
- Yêu cầu mới: chuyển phân tích cách code cũ tạo asset, vật liệu và hình khối thành bài kỹ thuật hoàn chỉnh `.md`.
- Đã tạo `PROCEDURAL-ASSETS-ANALYSIS.md`: 12 mục, sơ đồ Mermaid, ví dụ có phân biệt code gốc/code minh họa, trường hợp container, texture GPU, vật liệu PBR, decal, rig, tối ưu và giới hạn kết luận; bổ sung liên kết trong README.
- Đã đọc thêm builder để xác nhận cache container giới hạn 6 seed hình học, lượng tử hóa độ mở cửa/hao mòn và tách màu khỏi khóa hình học; kiểm tra skinning bộ phận dùng một bone trọng số 1.
- Kiểm chứng tài liệu: 35 đích tham chiếu local và số dòng hợp lệ, 63 lượt tham chiếu có định nghĩa, các khối code cân bằng. Hash `game.js`, `evidence/game.bundle.js`, `styles.css` khớp manifest (3/3).
- Không sửa code game; không chạy lại runtime hoặc benchmark trong lượt viết tài liệu. Không khẳng định prompt gốc hay quy trình sáng tác chưa có bằng chứng.
- Hoàn tất yêu cầu hiện tại; tài liệu sẵn sàng đọc và bàn giao.

## Phát hành Saltline tại /gameaaa — 11/11/2026
- Người dùng yêu cầu bản Saltline gốc tại `https://meowsolo.com/gameaaa`. Đã đóng gói ba file gốc vào `deploy/saltline-gameaaa/gameaaa/` và xác minh hash theo manifest.
- Vercel CLI xác nhận domain thuộc `ai-builder-landing`. Cả apex, www và `/cafe/` trả HTTP 402. Deploy project riêng bị Vercel từ chối vì team vượt fair use limits. Chưa có URL production hoặc route mới.
- Gói local dưới `/gameaaa/` tải đủ ba file HTTP 200. Chrome headless khởi động, bấm Deploy vào intro, sau khi bỏ intro trong fixture thì bắn được. Lượt chờ intro tự chạy hết thời gian chờ. Chi tiết và bước tiếp tục ở `deploy/README.md`.

### Lần thử lại
- Vercel hoạt động trở lại. Project riêng `saltline-gameaaa` lên production `dpl_FuEKgoXFNX99Jq3mvh1avreswSQK`.
- Đã publish route `914ecdf6-f278-4859-a604-89aa03dae1ed`. Diff xác nhận chỉ thêm `/gameaaa`, 12 route cũ giữ nguyên.
- `https://meowsolo.com/gameaaa` chuyển tới `https://www.meowsolo.com/gameaaa/`. Ba file tải HTTP 200 và khớp SHA-256 với manifest. Trang chủ và `/cafe/` khớp hash trước/sau, xem `deploy/live-verification.json`.
- Chrome headless trên tên miền công khai đạt kiểm tra khởi động, bấm Deploy và bắn sau khi bỏ intro. Bài thử tắt âm thanh. Bằng chứng `deploy/live-browser.json`. Hoàn tất phát hành.

## Bổ sung phân tích kỹ thuật — 11/11/2026
- Theo yêu cầu của người dùng, đã viết `TECHNIQUES.md`: kỹ thuật sinh hình học, vật liệu, ánh sáng/hậu kỳ, mặt đất/nước/mưa, VFX, súng/kẻ địch và âm thanh bằng code; thêm dòng trong bảng file của README.
- Chỉ đọc tĩnh `evidence/game.pretty.js`; không chạy game, showcase hay sửa bundle.
- Phần vật liệu, decal, bầu trời, bóng, hậu kỳ, renderer đọc trực tiếp; props, level, mặt đất + FX, súng + kẻ địch, audio do 6 agent đọc song song, có đối chiếu lại một số điểm mỗi phần.
- Phụ lục của file có bảng alias class Three.js đã minify (ví dụ `Qe` = Mesh, `zn` = ShaderMaterial), dùng lại khi đọc bundle.
- Kiểm tra: 105 link số dòng trong `TECHNIQUES.md` đều nằm trong phạm vi 72.969 dòng của bundle đã định dạng.


## Triển khai Sirocco theo nghiên cứu procedural — 11/11/2026
- Hoàn tất nâng cấp trong demo/: kế hoạch dựng map, cạnh vát, PBR GPU/triplanar/vertex color, atlas, batching giữ khớp bot/magazine, tracer pool và debug surface.
- Bản cuối đạt 43/43 gameplay và 11/11 procedural; calls409→233, triangles64156→190396, texture14→41 trong cảnh so sánh. Không có tam giác suy biến/console error, hash ba file Saltline gốc giữ nguyên.
- Bàn giao: demo/README.md, demo/artifacts/final-evidence.md; tiến độ chi tiết demo/artifacts/game-progress.md. URL local http://127.0.0.1:5189/demo/.
- Chưa phát hành Sirocco online trong lượt này; bản Saltline đã phát hành /gameaaa giữ nguyên. Không còn việc bắt buộc đang chặn trong phạm vi triển khai này.


## Hoàn tất sửa Sirocco theo TECHNIQUES.md — 11/11/2026
- User bác bản procedural trước, yêu cầu dùng TECHNIQUES.md. Đã chuyển demo sang renderer HDR/PCSS/PMREM/post gốc, geometry/rig/tay/FX gốc qua adapter, ground CPU mask khô và adapter audio theo DSP/voice/reverb/stem.
- Bản cuối:43/43gameplay +23/23TECHNIQUES +motion bằng vòng game thật đạt, không runtime error. Kiểm cú pháp14file, engine tái lập cùng hash, ba file Saltline gốc giữ nguyên.
- Sáu frame high1280x720:84–131calls,160564–297644triangles,83texture; không dùng số233calls/11ca của bản trước để mô tả bản mới. Chưa có benchmarkFPS/VRAM dài hạn.
- Bàn giao hiện tại: demo/README.md, demo/artifacts/final-evidence.md và các report verification/techniques/techniques/motion. Tiến độ chi tiết trong demo/artifacts/game-progress.md.
- Local http://127.0.0.1:5189/demo/ trảHTTP200. Chưa deploy Sirocco trong lượt này; không thay route Saltline/gameaaa. Không còn việc bắt buộc đang bị chặn trong phạm vi sửa local.


## Git checkpoint hai bản — 11/11/2026
- Theo yêu cầu user, chuẩn bị repo riêng tư saltline-sirocco trên tài khoản GitHub đang active danielnguyen0428. Saltline ởroot, Sirocco ởdemo/, kèm tài liệu và bằng chứng.
- Sirocco đang sửa tay/vũ khí, chưa hoàn tất QA. README ghi rõ test mới fail8/7bucket và các báo cáo43/23ca là mốc trước sửa. Không rollback hoặc xóa thay đổi đang có.
- Kiểm trước commit:17fileJS syntaxPASS,3hashSaltline gốcPASS, credential-pattern scan không phát hiện; không lưu .vercel hoặc .env.
