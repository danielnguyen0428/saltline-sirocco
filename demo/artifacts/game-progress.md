# Sirocco — demo FPS đặt/gỡ bom

[MEOW] Original prompt: Phân tích lại kỹ thuật tạo game gốc, prompt, quy trình; sau đó đổi gameplay/map/weapon giống demo CS:GO. Người dùng chốt: đặt/gỡ bom đấu bot, map kiểu Dust II.

## Thiết kế đã chốt
- Demo desktop chơi một người, map mới `Sirocco` lấy cảm hứng Dust II: tường sa thạch, cổng vòm, cửa gỗ, hai khu A/B, đường giữa và lối vòng.
- Hai bài tập: tấn công mang bom tới A/B; phòng thủ xử lý bom đã đặt. Có đối thủ bot người, hỏa lực nhìn thấy mục tiêu, vật chắn, thời gian round, kết quả và retry.
- AK-47/M4A1 procedural, đạn hữu hạn, nạp đạn, giật và độ tản đạn tăng khi chạy/bắn dài. Chọn súng trước lượt. Không hồi máu tự động.
- Vòng lặp: chọn vai/súng → bắt đầu → tìm đường và đấu súng → giữ E đặt/gỡ bom → thắng/thua → lượt mới. Tình huống có nguy cơ mất máu và thua thật.
- Không yêu cầu multiplayer, economy đầy đủ, sao chép tọa độ DustII, asset Valve hoặc độ khớp cơ chế thi đấu từng thông số.

## Kiến trúc
- Bản Saltline gốc và evidence giữ nguyên.
- `build-engine.py` lấy bundle đã kiểm hash, thay đúng lời gọi bootstrap bằng export API; engine r180/WebGL giữ nguyên.
- Tái dùng material/prop factories, custom capsule/AABB physics, input/player và các generator âm thanh phù hợp. Map, vũ khí, bot, nhiệm vụ, HUD mới ở `src`.
- Physics fixed step 1/60, nav nằm trong giới hạn gốc; map dự kiến x/z trong ±28. Không cài engine mới hoặc sửa project khác.

## Kế hoạch và kiểm chứng
1. Phân tích nguồn/quy trình/prompt: ghi dữ kiện và suy luận riêng trong ORIGINAL-WORKFLOW.md.
2. Dựng map/súng/vòng round: kiểm cú pháp và mở bản chơi trong browser.
3. Kiểm di chuyển/va chạm/bắn/nạp/AI/đặt/gỡ/bom nổ/thắng/thua/pause/retry; chụp gameplay và kiểm console.
4. Kiểm viewport, số draw calls/triangles, nguyên vẹn bản gốc; cập nhật bằng chứng và hướng dẫn.

## Hiện tại
- Baseline: cú pháp bundle và hash các file thu hồi đạt.
- Đã tạo engine export tái lập được từ bundle gốc.
- Đang triển khai demo và báo cáo kỹ thuật.

## Hoàn tất — 11/11/2026
- Đã có ORIGINAL-WORKFLOW.md: kỹ thuật, dấu vết workflow, prompt đề xuất; không có prompt gốc để xác nhận.
- Demo chạy tại /demo/: map Sirocco A/B, AK/M4, bốn bot humanoid, attack/retake, plant/defuse/explosion/timeout/death/reset, radar/HUD/menu/audio.
- Browser test cuối 43/43 PASS, report ở artifacts/verification/report.json; ảnh gameplay A/B, M4, defuse, win và viewport hẹp đã lưu/đã xem.
- Review độc lập đã sửa: defuser handoff, patrol unreachable/stuck, direct player death event, timer 0:60. Có kiểm hồi quy tương ứng.
- Client develop-web-game đã chạy với điều chỉnh local dependency/Chrome; đã phát hiện và sửa viewmodel quá lớn qua screenshot.
- Toàn bộ hash bản gốc giữ nguyên; cú pháp các module và links docs đã kiểm.
- Không có npm build: HTML/ES module chạy trực tiếp bằng static server.
- Giới hạn: procedural demo, không multiplayer/economy; chết kết thúc round ngay dù bom đã đặt; chưa chơi thắng tự nhiên toàn trận, chưa nghe đánh giá audio/cảm ứng thật/benchmark dài hạn. Khoảng409 drawcalls vượt mục tiêu300; 64k triangles ở snapshot, không cam kết FPS.
- Bàn giao: demo/README.md và artifacts/final-evidence.md. Không còn việc bắt buộc đang bị chặn.

