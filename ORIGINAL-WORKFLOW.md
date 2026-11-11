# [MEOW] Saltline: kỹ thuật tạo game, dấu vết quy trình và hướng chuyển thành demo chiến thuật

**Có thể đọc được cách game vận hành và những công cụ phát triển còn nằm trong bundle. Chưa có prompt gốc, lịch sử hội thoại, source trước build hoặc nhật ký sản xuất để biết chính xác tác giả đã làm theo trình tự nào.** Báo cáo này tách rõ dữ kiện trong file, suy luận có căn cứ và quy trình đề xuất.

Phạm vi: chỉ đọc gói Saltline đã thu hồi; không chạy lại game hoặc sửa core trong bước phân tích này. Ngày: 10/11/2026. Các vị trí mã dưới đây trỏ tới bản bundle đã định dạng, không phải tên file/module nguyên gốc.

## 1. Điều biết được và điều không thể khôi phục

| Nội dung | Kết luận | Mức bằng chứng |
| --- | --- | --- |
| Nơi game được phát hành | Trang được cung cấp qua Claude Artifact; frame có runtime nhúng của nền tảng | **DỮ KIỆN:** [HTML frame:1](/Users/meow/rea/saltline-reverse/evidence/game-page.html:1) và [shell artifact](/Users/meow/rea/saltline-reverse/evidence/artifact-page.html:1) |
| Phiên bản engine | Three.js r180; bản kiểm chứng trước chạy bằng WebGL2 | **DỮ KIỆN:** [revision:431](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:431), [report runtime](/Users/meow/rea/saltline-reverse/evidence/verification-report.json:1) |
| Dấu vết chia quyền phụ trách | CSS có comment `game/ui.css — owned by the Game agent` | **DỮ KIỆN:** comment đã có trong [frame gốc:6](/Users/meow/rea/saltline-reverse/evidence/game-page.html:6), không phải thêm lúc reverse |
| Có làm bằng nhiều agent không | Comment và ranh giới module phù hợp với cách chia việc theo hệ thống | **SUY LUẬN:** chưa biết đó là nhiều agent thật, một agent đóng nhiều vai, hay tên quy ước do tác giả đặt |
| Model/provider đã sinh code | Không xác định được | **KHÔNG BIẾT:** nơi phát hành qua Claude không chứng minh model, phiên bản model hoặc công cụ đã viết tất cả code |
| Prompt nguyên văn, số lượt sửa, thời gian/cost | Không khôi phục được từ các file hiện có | **KHÔNG BIẾT:** shell lưu không có các chuỗi `prompt`, `model`, `creator`; đây chỉ là giới hạn tìm kiếm trên bản shell đã lưu |
| Source tree, bundler, lệnh build | Bundle là một hàm bao tự chạy, có export table nội bộ; tên biến đã rút gọn | **DỮ KIỆN:** [đầu bundle:1](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:1). Không có source map tìm thấy; chưa đủ để chỉ đích danh bundler hay tên mọi file nguồn |
| Quy trình kiểm thử của tác giả | Có showcase, benchmark và self-test được viết sẵn | **DỮ KIỆN về công cụ có trong mã**; không chứng minh tác giả đã chạy chúng hay đạt kết quả nào |

Không suy ra “prompt gốc” bằng cách viết ngược một mô tả khớp game. Nhiều prompt và nhiều chuỗi sửa khác nhau có thể dẫn tới cùng một bundle.

## 2. Kỹ thuật giúp một gói nhỏ tạo được cảnh phức tạp

### Chia hệ thống theo giao diện chung

Các hệ thống nhận chung một đối tượng ngữ cảnh chứa engine, renderer/scene/camera, cấu hình, đồng hồ, bộ tạo số ngẫu nhiên và event bus. Mỗi hệ thống cung cấp các hàm như `create`, `update`, `reset`, `showcase` hoặc các thao tác chuyên biệt. [Khởi tạo ngữ cảnh:72590](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72590), [event bus:35010](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35010).

