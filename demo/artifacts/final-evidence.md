# [MEOW] Sirocco — đối chiếu TECHNIQUES và bằng chứng kiểm chứng

> Báo cáo này là mốc trước lượt sửa tay/vũ khí tiếp theo. Snapshot Git hiện tại có thay đổi mới chưa hoàn tất QA; trạng thái mới nằm trong [game-progress.md](game-progress.md) và [hands-weapons/report.json](hands-weapons/report.json).

Ngày: 11/11/2026. Phạm vi: `/Users/meow/rea/saltline-reverse/demo`. Chuẩn đối chiếu là [TECHNIQUES.md](/Users/meow/rea/saltline-reverse/TECHNIQUES.md), thay cho phạm vi hẹp của lượt procedural trước. Bản này giữ gameplay đặt/gỡ bom đấu bot và map sa mạc A/B đã được người dùng chọn.

## Kết quả

**43/43 ca gameplay, 23/23 ca TECHNIQUES và lượt chuyển động bằng vòng game thật đều đạt.** Không ghi nhận lỗi runtime trong các báo cáo này. Đã kiểm cú pháp 14 file JavaScript, tính tái lập của engine adapter và hash ba file Saltline gốc.

| Bằng chứng | Nội dung |
| --- | --- |
| [Gameplay report](/Users/meow/rea/saltline-reverse/demo/artifacts/verification/report.json) | 43 ca input, combat, AI, nhiệm vụ, reset, audio và HUD |
| [TECHNIQUES report](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/report.json) | 23 ca kiểm cơ chế, pass/uniform thực tế, geometry, skinning, FX, quality và runtime |
| [Motion report](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/motion/report.json) | Vòng requestAnimationFrame không tạm dừng, input bắn/nạp/đi/nhảy, mốc thời gian và pose |
| [Motion video](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/motion/live-motion.mp4) | Chuỗi PNG ghép theo thời gian thu thực tế; không phải video ghi mọi frame |

Các báo cáo `artifacts/procedural`, `artifacts/techniques-before` và `artifacts/techniques-bots/rig-report.json` là lịch sử/kiểm tra trung gian, không đại diện cho bản cuối. Report rig trung gian đã dùng điểm ngay pivot để đo biến dạng và thất bại; bộ TECHNIQUES hiện tại đo vertex xa pivot và xác nhận chuyển động thực.

## Đối chiếu tài liệu với implementation

“Dùng trực tiếp” nghĩa là gọi hàm trong bundle gốc qua adapter. “Điều chỉnh” nghĩa là áp dụng cơ chế nhưng viết hình dạng/tham số hoặc logic phù hợp Sirocco; không khẳng định code hoặc kết quả giống nguyên bản.