## Áp dụng nghiên cứu procedural asset — 11/11/2026
- Yêu cầu đang làm: triển khai lại Sirocco theo kỹ thuật hình học/vật liệu/asset của Saltline. Giữ bài tập đặt/gỡ bom với map sa mạc A/B và bot.
- Baseline chạy lại đạt 43/43. Bản trước lưu trong artifacts/procedural-baseline. Workspace không có Git.
- Engine đã xác định Three.js r180, WebGL2, JavaScript thuần. Bổ sung export các helper beveledBox/mergeGeometries/mergeStatic từ bundle đã kiểm hash.
- Phân công theo skill threejs-game-director: worker map sở hữu map.js, worker weapon sở hữu weapons.js, lead xử lý bot/main và tích hợp/QA.
- Mục tiêu quan sát: tường có độ sần và hao mòn theo vị trí, gỗ/kim loại/vải phân biệt bằng PBR; cạnh vát và khe lắp ráp thấy được; magazine và khớp bot hoạt động sau batching; vẫn đi được tới A/B.
- Mục tiêu đo: dưới 300 draw calls ở cảnh gameplay chuẩn (gồm shadow/viewmodel), texture dưới 60, tài nguyên tracer không tăng theo phát bắn. Chất lượng low512/high1024 và debug clay/normals phục vụ kiểm chứng.
- Kiểm chứng dự kiến: 43 ca gameplay, kiểm buffer/normal và material maps, ảnh final/clay/normals, nhiều seed, reload/đi bộ theo mốc thời gian, resize và lỗi console. Bản kiểm chứng chưa hoàn tất ở thời điểm ghi mục này.


### Hoàn tất áp dụng nghiên cứu — 11/11/2026
- Map dùng kế hoạch facade/portal/crate, cạnh vát, vertex color hao mòn, texture PBR GPU và atlas biển hiệu; 1.906 phần gom thành 15 batch tĩnh, giữ 79 collider và đường A/B.
- AK/M4 dùng vật liệu kim loại/gỗ/polymer/vải và batching theo nhóm cứng, giữ magazine/tay hoạt ảnh. Bot dùng tiết diện áo/quần thuôn và batching theo 12 nhóm khớp.
- Main dùng pool 32 tracer, chất lượng texture 512/1024, debug clay/normals và snapshot gọn; engine export thêm helper gốc, vẫn r180/WebGL2.
- Qua ảnh: thay concrete_painted bằng concrete để bỏ vết bong quá dày; sửa tay bot hướng về súng. Kiểm geometry loại mặt suy biến trong ngón tay.
- Review độc lập phát hiện flash quay lệch trục nòng; test mới đã FAIL trước sửa, PASS sau bake trục X vào geometry.
- Kiểm chứng bản cuối: 43/43 gameplay + 11/11 procedural PASS, không lỗi console/JavaScript. Cú pháp 5 module đạt, hash ba file gốc giữ nguyên. 0 tam giác suy biến; tracer GPU geometry giữ 166 sau thêm 300 hiệu ứng; seed 71/993 texture512 đạt.
- So sánh cùng bộ gameplay: calls409→233 (−43,0%), triangles64156→190396, GPU textures14→41. PBR factory ước tính54,3 MiB(1024)/13,6 MiB(512); không phải tổngVRAM hay cam kết FPS.
- Bằng chứng mới trong artifacts/procedural, artifacts/verification và final-evidence.md; baseline giữ trong artifacts/procedural-baseline. README đã ghi pipeline và lệnh kiểm lại.
- Phạm vi hoàn tất local; chưa deploy Sirocco, không thay /gameaaa của Saltline. Còn giới hạn demo: bot khớp cứng, chưa benchmark dài hạn hoặc chơi thắng tự nhiên toàn trận. Không còn phần việc bắt buộc bị chặn cho lượt triển khai này.