Ví dụ: súng phát `weapon:fire`; hệ thống âm thanh xử lý sự kiện để phát tiếng, AI có thể phản ứng với tiếng súng, còn combat xử lý kết quả trúng. Kiểu nối này cho phép chỉnh mô hình súng mà không phải viết lại UI/nhiệm vụ, miễn giữ đúng giao diện. [Các kết nối âm thanh:62565](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:62565), [combat:64079](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64079).

**SUY LUẬN:** cấu trúc này phù hợp với việc chốt giao diện trước, phát triển từng phần riêng rồi tích hợp. Không có bằng chứng để khẳng định đây là trình tự lịch sử thực tế.

### Tạo tài nguyên bằng công thức thay vì chở file asset

Game chứa bộ dựng hình học, rig, texture, vật liệu, hiệu ứng và âm thanh. Chúng tạo dữ liệu thật trong RAM/GPU khi chạy:

| Hệ thống | Kỹ thuật | Giá trị đối với sản xuất |
| --- | --- | --- |
| Đồ vật cảng | 36 loại props có kích thước, vật liệu và bề mặt va chạm; ghép hình học và đặt theo bố cục | Tái sử dụng container, rào, thùng, cột… mà không cần model rời cho từng bản sao |
| Texture/vật liệu | 29 họ texture, 48 mẫu vật liệu; shader tạo bản đồ màu, độ nhám/tính kim loại/che khuất và normal; cache theo nhu cầu | Giữ phong cách nhất quán, đổi màu/độ ướt/hao mòn từ tham số |
| Nhãn/decal | Canvas2D vẽ chữ, logo, biển nguy hiểm, dấu bẩn; ghép nhãn vào atlas | Tránh hàng loạt ảnh nhỏ và giúp chi tiết công nghiệp đọc được |
| Súng/tay | Ghép mesh, điều khiển các pha động tác và lò xo | Tạo ngắm, giật, nạp đạn và rung khi di chuyển bằng mã |
| Kẻ địch | Mesh, bone, trọng số skin và skeleton đều dựng bằng mã; hoạt ảnh điều khiển theo trạng thái | Không phụ thuộc clip animation nhập từ DCC |
| Âm thanh | Noise, dao động, bộ lọc và bao biên độ → dữ liệu mẫu → AudioBuffer; nhạc nhiều lớp | Có biến thể phát lại, không gian âm và nhạc thích ứng trong cùng bundle |

Nguồn: [props:40621](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:40621), [texture registry:39346](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39346), [material registry:39425](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39425), [texture factory:39765](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39765), [atlas nhãn:48601](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:48601), [súng:64428](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64428), [rig kẻ địch:67656](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67656), [audio generator:61735](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:61735). Số đếm là số định nghĩa tĩnh, không phải số asset đang cấp phát.

**SUY LUẬN:** cách tiếp cận này hợp với môi trường artifact dễ chia sẻ một gói HTML/JS. Đổi lại, tải file nhẹ không đồng nghĩa chạy nhẹ: browser phải tạo geometry/texture/audio và render nhiều chi tiết. Báo cáo runtime từng ghi khoảng 2 triệu tam giác tại một thời điểm; đó không phải kết quả benchmark dài hạn.

### Hình ảnh được tổ chức thành nhiều lớp

Nền hình ảnh đến từ bố cục cảng, hình khối, vật liệu ướt, hướng nắng và bầu trời; hậu kỳ bổ sung AO, ánh sáng xuyên sương, bloom, chuyển màu HDR, motion blur và grain. Có camera/layer riêng cho vũ khí để kiểm soát hình súng trên màn hình. [Renderer:36902](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36902), [hậu kỳ:36722](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36722).

**SUY LUẬN:** chất lượng tổng thể không thể tái dựng chỉ bằng yêu cầu “đồ họa đẹp”. Prompt triển khai cần mô tả bố cục, màu, độ ướt, tỷ lệ vật thể, hướng sáng, ưu tiên thị giác và ngân sách render cụ thể; sau đó phải xem cảnh thật để điều chỉnh.