| Mục trong TECHNIQUES | Cách áp dụng | Source Sirocco và bằng chứng |
| --- | --- | --- |
| §1 Primitive, merge, meter UV | Dùng helper cạnh vát/rounded box/merge gốc; bake transform, UV theo mét, merge theo material | [map.js](/Users/meow/rea/saltline-reverse/demo/src/map.js:5); 1.900 phần, 22 mesh tĩnh kể cả ground, 79 collider |
| §1 Hình mềm và vertex AO | Dùng props bạt/bao cát gốc; điều chỉnh màu/scale/vị trí, vertex AO theo normal và khoảng cách mặt đất | [map.js](/Users/meow/rea/saltline-reverse/demo/src/map.js:265); bảy cụm soft props |
| §2 Vật liệu và decal/nhãn | Dùng factory GPU gốc tạo albedo/normal/ORM và shader patch; atlas chữ riêng có stencil, hao mòn, padding | [map.js](/Users/meow/rea/saltline-reverse/demo/src/map.js:303); một atlas 1024 × 512, padding 16 px |
| §3 Sky/environment và shadow | Gọi renderer gốc với shader sky/PMREM/PCSS; điều chỉnh bảng màu nắng/trời cho sa mạc | [main.js](/Users/meow/rea/saltline-reverse/demo/src/main.js:27); test `original-HDR-PCSS` |
| §3 HDR và súng | HDR HalfFloat/depth/MSAA gốc; camera súng layer 1/FOV 54 và depthRange 0–0,05 | [main.js](/Users/meow/rea/saltline-reverse/demo/src/main.js:36); `HDR-depth-MSAA` ghi samples 4 ở high |
| §3 Hậu kỳ/quality | Dùng nguyên graph renderer gốc; bind các tune đọc một lần lúc boot sang uniform thực tế, giữ quality/adaptive resolution | [render-diagnostics.js](/Users/meow/rea/saltline-reverse/demo/src/render-diagnostics.js:2); `actual-post-pass-graph`, `post-tuning-reaches-shaders` |
| §4 Ground CPU → GPU | Điều chỉnh sang mặt đất khô: mask RGBA về relief/cát/bẩn/lối đi, detail tuần hoàn, normal và roughness; CPU dùng cùng bytes cho truy vấn bề mặt | [ground.js](/Users/meow/rea/saltline-reverse/demo/src/ground.js:3); mask 512 hoặc 256, detail 256, ba texture |
| §5 VFX | Gọi trực tiếp `createCombatFX`; nối sự kiện bắn, vết đạn, vỏ đạn, nổ và tracer vào năm batch gốc | [main.js](/Users/meow/rea/saltline-reverse/demo/src/main.js:59); 48 tracer slot, stress test giữ nguyên tài nguyên |
| §6 Hình súng/tay | AK/M4 dựng mới bằng extrude có lỗ và lathe; chi tiết vật liệu object space gốc; tay gọi helper loft `Vv`, ngón cò nội suy pose | [weapons.js](/Users/meow/rea/saltline-reverse/demo/src/weapons.js:234); `loft-spring-quad-weapon` |
| §6 Flash/recoil/reload | Flash gốc `N_` gồm 8 quad; 9 spring dùng bộ tích phân `ma`; reload smootherstep vị trí/quaternion, magazine/bolt riêng | [weapons.js](/Users/meow/rea/saltline-reverse/demo/src/weapons.js:268); impulse, settle và tháo/lắp magazine đạt |
| §6 Rig/animation | Dùng RigBuilder/createRig gốc: một geometry chung, mỗi bot Skeleton/SkinnedMesh riêng, mỗi vertex một bone weight 1; controller đặt bone trực tiếp | [bots.js](/Users/meow/rea/saltline-reverse/demo/src/bots.js:15); 16 bone, 7 material group, 4 skeleton riêng |
| §7 Audio | Dùng công thức DSP và generator gốc; adapter cache/round-robin/pitch, lịch chia lát, 45 voice ưu tiên, Panner, 2 reverb, 5 stem, compressor/soft clip | [audio.js](/Users/meow/rea/saltline-reverse/demo/src/audio.js:2); 51 buffer, 5 stem, không có lỗi phát được ghi nhận |

Adapter trong [build-engine.py](/Users/meow/rea/saltline-reverse/demo/build-engine.py:1) kiểm SHA-256 bundle nguồn rồi chỉ thay đúng một lời gọi bootstrap bằng `window.SaltlineEngine`. Nội dung các helper gốc không bị viết lại. Engine vẫn Three.js r180/WebGL2; không nâng dependency hoặc chuyển WebGPU/R3F.

Sirocco không cần biển, mưa, phản chiếu mặt đất ướt, tàu/cẩu hoặc robot Hound/Gull của bối cảnh cảng. Các phần đó không được đưa vào màn chơi. AK/M4 dùng thước ngắm cơ khí, không dùng kính ngắm holographic gốc. Ground khô và humanoid là phần điều chỉnh, không phải asset gốc được đổi tên.

## Pipeline được quan sát tại runtime

Report ghi nhận đường render thực tế:

```text
world HDR → depth copy → viewmodel HDR
→ half depth → AO → bilateral AO blur
→ volumetric → bilateral volumetric blur → composite
→ motion reprojection → bloom down/up → streak
→ exposure adaptation → color grade → final
```

Đã kiểm giá trị tới shader, không chỉ kiểm object cấu hình: AO radius 0,65/intensity 1,25, AO composite strength 0,7; volumetric sigma 0,0018/far haze 0,22. Điều này sửa trường hợp factory gốc chỉ đọc một số giá trị tune lúc tạo material. Tên `render-diagnostics.js` bao gồm cả ghi nhận pass và lớp bind tune này; file đó không thay graph gốc.