## Sửa theo TECHNIQUES.md — khởi đầu lượt sửa 11/11/2026
- User bác bỏ bản nâng cấp trước; chuẩn đối chiếu là TECHNIQUES.md, không chỉ bài PROCEDURAL-ASSETS-ANALYSIS.md. Bản trước không đủ: thiếu original HDR/PCSS/post/PMREM sky, bot chưa SkinnedMesh, tay chưa loft, recoil chưa spring, VFX chỉ Line/cone, ground chưa CPU mask.
- Chốt phạm vi: gameplay attack/retake A/B và map sa mạc giữ; cơ chế phù hợp được dùng trực tiếp từ source hoặc port có dẫn dòng. Biển/mưa/cẩu/tàu không phải nội dung Sirocco.
- Routing skills: director, visual router, AAA graphics, geometry, animation, image pipeline, VFX, QA/visual validation; source Three r180 ưu tiên so với ví dụ skill.
- Worker techniques_weapons sở hữu weapons.js; techniques_bots sở hữu bots.js; techniques_world sở hữu map.js/ground.js; lead owns main/audio/adapter/QA/integration. Theo phân công được skill director chỉ dẫn; không sửa project khác.
- Baseline bằng chứng bản trước lưu artifacts/techniques-before. Không Git trong task root.
- Tiêu chí mới: cơ chế kiểm tra trực tiếp (skin weights/shared geo, spring/loft/8quad, advanced renderer/PCSS/HDR depth,5batch FX, mask ground), hình ảnh final/no-post/clay/near + movement/reload sequence, gameplay43 giữ đạt và runtime không error.


### Hoàn tất sửa theo TECHNIQUES.md — 11/11/2026
- Đây là trạng thái hiện tại, thay thế các kết luận 11 ca procedural/233 calls của lượt trước. Chuẩn đối chiếu đầy đủ trong artifacts/final-evidence.md.
- Renderer dùng trực tiếp factory gốc: shader sky/PMREM, PCSS, HDR/depth/MSAA, viewmodel layer riêng và hậu kỳ đầy đủ. Thêm render-diagnostics.js để ghi pass thật và bind các tune startup-only tới shader; sửa tone/AO/sương cho cảnh sa mạc.
- Map: 1.900 phần, 22 mesh tĩnh kể cả ground, 109.478 tam giác, 79 collider; bảy cụm bạt/bao cát gốc, atlas stencil có padding. Ground mới dùng CPU mask bốn kênh cho shader/truy vấn gameplay; khô, không physical displacement.
- Súng/tay: AK/M4 có extrude lỗ/lathe, chi tiết material object space; tay loft gốc, 9 spring, flash 8 quad, reload quaternion/smootherstep và magazine tách/lắp. Bot dùng helper rig gốc: geometry chung, 4 skeleton riêng, 16 bone/7 material group mỗi bot; controller cập nhật bone.
- FX gốc 5 batch/48 tracer; audio DSP gốc, cache/queue chia lát, 45 voice, hai convolver, 5 stem, compressor/soft clip. Map không có vùng nội thất nên chưa kiểm chuyển reverb trong/ngoài nhà.
- Review sửa hai lỗi vòng đời: flash bị đứng khi phát đạn cuối kết thúc round; âm/đuôi reverb round cũ còn phát sau reset. Đã có regression đạt.
- Kiểm chứng cuối: gameplay43/43, TECHNIQUES23/23, motion chạy requestAnimationFrame đạt; không runtime error. Motion là chuỗi ảnh lấy mẫu/ghép theo thời gian, không quay mọi frame. Đã xem final, AO, bot-front, site-A, magazine-out và các mốc motion.
- Sáu frame high1280x720/seed71/dynres0 ghi84–131calls,160564–297644triangles,41GPUgeometries,83GPUtextures. Không kết luận FPS tăng hoặc tổng VRAM. Ngưỡng texture60 của bản forward cũ không áp dụng cho HDR/post mới; kiểm poolFX giữ tài nguyên54geometry/77texture sau stress.
- Kiểm geometry asset: buffer hữu hạn,0degenerate/0normalErrors; loại trừ ba templateFX dự phòng/lathe gốc khỏi kiểm topology, vẫn kiểm số hữu hạn và vòng đời runtime. Không tuyên bố toàn scene0degenerate.
- node --check14file đạt; build-engine.py tái lập cùng hash; hash game.js/styles.css/index.html gốc nguyên vẹn. README và final-evidence đã cập nhật; server5189 trảHTTP200.
- Không còn phần việc bắt buộc bị chặn trong lượt sửa local. Giới hạn: hình ảnh procedural, không khớp100%CS:GO; chưa nghe đánh giá audio/chơi thắng toàn trận/benchmarkGPU dài hạn. Không deploy Sirocco hoặc thay/gameaaa trong lượt này.
- Nếu tiếp tục: đọc README + artifacts/final-evidence.md trước, ưu tiên report techniques/verification/motion hiện tại; artifacts/procedural và techniques-before là lịch sử. Giữ nguyên bản gốc và engine r180.