### Tuning được gom thành cấu hình

Di chuyển/recoil/hồi máu, thông số súng, AI, nhịp đợt địch và preset đồ họa đều có khối cấu hình riêng. Như vậy có thể thay cảm giác chơi và độ khó mà không đổi toàn bộ thuật toán. [Player tuning:63615](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63615), [súng:66759](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:66759), [AI:70292](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:70292), [nhiệm vụ:71798](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71798), [quality:34913](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:34913).

## 3. Dấu vết cho thấy game có khả năng kiểm tra từng phần

| Dấu vết gốc | Chức năng xác minh được từ mã | Điều không được suy rộng |
| --- | --- | --- |
| `?show=mats|level|backdrop|ground|fx|weapon|enemies|props|render` | Chín showcase dựng phần đang xem trong môi trường đơn giản, dùng input/player dự phòng | Không chứng minh chín phần do chín agent làm |
| `?cam=...`, `fov`, `exposure`, `shot`, `noweapon` và `__setShot` | Đặt góc chụp và các tham số hình ảnh để so sánh ổn định hơn | Không có ảnh đối chiếu/lịch sử revision của tác giả được thu hồi |
| Weapon showcase | Có góc side/right/top/hands/muzzle/optic; pha hip/ADS/sprint/fire/reload/empty; có thời điểm reload đặt sẵn | Không chứng minh mọi pha động tác đã được tác giả xem và sửa |
| `?bench=1` / `#bench` | Tắt audio, autostart, chạy camera trên đường cinematic; hiện average/median/p99 frame time, GPU, buffer, stats, errors | Không dùng con số một screenshot thay kết quả chạy benchmark đầy đủ |
| `__ready`, `__fatal`, `__errors`, `__stats`, `__G` | Cho công cụ bên ngoài chờ khởi động, đọc lỗi và kiểm tra trạng thái | `__ready` chỉ được đặt sau hai frame; không chứng minh mọi tài nguyên nền đã hoàn thành |
| Renderer self-test | Thử vẽ một khối; khi pipeline nâng cao hoặc shader bóng không phù hợp thì rơi về cách render dự phòng | Có fallback nghĩa là app còn chạy, không tự bảo đảm hình ảnh vẫn như thiết kế |
| Audio `selfTest` | Render một kịch bản bằng OfflineAudioContext, đo peak, mẫu vượt ngưỡng, NaN và RMS | Chưa chạy trong lượt reverse; số liệu kỹ thuật không thay việc nghe âm thanh |

Nguồn: [showcase registry:72540](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72540), [khởi tạo showcase:72647](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72647), [góc súng:67567](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67567), [benchmark:72851](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72851), [ready sau hai frame:72848](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72848), [renderer self-test:37482](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37482), [audio self-test:62937](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:62937).

Game có stub cho material, ground, backdrop, FX, audio, weapon, enemies và HUD. Boot ghi lỗi module rồi dùng stub nếu được phép; renderer và level là các phần bắt buộc. Mục tiêu kỹ thuật là không để hỏng một phần tùy chọn kéo sập toàn bộ quá trình khởi động. [Stub contract:35067](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35067), [boot wrapper:72619](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72619).

**SUY LUẬN có căn cứ:** code được tổ chức để hỗ trợ phát triển từng phần, tích hợp sớm, chụp cảnh cố định và tuning. Đây là mô hình quy trình có thể học lại từ artifact; chưa phải bản ghi công việc đã xảy ra.

## 4. Quy trình sản xuất có thể tái dựng hợp lý

Các bước sau là **ĐỀ XUẤT**, không phải lịch sử được chứng minh của tác giả.