Ở preset low, ảnh đầu ra nội bộ là 896 × 504 cho viewport 1280 × 720, MSAA 0 và không có AO. Preset medium seed 993 chạy ở 1088 × 612/MSAA 2. Chế độ `post=0` và resize đều chạy không lỗi. Các bài đo cố định `dynres=0`; chưa benchmark khả năng tự hạ quality trong một lượt chơi dài.

## Số đo và ngân sách

Sáu frame mẫu ở cảnh xuất phát, high, seed 71, viewport 1280 × 720, khóa độ phân giải:

| Chỉ số | Kết quả |
| --- | ---: |
| Draw calls mỗi frame | 84–131 |
| Tam giác renderer đếm mỗi frame | 160.564–297.644 |
| Geometry GPU ở thời điểm mẫu | 41 |
| Texture GPU ở thời điểm mẫu | 83 |
| Render target đã quan sát sau boot | 25 |
| Bộ texture do material factory báo | 11 |
| Ước tính riêng texture của factory | 59,3 MiB |

Khoảng biến thiên bao gồm những frame cập nhật shadow. Số tam giác là tổng các pass, không phải số tam giác duy nhất trong map. 25 target là inventory đã quan sát, gồm ping-pong/target trung gian; không phải 25 ảnh được vẽ đầy màn hình mỗi frame. Ước tính 59,3 MiB không bao gồm toàn bộ target/depth/geometry và không đại diện tổng VRAM.

Texture cao hơn giới hạn 60 của bản forward cũ vì đã thêm HDR/post targets, mask và atlas FX. Bộ test mới kiểm pass/target, giới hạn geometry và tính ổn định của pool; không tiếp tục áp dụng ngưỡng texture cũ cho một pipeline khác. Chưa có đo FPS/GPU timing dài hạn, nên không kết luận tốc độ tăng theo tỉ lệ giảm draw calls. Không dùng số 233 calls của bản trước làm kết quả bản này.

| Asset | Geometry trước khi nhân theo render pass |
| --- | --- |
| Map | 109.478 tam giác, 22 mesh tĩnh, 21 material slot cộng ground |
| AK | 10 mesh, 2.680 tam giác; chưa gồm tay và flash |
| M4 | 9 mesh, 3.660 tam giác; chưa gồm tay và flash |
| Mỗi bot | 1 SkinnedMesh, 6.952 tam giác, 16 bone; 7 material group nên không đồng nghĩa 1 draw call |

## Phạm vi kiểm tra

Gameplay 43 ca bao phủ di chuyển/nhảy/ngồi/nhìn, collision, bắn/nạp, hitbox và tường chắn, bot phản ứng/bắn trả, đường A/B, giữ/thả E, đặt/gỡ/nổ, timeout/chết/thắng, reset, pause, audio và HUD hẹp. Test có input browser thật và fixture dịch chuyển hoặc cô lập AI để kiểm luật; không gọi đó là trận thắng tự nhiên toàn bộ bằng tay.

TECHNIQUES 23 ca kiểm:

- Renderer/PCSS, graph hậu kỳ và uniform thật, HDR/depth/MSAA, ngân sách frame.
- Buffer hữu hạn; geometry asset không có mặt suy biến hoặc normal sai trong phạm vi kiểm.
- Geometry bot dùng chung, skeleton và mảng material riêng; skin weight hợp lệ. Vertex xa pivot dịch chuyển khoảng 0,220 m khi xoay bone thử.
- Controller đi bộ làm thay đổi vị trí và góc chân; recoil tạo impulse rồi ổn định; magazine rời và về đúng vị trí sau reload.
- Ground mask CPU, bảy soft props, atlas và collider; truy vấn cả bên trong/ngoài biên trả kết quả hữu hạn.
- FX có năm batch; stress thêm 600 tracer không làm tài nguyên GPU tăng: geometry 54 → 54, texture 77 → 77. Peak tracer 48; hạt/tracer/debris hết tuổi thọ trở về 0.
- Audio có reverb/stem/compressor/soft clip; 45 voice tối đa, pending synthesis về 0. Lượt stress ghi voice stealing theo ưu tiên; đây là kiểm giới hạn pool, không phải đánh giá chất lượng nghe.
- Flash hết tuổi thọ ngay cả khi phát đạn cuối kết thúc round. Đổi round xóa voice tạm và đuôi reverb cũ, giữ các stem đồng bộ.
- Resize, no-post, low, seed 993 và không có runtime error.