## Sửa riêng tay và vũ khí theo phản hồi — đang thực hiện
- User bác phần tay/vũ khí dù helpers gốc đã được gọi. Chỉ sửa weapons và QA liên quan, giữ map/renderer/gameplay.
- Cần kiểm contact datums, scale tay/súng, đầy đủ subassembly và reload/bolt theo TECHNIQUES §6; không chấp nhận metadata tên helper làm bằng chứng duy nhất.
- Baseline source/ảnh/report giữ artifacts/hands-weapons-before. Cú pháp weapons đạt, server5189 HTTP200.
- Skills: director, procedural geometry/animation, visual validation; reviewer read-only kiểm helper hand gốc và contract hiện tại.

### Checkpoint theo yêu cầu đưa cả hai bản lên Git
- User yêu cầu push cả Saltline và Sirocco; lưu source hiện tại, không tuyên bố phần tay/vũ khí đã hoàn tất.
- Đã sửa anchor tay theo datum gốc, bỏ scale tay1.45, bake scale rifle0.68; bổ sung round bucket, empty reload kéo bolt, ammo cập nhật khi lắp băng và FX từ muzzle/eject có bù FOV.
- QA mới `tests/weapons.mjs` chạy nhưng dừng ở ak-seven-buckets:8mesh/2920triangles thay vì7. Còn cần sửa material buckets, kiểm contact/tactical+empty reload cho AK/M4, sửa studio capture (ảnh đang trùng gameplay), kiểm lại gameplay và hình ảnh.
- Lần chạy browser tiếp bị hệ thống xét duyệt tự động từ chối do hết hạn mức xét duyệt, không phải kết luận hành động nguy hiểm. Lệnh lần đó không thực thi, bao gồm thay đổi gộp bucket.
- Trước snapshot:node --check17file đạt, hash3fileSaltline gốc nguyên vẹn; không thấy credential theo mẫu đã quét. Cấu hình .vercel và file môi trường bị loại khỏi Git.
- Baseline trước sửa tay còn trong artifacts/hands-weapons-before. Repo Git dự kiến private danielnguyen0428/saltline-sirocco; sourceSaltline ởroot,Sirocco trongdemo/.
