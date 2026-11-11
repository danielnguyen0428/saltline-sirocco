# Saltline — kỹ thuật sinh asset, vật liệu và hiệu ứng bằng code

[MEOW] Phân tích ngày 11/11/2026, đọc tĩnh bản bundle đã định dạng `evidence/game.pretty.js`. Không chạy lại game, không sửa bundle. [ASSETS.md](/Users/meow/rea/saltline-reverse/ASSETS.md) kiểm kê game có những gì; tài liệu này giải thích từng thứ được làm ra bằng kỹ thuật nào. Riêng hình học, texture GPU, vật liệu PBR và decal còn có một bài viết riêng ở [PROCEDURAL-ASSETS-ANALYSIS.md](/Users/meow/rea/saltline-reverse/PROCEDURAL-ASSETS-ANALYSIS.md).

Saltline không chở asset nào: model, texture, hiệu ứng và âm thanh đều sinh ra lúc chạy, theo ba cơ chế lặp lại ở mọi hệ thống.

- **Hình học:** ghép từ primitive tự viết, bake transform và màu đỉnh, rồi merge theo material.
- **Vật liệu:** texture bake một lần trên GPU bằng GLSL, gắn vào `MeshStandardMaterial` đã chèn thêm shader.
- **Hiệu ứng:** thứ nền (mưa, chim, đèn nháy) chạy hoàn toàn trong vertex shader; thứ gameplay (hạt, vỏ đạn, decal) chạy trên pool CPU có ngân sách cố định.