Kiểm topology có loại trừ **ba template FX động nguyên bản**: buffer decal dự phòng chứa quad chưa sử dụng và cực của lathe vỏ đạn có mặt diện tích 0. Vẫn kiểm các buffer này hữu hạn; tính giới hạn/tuổi thọ kiểm riêng bằng stress test. Kết quả `0 degenerate` chỉ áp dụng geometry asset được kiểm, không có nghĩa toàn bộ buffer dự phòng của engine không chứa mặt bằng 0.

Lượt motion dùng vòng game thật thay vì `advanceTime`: lấy tám mốc bot đi bộ và 12 mốc reload, sau đó input đi/nhảy. LOS được tắt tạm để cô lập patrol, rồi dừng AI khi quan sát reload. Report cuối có ammo 30/reserve 86 sau bốn phát; không còn reloading; audio không có lần phát thất bại. Video được ghép từ các ảnh lấy mẫu, không dùng để kết luận độ mượt 30 FPS.

## Hình ảnh và lỗi đã sửa

Các ảnh bản cuối đã được xem trực tiếp gồm [cảnh xuất phát](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/final.png), [bot phía trước](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/bot-front.png), [khu A](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/site-a.png), [AO](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/post-ao.png), [magazine rời súng](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/reload-out.png) và các mốc motion [đi 0](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/motion/walk-0.png), [đi 1](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/motion/walk-1.png), [reload 1](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/motion/reload-1.png), [reload 3](/Users/meow/rea/saltline-reverse/demo/artifacts/techniques/motion/reload-3.png).

Đã sửa qua tích hợp/QA: gán layer/camera để viewmodel dùng đúng renderer gốc, cập nhật tune tới shader, giảm AO/sương/bloom theo cảnh khô, tiếp tục tick flash ở màn kết quả, xóa voice/reverb khi đổi round. Hai lỗi vòng đời cuối được bổ sung regression trong bộ TECHNIQUES.

## Tính nguyên vẹn và cách chạy lại

`node --check` đạt cho bảy module `src`, sáu script `tests` và engine adapter. Chạy lại `python3 build-engine.py` tạo output cùng SHA-256:

```text
saltline-engine.js  0b341ac773be00c5151014a3c1bad6b81c31ae782f412780c31be808d92ddc78
```

Ba file Saltline gốc giữ nguyên:

```text
game.js     8d0057dc4d6dac77e20be2ef1f2b623e19346b5803fde1b3dbabbab508d75d9d
styles.css  e8de46e058377fd7151396f1d4b53b321cb008856570d7535172523cb4d5fdf9
index.html  79b9b9331d2cab861a4b121352f34aa2126635e48039f4a9f3ae91ef80fd331e
```

Lệnh chạy và dependency QA có trong [README](/Users/meow/rea/saltline-reverse/demo/README.md). Server local trả HTTP 200 tại [Sirocco](http://127.0.0.1:5189/demo/) khi kiểm tra bàn giao. Workspace không có Git; bản báo cáo/ảnh của lượt trước được giữ trong `artifacts/techniques-before`.

## Giới hạn còn lại

Kỹ thuật đã được đối chiếu bằng source và runtime; không có căn cứ gọi hình ảnh giống 100% Saltline, CS:GO hoặc đạt chất lượng AAA. Tạo hình còn rõ phong cách procedural. Humanoid dùng rigid skinning như cơ chế gốc, không có mô phỏng vải hoặc bộ clip animation chuyên nghiệp.

Ground là mặt phẳng va chạm với chi tiết shader. Map hiện không khai báo vùng nội thất cho audio: hai convolver được tạo/kiểm, nhưng chưa kiểm chuyển âm trong/ngoài nhà bằng cách đi qua ranh giới. Lịch audio chỉ tạo buffer súng đầu tiên ngay khi mở tiếng rồi xếp phần còn lại vào hàng đợi, khác 19 buffer boot của bản gốc. Đây là điều chỉnh có chủ ý trong adapter.

Chưa nghe đánh giá audio, chơi thắng tự nhiên toàn trận, kiểm cảm ứng thật, benchmark GPU/FPS/VRAM dài hạn hoặc xác nhận đủ luật CS:GO. Bản này hoàn tất trong phạm vi local; chưa phát hành Sirocco online và không thay route Saltline `/gameaaa` trong lượt này.
