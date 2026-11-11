# Phát hành Saltline tại meowsolo.com/gameaaa

[MEOW] Gói tĩnh nằm trong `saltline-gameaaa/`. Thư mục `gameaaa/` chứa `index.html`, `game.js` và `styles.css` của Saltline gốc. Cả ba file khớp SHA-256 trong manifest phục hồi. Cấu hình Vercel dùng `/gameaaa/` làm đường dẫn chuẩn để các URL tương đối tải đúng.

## Production ngày 11/11/2026

- Địa chỉ chơi [meowsolo.com/gameaaa](https://meowsolo.com/gameaaa) chuyển tới [www.meowsolo.com/gameaaa/](https://www.meowsolo.com/gameaaa/).
- Project game `saltline-gameaaa`, deployment `dpl_FuEKgoXFNX99Jq3mvh1avreswSQK`, trạng thái `READY`. Origin là `https://saltline-gameaaa.vercel.app/gameaaa/`.
- Tên miền thuộc project `ai-builder-landing` trong scope `danielnguyen0428-9389s-projects`. Route `914ecdf6-f278-4859-a604-89aa03dae1ed` chuyển `^/gameaaa(/.*)?$` tới `https://saltline-gameaaa.vercel.app/gameaaa$1`.
- Phiên bản route đã công bố là `3942e01c-2b3b-4964-8e70-07d1b65a2dcd`. Diff có một route mới và 12 route giữ nguyên.
- Cả ba file qua tên miền công khai trả HTTP 200 và khớp SHA-256 với manifest. Trang chủ và `/cafe/` khớp mã băm trước/sau. Xem `live-verification.json`.
- Chrome trên URL công khai tải đủ file, bấm Deploy vào intro và bắn được sau khi bỏ intro trong bài thử. Âm thanh được tắt khi kiểm tra. Xem `live-browser.json`.
- Lần phát hành đầu trả HTTP 402 vì team vượt giới hạn sử dụng. Lần thử lại hoàn tất sau khi trang chủ và `/cafe/` phục hồi HTTP 200.

## Kiểm chứng gói cục bộ

- `node --check` đạt. Ba file tải dưới `/gameaaa/` trả HTTP 200 với kiểu nội dung phù hợp.
- Chrome headless khởi động Three.js r180. Bấm Deploy chuyển sang intro. Lượt đầu hết thời gian chờ intro. Lượt kiểm tra tiếp theo dùng `skipIntro` và tắt âm thanh, vào được trạng thái `playing`, bắn bằng Enter và giảm đạn từ 30 xuống 28. Không ghi nhận lỗi JavaScript của trang trong lượt đạt.

## Cập nhật bản phát hành

1. Đặt ba file cần phát hành vào `saltline-gameaaa/gameaaa/`.
2. Chạy `vercel deploy --prod --yes --scope danielnguyen0428-9389s-projects` trong thư mục `saltline-gameaaa/` đã liên kết đúng project.
3. Kiểm tra lại URL công khai, hash file và khả năng vào game. Route hiện tại trỏ tới alias production của project game.

Để gỡ đường dẫn, vô hiệu hóa riêng route `914ecdf6-f278-4859-a604-89aa03dae1ed` trên `ai-builder-landing` và xác minh diff trước khi publish.