Số trong ngoặc vuông là số dòng trong `evidence/game.pretty.js`. Tên hàm là tên đã minify trong bundle, không phải tên nguồn gốc. Bảng đổi tên class Three.js nằm ở [phụ lục](#phụ-lục-bảng-alias-class-threejs).

## 1. Hình học

### Mẫu dựng chung

Mọi builder dùng chung mẫu "part list": tạo primitive, bake transform vào geometry, ghi vertex color, đẩy vào bucket theo material, cuối cùng merge mỗi bucket thành một mesh. Có hai class builder cho props ([41060](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:41060), [44574](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:44574)), một bộ lệnh dựng level ([48296](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:48296)), một batcher cho phông cảnh ([51000](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:51000)) và một builder rig ([67658](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67658)); tất cả cùng một ý.

Level tĩnh sau đó được gộp thêm một lần theo `material.uuid` + cờ cast/receive shadow + layer ([35495](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35495)), nên draw call xấp xỉ số material chứ không theo số vật thể. Mesh nằm dưới node có cờ `noMerge` (quạt, relay, spreader của cẩu) được giữ riêng để còn chuyển động. Props không dùng InstancedMesh.

### Primitive tự viết

| Kỹ thuật | Cách làm | Dòng |
| --- | --- | --- |
| UV theo mét | Box projection theo trục normal trội; mọi primitive xuất UV đơn vị mét nên texel density đều sau khi merge | [35347](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35347) |
| Chamfer box | 24 đỉnh, 44 tam giác; dải vát dùng chung đỉnh hai mặt kề nên normal tự nội suy, cạnh bắt highlight mà không tốn thêm đỉnh | [40760](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:40760), [44165](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:44165) |
| Rounded box | BoxGeometry 3×3×3, đỉnh ở cạnh và góc được chiếu lên bán kính bo quanh hộp lõi | [35366](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35366) |
| Loft | Profile 2D nhân danh sách station qua một hàm ánh xạ; tự sửa winding; dùng cho vách container, barrier | [40874](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:40874) |
| Tôn container | Profile hình thang chỉ phát đỉnh tại 4 điểm gãy mỗi chu kỳ | [40956](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:40956) |
| Vết móp | Danh sách vết có seed, độ lún cộng dồn với falloff `(1−d²)²` | [41288](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:41288) |
| Lathe | Normal giải tích từ tiếp tuyến profile; lặp một điểm hai lần để tạo cạnh cứng | [44115](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:44115), [64305](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64305) |
| Extrude | Normal mượt nếu góc giữa hai cạnh dưới ngưỡng, ngược lại cứng; lỗ thật bằng `Shape.holes`, không có CSG | [44382](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:44382), [64249](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64249) |
| Ống và cáp | `TubeGeometry` trên `CatmullRomCurve3`, số đoạn theo chiều dài | [35426](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35426) |
| Hàn normal | Cộng normal mặt theo vị trí lượng tử 0.5 mm, làm mượt xuyên seam UV | [44286](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:44286) |

### Hình mềm

Hình mềm đều là rounded box chia lưới, đi qua một hàm biến dạng rồi hàn normal.

- **Bạt phủ:** heightfield lấy giá trị lớn nhất của các "lều" quanh từng thùng hàng, cộng noise và nếp gấp sin; dây chằng lấy mẫu từ chính bề mặt bạt ([46165](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:46165)).
- **Bao cát:** thót hai đầu theo luỹ thừa, phồng mặt trên, võng theo lớp, thêm noise ([46365](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:46365)).
- **Carton móp:** đỉnh sụp theo bình phương cao độ; băng keo đi qua cùng hàm nên bám theo mặt móp ([46446](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:46446)).

### Vertex color làm texture thứ hai

- **AO trong rãnh tôn:** tối 17–18% theo độ sâu rãnh ([41465](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:41465)).
- **Bẩn và AO khi hoàn tất prop:** hai octave value noise, AO bán cầu theo `normal.y`, dải 20 cm sát đất tối và ngả nâu ([44635](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:44635)):

```js
_ = (0.82 + 0.18*m) * (0.92 + 0.08*A) * (0.76 + 0.24*clamp(ny*0.6 + 0.62, 0, 1));
M = clamp(1 - y/0.2, 0, 1);              // dải sát đất
_ *= 1 - 0.42*M*M*(0.55 + 0.45*A);
```

- **Lỗ giả:** plane hoặc đĩa tối đặt lệch 1–2 mm thay cho boolean ([41358](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:41358)).
- **Giá trị lớn hơn 1:** tạo thép sáng trong material tối, gom nhiều "vật liệu" vào một draw call; mòn cạnh chỉ áp lên đỉnh thuộc mặt vát ([64207](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:64207)).
- **Aerial perspective:** độ mờ theo khoảng cách bake sẵn vào màu đỉnh của skyline ([53240](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:53240)).

### Biến thiên, cache, collider

- **Seed:** RNG mulberry32 cho mỗi builder; nhãn, màu, vết móp, ngăn kéo mở đều lấy từ seed.
- **Cache geometry container:** khoá là tên + seed lượng tử hoá + góc cửa + độ mòn; thân dùng material giữ chỗ, lúc tạo instance mới ánh xạ sang `paint_<màu>`, nên 8 màu sơn dùng chung geometry ([41874](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:41874)).
- **Collider:** danh sách AABB viết tay đi kèm prop. Prop đặt lệch trục bị cắt tối đa 10 lát theo trục dài ([48436](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:48436)). Cùng các AABB đó nuôi raycast và nav grid ([40462](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:40462)).

### Level và phông cảnh

- **Level là code thủ tục** với toạ độ viết thẳng, không có file dữ liệu ([50596](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:50596)). Chồng container nhận jitter vị trí, yaw và seed riêng cho từng thùng ([48518](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:48518)).
- **LOD bằng cách chạy lại builder:** cẩu ở xa là chính builder cẩu gần, ép về một material và bỏ mọi mảnh nhỏ hơn 2.6 m ([51014](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:51014)).
- **Thân tàu:** một hàm tham số theo station, cao độ và mạn; normal bằng sai phân trung tâm ([52164](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:52164)).
- **Đèn xa:** mọi đèn là octahedron 8 tam giác trong một batch; attribute `blink` (chu kỳ, pha, duty) được xử lý ở vertex shader ([51151](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:51151)). Cửa sổ sáng trên tàu là hộp mỏng chọn bằng hash, không có texture.
- **Chim:** 12 con trong một mesh, quỹ đạo và nhịp vỗ cánh tính ở vertex shader ([53908](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:53908)).
- **Nhãn:** gom vào một atlas rộng 2048 bằng shelf packing, vẽ giãn ra vùng đệm để chống bleed mipmap ([48601](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:48601)).

## 2. Vật liệu

### Bake texture trên GPU

Mỗi họ texture trong 29 họ là một hàm GLSL `surf(uv)` viết trên thư viện chung ([37630](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37630)).

- Thư viện gồm hash PCG có chu kỳ (nên texture tile liền mạch), gradient noise, fbm, voronoi F1/F2, vết xước và mô hình tróc sơn (mảng tróc, quầng oxit, vệt gỉ chảy xuống).
- Shader chạy một lần vào render target 3 attachment ([37675](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37675)):

```glsl
o0 = vec4(sqrt(clamp(c, 0.0, 1.0)), sat(a));          // albedo + mặt nạ tint
o1 = vec4(sat(ao), clamp(r, 0.03, 1.0), sat(m), 1.0);  // AO, roughness, metalness
float hh = sat(h) * 255.0; float fl = floor(hh);
o2 = vec4(fl / 255.0, hh - fl, 0.0, 1.0);              // height 16 bit trên 2 kênh
```

- Pass thứ hai đổi height thành normal map bằng sai phân 8 điểm lân cận ([38195](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:38195)); độ mạnh của bump tính theo kích thước tile thật.
- Kết quả copy sang texture có mipmap và anisotropy ([39765](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39765)). Kích thước theo quality, từ 256 đến 2048. Target trung gian bị huỷ sau 4 giây không dùng.
- Texture sinh theo nhu cầu: họ nào chưa được vật liệu nào gọi thì không bake.

### Alpha của albedo là mặt nạ tint

Shader sơn xuất riêng lớp không nhuộm (gỉ, lớp lót, bẩn) và lượng sơn còn lại. Lúc render ([39678](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39678)):

```glsl
diffuseColor.rgb = sampledDiffuseColor.rgb + diffuse * sampledDiffuseColor.a;
```

Một bộ texture sơn cho ra 8 màu, còn gỉ và bẩn giữ màu riêng.

### Patch vật liệu chuẩn

48 preset đều là `MeshStandardMaterial`; shader chèn qua `onBeforeCompile` ([39740](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39740)) nên giữ nguyên bóng, IBL và BRDF của Three.js. Mỗi preset gồm họ texture, kiểu tint, hệ số rough/metal, bộ tham số ướt và bộ tham số biến thiên vĩ mô ([39407](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39407)). Phần chèn thêm:

- **Một lần đọc ORM:** AO, roughness, metalness lấy từ cùng một texture.
- **Biến thiên vĩ mô:** value noise 3D world-space đổi albedo và roughness để phá lặp tile ([39639](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39639)).
- **Ướt mưa:** mạnh nhất ở mặt ngửa, thành vệt trên mặt đứng, dải ẩm sát đất, hạt nước đọng khi nhìn gần; albedo tối và bão hoà hơn, roughness giảm, normal phẳng lại ([39648](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39648)).
- **Triplanar:** biến thể cho mesh skinned và instanced ([39618](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39618)).
- **Lưới thép ở xa:** ngưỡng alpha hạ theo mip để sợi giữ khoảng 1 pixel, rồi chuyển sang dither khi mắt lưới nhỏ hơn pixel ([39692](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39692)).
- **Chống lấp lánh:** tăng roughness theo độ ngắn của vector normal map đã lọc ([39711](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39711)).

Súng có thêm một detail shader riêng: noise object-space tạo xước dị hướng, vòng tiện, stipple polymer và giọt nước mưa ([66720](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:66720)).

### Decal và nhãn

- Vẽ bằng Canvas2D với RNG có seed từ hash của tên ([38365](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:38365)).
- Chữ stencil: vẽ chữ rồi khoét một khe dọc bằng `destination-out` ([38303](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:38303)).
- Mài mòn: đa giác, vết xước và đốm khoét bằng `destination-out` ([38258](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:38258)).
- Tô sẵn màu nền alpha rất thấp để mipmap không viền tối.
- Nhãn được vẽ lại khi webfont tải xong ([39320](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:39320)).
- Material: `transparent`, `depthWrite: false`, `polygonOffset −2` ([38348](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:38348)).

## 3. Ánh sáng và hậu kỳ

### Bầu trời và environment

Một fragment shader trên khối hộp vẽ toàn bộ bầu trời ([35602](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35602)): tầng mây 2D bằng fbm có domain warp, khe hở về phía mặt trời, tự đổ bóng bằng chênh lệch mật độ theo hướng nắng, chớp trong mây. Chính shader đó được chụp qua PMREM làm environment map, có bỏ đĩa mặt trời và kẹp độ sáng để tránh đốm ([35732](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35732)).

### Bóng nắng

- Một `DirectionalLight` với một shadow map khít theo AABB của level, không cascade ([35745](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35745)). Kích thước 1024–4096 theo quality.
- Hàm `getShadow` trong shader chunk của Three.js bị thay bằng PCSS ([35796](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35796)): Vogel disk xoay bằng interleaved gradient noise, 8 tap tìm blocker, 10–16 tap lọc, penumbra rộng theo khoảng cách blocker, receiver-plane depth bias.
- Bóng cập nhật cách frame, trừ mức ultra ([37178](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37178)).
- 6 `PointLight` dùng chung cho chớp nòng, nổ và đèn bám theo vật ([36980](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36980)).

### Súng không xuyên tường

Camera thứ hai với FOV 54 (camera thế giới là 74) chỉ thấy layer của súng. Súng vẽ vào cùng HDR target với `gl.depthRange(0, 0.05)` ([37185](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37185)).

### Chuỗi hậu kỳ

Cảnh render vào target HalfFloat có MSAA 0/2/4 và depth texture ([37048](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37048)). Thứ tự pass ([36285](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36285)):

1. Depth tuyến tính nửa độ phân giải.
2. AO 12 tap, normal dựng lại từ depth, lọc bilateral ([35897](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35897)).
3. Volumetric raymarch 10–40 bước, đọc thẳng shadow map của mặt trời; phase Henyey-Greenstein hai thuỳ; không khí đặc hơn trong hộp nhà kho; phần xa tính giải tích ([35930](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:35930)).
4. Upsample bilateral rồi ghép AO và sương vào cảnh ([36001](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36001)).
5. Motion blur của camera bằng reprojection theo depth.
6. Bloom 6 tầng với Karis average ở tầng đầu, thêm vệt anamorphic.
7. Auto exposure, có kiểm tra mặt trời bị che để điều khiển flare.
8. Pass màu: chromatic aberration, lens dirt, flare, tonemap ACES kéo về AgX, split-tone, vignette, hiệu ứng bị thương.
9. FXAA, sharpen, film grain, dither ([36254](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:36254)).

### Quality và độ phân giải động

| Preset | Scale | MSAA | Shadow | Texture | Bước volumetric | Planar | Motion blur | Mưa |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| low | 0.7 | 0 | 2048 | 512 | 12 | tắt | tắt | 0.5 |
| medium | 0.85 | 2 | 2048 | 1024 | 16 | 0.5 | tắt | 0.8 |
| high | 1 | 4 | 4096 | 1024 | 24 | 0.5 | bật | 1 |
| ultra | 1 | 4 | 4096 | 2048 | 40 | 1 | bật | 1 |

Nguồn: [34913](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:34913). Preset low còn tắt AO. Chọn tự động: thiết bị di động dùng low; GPU phần mềm, Mali, Adreno, PowerVR hoặc Intel không phải Arc dùng medium; còn lại high ([34980](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:34980)). Khi chạy, scale độ phân giải dao động 0.6–1.0 theo frame time và tự hạ preset nếu chạm sàn hai lần ([37102](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:37102)).

## 4. Mặt đất, nước, mưa

### Dữ liệu mặt đất sinh trên CPU

- **Mask 80×80 m** ([54209](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54209)): R là cao độ nền với 26 hố vũng đặt tay và vệt lún bánh xe, G là độ ẩm, B là dầu, A là độ mòn theo làn xe.
- **Detail tileable** ([54256](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54256)): grain, loang, vết nứt bằng ridged fbm; kèm hai slope map trong một texture.
- **Sơn kẻ vạch:** Canvas2D theo đơn vị mét ([54310](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54310)).
- Cùng mảng `Uint8Array` của mask trả lời `isPuddle` và `wetnessAt` cho gameplay ([55451](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55451)).

### Shader mặt đất ướt

Chèn vào `MeshStandardMaterial` qua `onBeforeCompile`. Mọi trạng thái ướt suy ra từ một giá trị độ sâu ([54664](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54664)):

```glsl
float depth  = 0.5 - mk.r + (sn - 0.5) * 0.11 + ... + groove * 0.04 + crack * 0.02 - paint * 0.01;
float puddle = smoothstep(0.0, 0.035, depth) * uWetG;   // mặt gương
float soak   = smoothstep(-bandW, 0.0, depth) * uWetG;  // dải ngấm 10–30 cm
float fringe = smoothstep(-0.65, -0.02, depth);         // quầng ẩm khoảng 1 m
```

- Albedo tối dần theo ẩm, ngấm và độ sâu vũng.
- Roughness đi từ 0.74 (khô) qua 0.42 (ẩm), 0.2 (ngấm) xuống 0.055 (nước đọng).
- Normal phẳng lại trong vũng.
- Gợn mưa: mỗi ô lưới mỗi chu kỳ sinh một giọt, ba lớp ô khác kích thước; ngoài 10–34 m thay bằng cộng roughness ([54576](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54576)).
- Khe co giãn vẽ bằng SDF, khử răng cưa bằng `fwidth`.
- Vệt dầu chỉ làm tối và bóng hơn; không có hiệu ứng óng ánh.

### Phản chiếu phẳng

- Camera gương qua y=0 với oblique near plane ([54814](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54814)).
- Target HalfFloat có mipmap; kích thước bằng hệ số `planar` của quality nhân độ phân giải.
- Độ nhoè lấy từ mip chain theo roughness; UV méo theo normal.
- Kết quả ghi đè biến `radiance` của IBL ([54734](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:54734)), nên phần còn lại vẫn là BRDF chuẩn.
- Biển, mưa, splash và súng bị ẩn khi render phản chiếu.

### Biển

Lưới tự dựng, dày ở gần và thưa dần ra xa ([55020](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55020)). Vertex shader dùng 4 sóng Gerstner; fragment dùng slope giải tích của 4 sóng đó cộng 7 sóng mịn. Bọt tính theo khoảng cách tới tường cảng và SDF thân tàu. Công thức sóng có bản CPU để thuyền dập dềnh khớp mặt nước.

### Mưa

Khoảng 9000 quad instanced nhân hệ số quality, không có state trên CPU ([55271](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55271)). Vị trí tính trong vertex shader ([55180](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55180)):

```glsl
p = aSeed.xyz * uBox + vel * uTime;
p = mod(p - cameraPosition + 0.5 * uBox, uBox) - 0.5 * uBox + cameraPosition;
```

- Bề rộng tối thiểu theo pixel, bù lại bằng alpha.
- Hạt bị loại trong các AABB nội thất, trừ đúng các ô mái thủng mà level xuất ra.
- Splash đọc mask vũng nước ngay trong vertex shader để dồn về chỗ có nước.

## 5. VFX chiến đấu

Toàn bộ FX gói trong 5 draw call: decal, debris, vỏ đạn, hạt lit, hạt additive ([59004](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:59004)).

- **Atlas sinh bằng code:**
  - Khói: RG là normal, B là độ dày, A là mật độ ([55588](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55588)).
  - Additive: glow, streak, sao nòng, ring, lửa, giọt cho tracer ([55684](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55684)).
  - Decal vết đạn: ba canvas màu, ORM và height đổi sang normal ([55789](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:55789)).
- **Pool hạt:** hai pool struct-of-arrays, 1400 hạt lit có sort và 3040 hạt additive không sort ([57481](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:57481)). Mô phỏng trên CPU: drag, gravity, turbulence, va sàn.
- **Dựng quad ở vertex shader** theo 3 kiểu: billboard, kéo theo vận tốc, nằm theo bề mặt ([56242](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:56242)).
- **Khói:** soft particle đọc depth; chiếu sáng bằng normal cầu ảo cộng normal atlas, wrap diffuse, forward scatter; độ thấy mặt trời lấy từ một raycast cho mỗi hiệu ứng ([57497](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:57497)).
- **Tracer:** 48 slot, mỗi tracer 3 quad additive có giới hạn bề rộng theo pixel.
- **Debris:** InstancedMesh 256 hộp méo.
- **Vỏ đạn:** InstancedMesh 60 từ `LatheGeometry`, tích phân quaternion, nảy tối đa 4 lần và phát sự kiện cho audio.
- **Vết đạn:** 160 quad xoay vòng, căn theo normal, không chiếu.
- **Ngân sách:** cố định, không scale theo quality; chỉ có LOD ở 55 m.

## 6. Súng, tay, kẻ địch

### Súng và tay

- **Súng:** vài trăm primitive gom vào 7 bucket, gồm 4 tĩnh và bolt, băng đạn, viên đạn ([65547](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:65547)). Thân dùng profile extrude có lỗ; nòng và ống giảm thanh dùng lathe; ray picatinny là vòng lặp 49 răng.
- **Tay:** loft theo vòng đỉnh, không skin. Khớp ngón dùng vòng slerp và cắt theo mặt phân giác để các đốt không xuyên nhau ([65713](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:65713)). Ngón bóp cò nội suy giữa hai pose bake sẵn.
- **Kính ngắm:** reticle tính theo góc lệch khỏi trục nòng chứ không theo UV, nên không có parallax ([66484](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:66484)).
- **Chớp nòng:** 8 quad, cánh sao sinh thủ tục trong fragment shader, seed đổi mỗi phát ([66570](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:66570)).

### Chuyển động súng

9 lò xo giảm chấn, kích bằng xung vận tốc ([67099](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67099)). Bộ tích phân chia bước 8 ms khi frame dài ([66772](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:66772)):

```js
function ma(s, target, dt) {
  let n = dt > 0.012 ? Math.ceil(dt / 0.008) : 1, h = dt / n;
  for (let o = 0; o < n; o++) { s.v += ((target - s.x) * s.k - s.v * s.c) * h; s.x += s.v * h; }
  return s.x;
}
```

Reload là keyframe viết tay cho tay trái, nội suy smootherstep; sự kiện tháo băng, lắp băng, lên đạn bắn theo ngưỡng thời gian ([67016](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67016)).

### Rig và animation kẻ địch

- **Rig bằng code:** khai báo bone theo tên và bone cha; mỗi mảnh hình học gán cứng vào một bone với weight 1, kèm AO theo `normal.y` ([67681](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67681)).
- **Instance:** geometry dựng một lần; mỗi con có `SkinnedMesh` và `Skeleton` riêng dùng chung geometry ([67741](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67741)).
- **Không có AnimationMixer hay clip:** controller đặt thẳng rotation, position, scale của bone mỗi frame. Bật tắt chi tiết bằng cách scale bone về gần 0.
- **Hound:** IK chân giải tích 3 bậc tự do ([67807](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:67807)); nhấc cặp chân chéo khi sai số giữa chân đang đặt và vị trí dự đoán vượt ngưỡng ([70021](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:70021)); thân nghiêng theo độ cao bốn chân qua lò xo.
- **Gull:** bay bằng điều khiển PD, nghiêng thân theo gia tốc lệnh; đĩa mờ rotor là một ring tĩnh.
- **Hit test giải tích:** sphere, capsule, ellipsoid; không raycast vào mesh.

## 7. Âm thanh

- **Thư viện DSP:** khoảng 20 primitive trên `Float32Array`: noise trắng, biquad RBJ, biquad biến thiên theo thời gian, envelope mũ, modal synthesis ([59337](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:59337)), chirp, grain, tanh.
- **Công thức:** mỗi âm là các lớp cộng lại. Tiếng súng gồm crack, thump, body và tiếng cơ khí ([59397](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:59397)); đuôi vang ngoài trời và trong nhà bake sẵn thành hai buffer stereo.
- **Seed cố định:** hash của tên âm cộng chỉ số biến thể, nên buffer giống nhau mỗi phiên. Lúc phát có round-robin và lệch pitch ngẫu nhiên.
- **Loop liền mạch:** crossfade đuôi vào đầu, làm tròn tần số theo độ dài loop, chạy trước một pass để khởi tạo state bộ lọc.
- **Reverb:** impulse response cũng tổng hợp bằng code, cho hai `ConvolverNode` crossfade theo vùng trong nhà ([61220](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:61220)).
- **Nhạc:** 5 stem phát đồng bộ, chỉ đổi gain theo cường độ giao chiến ([62324](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:62324)).
- **Lịch sinh:** 19 buffer lúc boot, phần còn lại chia lát 6 ms bằng generator, không dùng Worker ([61948](/Users/meow/rea/saltline-reverse/evidence/game.pretty.js:61948)).
- **Master:** compressor rồi soft-clip tanh; pool 45 voice có ưu tiên và cướp voice.

## 8. Giới hạn

- Đây là đọc mã tĩnh; chưa chạy lại game hay các showcase.
- Phần vật liệu, decal, bầu trời, bóng, hậu kỳ và renderer được đọc trực tiếp.
- Props, level, mặt đất + FX, súng + kẻ địch và audio do 6 agent đọc song song; có đối chiếu lại code ở một số điểm trong mỗi phần, không phải mọi dòng.
- Chưa đếm số tam giác từng asset.
- Fresnel của vũng nước và biển đi qua BRDF chuẩn của Three.js là suy luận từ cấu trúc shader, chưa đối chiếu chunk r180.

## Phụ lục: bảng alias class Three.js

Suy ra từ chuỗi `this.type = "..."` và cờ `isX` trong phần Three.js của bundle (trước dòng 34850).

| Nhóm | Alias |
| --- | --- |
| Đối tượng | `Qe` Mesh, `wt` Group, `on` Object3D, `ir` Scene, `ka` SkinnedMesh, `Fa` Bone, `k0` Skeleton, `Sr` InstancedMesh |
| Geometry | `nt` BufferGeometry, `et` BufferAttribute, `He` Float32BufferAttribute, `un` Box, `rn` Plane, `ls` Sphere, `Ys` Cylinder, `Ua` Cone, `U0` Capsule, `Ci` Torus, `Na` Octahedron, `O0` Ring, `ar` Lathe, `rr` Extrude, `Kr` Tube, `H0` ShapeGeometry, `ea` InstancedBufferGeometry, `zs` InstancedBufferAttribute |
| Đường cong | `ji` Shape, `or` Path, `Jr` CatmullRomCurve3 |
| Material | `Qt` MeshStandardMaterial, `Nn` MeshBasicMaterial, `zn` ShaderMaterial, `V0` RawShaderMaterial |
| Texture và target | `xs` CanvasTexture, `ui` DataTexture, `Tr` DepthTexture, `si` WebGLRenderTarget, `D0` WebGLCubeRenderTarget |
| Đèn và camera | `W0` DirectionalLight, `Qr` PointLight, `Wn` PerspectiveCamera, `cr` OrthographicCamera, `z0` CubeCamera |
| Toán | `W` Vector3, `Ae` Vector2, `Dt` Vector4, `Ye` Matrix4, `Lt` Quaternion, `In` Euler, `$n` Box3, `Ve` Color |
| Tiện ích | `sa` mergeGeometries, `Ii` merge có chuẩn hoá attribute, `By` static batching |