| Bước | Sản phẩm cần có trước khi chuyển bước | Kiểm chứng |
| --- | --- | --- |
| 1. Chốt phạm vi | Góc nhìn FPS; một màn cảng; ba relay và điểm thoát; hai loại kẻ địch; một súng; yêu cầu browser/engine và phong cách | Tiêu chí thắng/thua và điều khiển viết được thành các tình huống cụ thể |
| 2. Chốt giao diện hệ thống | Ngữ cảnh chung, event names/payload, vòng đời create/update/reset, tọa độ/đơn vị, vai trò camera | Tạo được stub giữ đúng giao diện và scene rỗng vẫn chạy |
| 3. Greybox chơi được | Sàn, vật cản, di chuyển/collision, ngắm/bắn, máu, một địch và một tương tác | Đi không xuyên vật, đạn không xuyên tường, chết/reset đúng |
| 4. Nhiệm vụ hoàn chỉnh | Trạng thái title/intro/playing/pause/dead/complete, ba relay, extraction, spawn/waves | Chạy được cả nhánh thắng/thua, pause không làm thời gian nhiệm vụ tiếp tục |
| 5. Xây thư viện procedural | Mẫu vật liệu, props, nhãn, súng, rig địch; mỗi nhóm có showcase | Xem silhoutte, tỷ lệ, normal, hướng UV, animation ở góc cố định; kiểm tra không dùng stub |
| 6. Bố trí màn và ánh sáng | Đường đi rõ, vật che chắn, ba khu có đặc trưng; nền xa, nắng/sương/nước | Kiểm tra người chơi đọc được mục tiêu và địch trước khi tăng hậu kỳ |
| 7. Cảm giác chiến đấu | Recoil, spread, ADS, reload, hit feedback, âm thanh theo sự kiện, nhạc thích ứng | Bắn/tái nạp đủ các pha; ngắm và va chạm nhất quán; nghe lại thực tế |
| 8. Tuning và giảm tải | Quality presets, pooling/cache/atlas, giới hạn hiệu ứng, điều chỉnh resolution | Benchmark sau warm-up, ghi kích thước buffer và quality; thử cả cảnh nặng và trận đấu |
| 9. Đóng gói và QA | Bundle + CSS + HTML, lỗi hiển thị rõ, cách chạy riêng | Kiểm tra file/network, syntax, browser smoke, resize, input thật; ghi rõ phần chưa thử |

Nếu chia cho nhiều người/agent, phân công theo các ranh giới hệ thống đã có bằng chứng trong code và có một đầu mối tích hợp. Giao diện, event và unit phải được chốt trước; mỗi phần cần có showcase và kết quả kiểm tra riêng. Đây là đề xuất tổ chức công việc, không khẳng định đúng số người/agent của bản gốc.

## 5. Prompt tái dựng đề xuất

**Đây là prompt mới được viết từ những gì đã đọc trong bundle, không phải prompt gốc thu hồi.** Nó mô tả mục tiêu và điều kiện nghiệm thu; không bảo đảm sinh ra mã hay hình ảnh giống từng byte.

