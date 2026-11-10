# TRENTAY Chấm Công & Tính Lương

App web chấm công bằng điện thoại và tính lương cho trung tâm, công ty thuê nhiều kiểu người: hành chính lương tháng, giáo viên lương giờ,
giáo viên nước ngoài, thỉnh giảng, trợ giảng. Ra bảng lương 2 đợt (đợt 1 = bảng BHXH), phiếu lương, file Excel, và đẩy bảng công + bảng lương
sang Lark Base. Tiếng Việt / English. Cài lên màn hình chính điện thoại được, không cần kho ứng dụng.

App chạy trên tài khoản Cloudflare **của bạn**: dữ liệu nằm trong CSDL của bạn, không qua máy chủ nào khác. Gói miễn phí đủ cho vài chục người.

## Cài lần đầu (khoảng 10 phút)

**1. Tạo tài khoản Cloudflare** (miễn phí) tại https://dash.cloudflare.com/sign-up.

**2. Lấy Account ID:** trang chủ Cloudflare → bấm vào tài khoản → cột phải có **Account ID** → chép lại.

**3. Tạo API Token:** góc phải trên → **My Profile → API Tokens → Create Token → Create Custom Token**:
- Token name: `cham-cong`
- Permissions (bấm «+ Add more» để thêm dòng):
  - Account · **Cloudflare Pages** · Edit
  - Account · **D1** · Edit
- Account Resources: Include · tài khoản của bạn
- **Continue to summary → Create Token** → chép token (chỉ hiện một lần).

**4. Dán vào kho GitHub này:** **Settings → Secrets and variables → Actions → New repository secret**, tạo 2 secret:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token ở bước 3 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID ở bước 2 |

**5. Bấm cài:** tab **Actions** → (lần đầu bấm «I understand… enable») → **Cài đặt / Cập nhật** → **Run workflow**.
Ô «Tên app» để trống thì app có địa chỉ `cham-cong-<tên-github-của-bạn>.pages.dev`; muốn tên khác thì gõ vào (chữ thường, số, gạch nối).
Chạy khoảng 1–2 phút. Xong, mở lượt chạy đó → phần **Summary** có link app.

**6. Mở link app → «Chủ doanh nghiệp chưa có tài khoản? Đăng ký»** để tạo tài khoản quản trị. Từ đây làm theo tài liệu hướng dẫn sử dụng.

## Cập nhật khi có bản mới

Trên trang kho: **Sync fork → Update branch** (nếu kho của bạn là bản fork), rồi chạy lại **Actions → Cài đặt / Cập nhật**.
Dữ liệu giữ nguyên; lượt chạy chỉ thêm bảng/cột mới (thư mục `di-tru/`) chưa có.

## Dùng hằng ngày (tóm tắt)

- **Quản trị:** mở link app → đăng nhập bằng email. Tab **Quản lý**: Nhân viên (thêm người → gửi link mời qua Zalo), Địa điểm & màn QR,
  Ca làm, Thiết lập lương, Buổi dạy, Làm thêm giờ, Bảng lương, Nối Lark.
- **Nhân viên:** mở link mời → đặt mật khẩu → tab **Chấm công**; giáo viên có thêm tab **Dạy** (bắt đầu/kết thúc buổi, kiểm vị trí theo cơ sở của buổi).
- **Nối Lark:** Quản lý → 🔗 Nối chấm công & bảng lương sang Lark → App ID + App Secret của app Lark tự dựng (quyền `bitable:app`, đã thêm vào Base) + link Base.

## Lưu ý

- Tham số thuế/BH năm 2026 trong `lib/luat-luong.js` cần kế toán của bạn xác nhận trước khi trả lương thật — app hiện cảnh báo trên bảng lương.
- Trên vài trăm nhân viên nên nâng Cloudflare Workers lên gói trả phí (từ 5 USD/tháng).
- Không đưa khoá bí mật (token, App Secret) vào mã nguồn; chỉ để ở Secrets của kho hoặc nhập trong app.

## Chạy thử trên máy (cho người phát triển)

```
npx wrangler d1 execute trentay-cham-cong --local --file schema.sql
npx wrangler pages dev --port 8811 --binding CC_THU=1
node scripts/gieo-trung-tam.mjs          # dữ liệu mẫu một trung tâm tiếng Anh
node kiem-tra-tinh-luong.mjs             # tự kiểm lõi tính lương
```
