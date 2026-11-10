// Tham số luật cho tính lương — DỮ LIỆU, có hiệu lực theo ngày. Luật đổi thì THÊM một bản mới ở đầu mảng,
// không sửa bản cũ (kỳ lương cũ vẫn phải tính lại ra đúng số cũ).
// `chac: false` = em tổng hợp từ web, CHƯA được kế toán xác nhận — giao diện hiện cảnh báo bên cạnh.

export const LUAT = [
  {
    tu: "2026-01-01",
    nguon: "Luật BHXH 2024 · NQ 110/2025/UBTVQH15 (giảm trừ gia cảnh) · Luật TNCN sửa đổi 2025 (biểu 5 bậc)",
    chac: false,
    // Bảo hiểm bắt buộc — tỉ lệ trên lương đóng BH
    nld: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },             // 10,5%
    cty: { bhxh: 0.175, bhyt: 0.03, bhtn: 0.01 },             // 21,5% (BHXH 17% + TNLĐ-BNN 0,5%)
    kpcd: 0.02,                                               // kinh phí công đoàn, công ty chịu
    tran_bh: 46_800_000,                                      // 20 × lương cơ sở 2.340.000
    // Thuế TNCN
    giam_tru_ban_than: 15_500_000,
    giam_tru_phu_thuoc: 6_200_000,
    bac_thue: [[10_000_000, 0.05], [30_000_000, 0.10], [60_000_000, 0.20], [100_000_000, 0.30], [Infinity, 0.35]],
    nguong_khau_tru: 5_000_000,                               // trả cho người không ký HĐLĐ ≥ 3 tháng, mỗi lần
    ty_le_khau_tru: 0.10,
    ty_le_khong_cu_tru: 0.20,
    // Làm thêm giờ — mức TỐI THIỂU theo Bộ luật Lao động 2019 Điều 98
    lam_them_toi_thieu: { thuong: 1.5, nghi_tuan: 2, le: 3 },
    gio_chuan_ngay: 8,
  },
  {
    tu: "2020-07-01",
    nguon: "Luật TNCN 2007 sửa đổi 2012/2014 · NQ 954/2020",
    chac: true,
    nld: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
    cty: { bhxh: 0.175, bhyt: 0.03, bhtn: 0.01 },
    kpcd: 0.02,
    tran_bh: 46_800_000,
    giam_tru_ban_than: 11_000_000,
    giam_tru_phu_thuoc: 4_400_000,
    bac_thue: [[5e6, 0.05], [10e6, 0.10], [18e6, 0.15], [32e6, 0.20], [52e6, 0.25], [80e6, 0.30], [Infinity, 0.35]],
    nguong_khau_tru: 2_000_000,
    ty_le_khau_tru: 0.10,
    ty_le_khong_cu_tru: 0.20,
    lam_them_toi_thieu: { thuong: 1.5, nghi_tuan: 2, le: 3 },
    gio_chuan_ngay: 8,
  },
];

export const luatCho = (thang) => LUAT.find((l) => `${thang}-01` >= l.tu) || LUAT[LUAT.length - 1];

// Kiểu thuê dựng sẵn cho công ty mới. cach_tinh: thang | gio | khoan. thue: luy_tien | khau_tru | khong_cu_tru | khong.
export const KIEU_THUE_MAU = [
  { ten: "Hành chính / quản lý (HĐLĐ)", cach_tinh: "thang", dong_bh: 1, thue: "luy_tien" },
  { ten: "Giáo viên cơ hữu (HĐLĐ)", cach_tinh: "gio", dong_bh: 1, thue: "luy_tien" },
  { ten: "Giáo viên bán thời gian (HĐLĐ)", cach_tinh: "gio", dong_bh: 1, thue: "luy_tien" },
  { ten: "Giáo viên thỉnh giảng / CTV", cach_tinh: "gio", dong_bh: 0, thue: "khau_tru" },
  { ten: "Giáo viên nước ngoài — cư trú", cach_tinh: "gio", dong_bh: 1, thue: "luy_tien" },
  { ten: "Giáo viên nước ngoài — không cư trú", cach_tinh: "gio", dong_bh: 0, thue: "khong_cu_tru" },
  { ten: "Trợ giảng / sinh viên", cach_tinh: "gio", dong_bh: 0, thue: "khau_tru" },
  { ten: "Thuê qua đơn vị khác (có hoá đơn)", cach_tinh: "khoan", dong_bh: 0, thue: "khong" },
];
export const BAC_GV_MAU = [
  { ten: "GV Việt Nam — mới", don_gia: 150_000 },
  { ten: "GV Việt Nam — IELTS 7.0+ / 3 năm", don_gia: 250_000 },
  { ten: "GV nước ngoài", don_gia: 450_000 },
  { ten: "GV bản ngữ có CELTA/TESOL", don_gia: 600_000 },
  { ten: "Trợ giảng", don_gia: 80_000 },
];
export const HE_SO_MAU = [
  { nhom: "hinh_thuc", ma: "offline", ten: "Offline", gia_tri: 1 },
  { nhom: "hinh_thuc", ma: "online", ten: "Online", gia_tri: 0.9 },
  { nhom: "khung_gio", ten: "Buổi tối (từ 18:00)", gia_tri: 1.2, gio_tu: "18:00", gio_den: "23:59", thu: "1,2,3,4,5" },
  { nhom: "khung_gio", ten: "Cuối tuần", gia_tri: 1.3, gio_tu: "00:00", gio_den: "23:59", thu: "6,0" },
  { nhom: "loai_lop", ten: "Thiếu nhi", gia_tri: 1 },
  { nhom: "loai_lop", ten: "Giao tiếp", gia_tri: 1 },
  { nhom: "loai_lop", ten: "Luyện thi IELTS", gia_tri: 1.2 },
  { nhom: "loai_lop", ten: "Kèm 1:1", gia_tri: 1.5 },
];
export const HE_SO_LAM_THEM = [1, 1.5, 2, 3];
export const LOAI_NGAY = ["thuong", "nghi_tuan", "le"];