```text
Tạo một FPS chơi đơn tên Saltline chạy trong browser bằng JavaScript và
Three.js r180/WebGLRenderer. Kết quả gồm HTML, CSS và bundle chạy được bằng
HTTP server cục bộ. Dùng một bối cảnh cảng container lúc bình minh sau mưa:
kim loại/sơn hao mòn, mặt đường ướt, nước phản chiếu, nhà kho và cần cẩu xa.

Gameplay tối thiểu hoàn chỉnh:
- Một nhân vật FPS với collision, WASD, chuột, nhảy, ngồi, chạy và pause.
- Một súng có ADS, recoil, spread, băng đạn, reload, hitscan và phản hồi trúng.
- Hai loại máy địch: drone bay và robot bốn chân, có dấu hiệu báo trước tấn công.
- Giữ E khi đứng gần và nhìn đúng relay để cắt; đủ ba relay rồi đến thuyền.
- Có title, intro, HUD, settings, chết/retry, chiến thắng/debrief và reset đầy đủ.

Tạo hình học, rig, texture, decal, hiệu ứng và âm thanh bằng mã.
Phân biệt asset thực sự sinh tại runtime với file font hoặc dependency tải ngoài;
không tuyên bố offline nếu vẫn có request ra mạng.

Chia thành renderer, materials, props, level, ground, backdrop, input, player,
combat, weapon, enemies, FX, audio, HUD và mission. Chốt context/event contract
trước. Có create/update/reset thích hợp; không giấu module hỏng bằng stub khi QA.

Triển khai theo thứ tự: greybox chơi được → thắng/thua/reset → tài nguyên và
ánh sáng → audio/game feel → tối ưu và kiểm tra. Mỗi phần hình ảnh có showcase,
camera cố định và khả năng đặt pose/thời điểm animation để xem xét.

Cung cấp hooks đọc readiness/errors/stats, chế độ benchmark camera cố định,
quality presets và giới hạn cấp phát. Chụp cảnh và thử gameplay thật sau mỗi
mốc có thay đổi ảnh hưởng hành vi. Báo cáo riêng kiểm tra tự động, chơi bằng tay,
thiết bị đã thử và phần chưa kiểm chứng. Không dừng ở ảnh đẹp hoặc menu chạy được.
```

Prompt bước tiếp nên nhỏ và gắn với bằng chứng, ví dụ: “Ở showcase vũ khí, giữ camera và exposure; kiểm tra pha rút/lắp băng đạn, ghi nhận giao nhau hình học rồi chỉ sửa lỗi nhìn thấy”, hoặc “Tại ba điểm trên benchmark, ghi quality/buffer và frame time trước/sau khi giảm một nguồn draw call”. Không có căn cứ nói tác giả gốc đã dùng các câu này.

## 6. Những điều cần thay thật khi chuyển sang demo kiểu CS:GO

Phần này là **ĐỀ XUẤT cho demo chiến thuật lấy cảm hứng theo yêu cầu**, không mô tả game gốc hay xác nhận tính tương đương với CS:GO. Dùng hình học, vật liệu và tên bản đồ tự dựng; không cần đưa asset gốc của một game thương mại vào gói để chứng minh cơ chế.

| Có thể giữ làm nền kỹ thuật | Cần thiết kế/chỉnh cho demo mới |
| --- | --- |
| Renderer, chất lượng, camera FPS, input, collision, hitscan, cấu trúc HUD/menu | Luật round và hết giờ; điều kiện thắng/thua; reset mỗi round |
| Factory props/material/decal và cơ chế dựng bản đồ | Bố cục đường đi, góc giữ, vật che và khu mục tiêu có chủ đích; không chỉ đổi màu cảng |
| Súng procedural, pha reload, recoil/ADS và âm thanh sự kiện | Cảm giác súng, độ chính xác khi di chuyển, nhịp bắn, damage, HUD; xác định rõ cái gì lấy cảm hứng và cái gì giản lược |
| Event bus, hệ thống tương tác hold, đồng hồ nhiệm vụ | Nếu dùng đặt/gỡ bom: vị trí hợp lệ, thời gian hold, hủy khi thả/ra xa/chết, đồng hồ bom, ưu tiên khi nhiều điều kiện kết thúc cùng lúc |
| Cấu trúc AI và quản lý spawn | Bot phục vụ round, nhận diện phe/mục tiêu, xử lý hết bot; không để logic wave/pursuit của relay vẫn sinh địch sau khi round kết thúc |
| Title/pause/debrief/settings | Nội dung, scoreboard/round status, buy/loadout nếu thuộc phạm vi; không để nội dung relay/boat còn sót |

Saltline đang có hồi máu tự động sau 4 giây, sprint/ADS, ba relay, đợt địch tăng dần và extraction. Chúng là luật của Saltline, không tự trở thành luật của demo chiến thuật khi đổi title. [Player tuning:63615](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63615), [mission tuning:71798](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71798).

Một demo nhỏ có thể chọn chơi đơn với bot, một bản đồ và một chế độ round; chưa có bằng chứng trong bundle về hệ thống multiplayer, matchmaking hay server authoritative. Tìm tên WebSocket/RTCPeerConnection/socket.io trong bundle không thấy, nhưng kết luận chính vẫn dựa trên kiến trúc local được đọc. Không gọi bản demo này là multiplayer chỉ vì có nhiều nhân vật.

Nên giữ nguyên bằng chứng nguồn, hash và bản Saltline chạy được; tạo bản demo có file chạy riêng trong phạm vi task để có thể so sánh/rollback. Chỉ sửa những đường đi chịu trách nhiệm cơ chế mới; không dùng thay chuỗi toàn bundle vì có tên rút gọn và nhiều hệ thống phụ thuộc chung.

Kiểm tra demo mới phải có tình huống thật cho từng nhánh: bắt đầu round, bắn/đạn/reload, bot chết/người chơi chết, timeout, mục tiêu hoàn tất, pause và round kế tiếp. Nếu có bom, thêm plant/defuse/cancel/explode và kiểm tra sự kiện kết thúc chỉ phát một lần. Bộ 22 test của Saltline hiện có không đủ chứng minh demo mới đúng luật.

## 7. Hạn chế của bản gốc và của bằng chứng

- **Fallback có thể làm app chạy nhưng mất chức năng.** Stub vũ khí chứa tên `KR-7` và reserve 120, khác súng thật PAC-9/reserve 150. Đây là giá trị dự phòng, không phải bằng chứng có súng thứ hai. QA phải kiểm tra `.stub` và chức năng thật. [35067](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35067).
- **Melee chưa xác nhận đầy đủ:** UI/input có F/V và audio listener, nhưng tìm trong bundle chưa thấy đường thực hiện đòn đánh người chơi. Không coi label là chứng minh gameplay đã hoạt động. [Input:63126](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:63126), [listener:62584](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:62584).
- **Radio là text đã kiểm chứng**, chưa thấy voice-over/TTS; không lên kế hoạch tái sử dụng các file thoại không tồn tại trong gói. [71159](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71159).
- **Mô tả title “Nothing is downloaded” không bao quát font.** HTML vẫn tải Google Fonts. [HTML:8](/Users/meow/rea/saltline-reverse/index.html:8), [nội dung title:71493](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:71493).
- **Dynamic resolution làm FPS khó so sánh nếu không ghi quality và buffer.** Engine có thể hạ scale và cả quality khi chậm. [37100](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37100).
- **Seed không đồng nghĩa toàn game deterministic.** Context có seeded RNG nhưng audio scheduling có `Math.random`; chưa chứng minh tất cả hệ thống dùng cùng chuỗi ngẫu nhiên hay fixed timestep. [72598](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:72598), [61900](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:61900).
- **22 kiểm tra đã đạt là kiểm tra do lượt reverse tạo**, không phải test suite thu hồi từ tác giả. Chúng có đặt vị trí và bật bất tử ở relay; audio tắt; chưa chứng minh thắng tự nhiên, cảm ứng/gamepad, chất lượng nghe hoặc hiệu năng dài hạn. [tests/verify.js:1](/Users/meow/rea/saltline-reverse/tests/verify.js:1), [kết quả](/Users/meow/rea/saltline-reverse/evidence/verification-report.json:1).
- **Không có lịch sử sáng tác.** Prompt, file nguồn trước build, commit, số agent, model và thời lượng sản xuất vẫn chưa biết. Báo cáo này không điền các chỗ trống đó bằng phỏng đoán được trình bày như sự thật.

## 8. Ghi nhận kiểm chứng tài liệu

Báo cáo dựa trên đọc mã và kiểm kê file đã có. Không khẳng định đã chạy các showcase, renderer/audio self-test hay benchmark trong bước này. Các đường dẫn/số dòng được kiểm tra tồn tại; hash những file được ghi trong recovery manifest được đối chiếu để xác nhận bước phân tích không đổi bản thu hồi.
