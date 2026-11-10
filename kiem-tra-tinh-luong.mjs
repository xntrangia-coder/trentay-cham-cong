// Tự kiểm lõi tính lương (hàm thuần): node kiem-tra-tinh-luong.mjs
import { tinhLuongNv, heSoBuoi, soGioBuoi, congTinhLuong } from "./lib/tinh-luong.js";
import { HE_SO_MAU } from "./lib/luat-luong.js";
let dat = 0, truot = 0;
const kiem = (ten, dk, them = "") => { dk ? dat++ : truot++; console.log(`${dk ? "✔" : "✖"} ${ten}${dk ? "" : "  " + JSON.stringify(them)}`); };
const bang = HE_SO_MAU.map((x, i) => ({ ...x, id: "hs" + i }));
const ngay26 = Array.from({ length: 26 }, () => ({ cong: 1, cong_phep: 0 }));
const HC = { id: "a", ten_vai: "Hành chính", cach_tinh: "thang", dong_bh: 1, thue: "luy_tien", luong_thang: 12_000_000, luong_bh: 12_000_000,
  pc_dt: 1_200_000, pc_xang: 800_000, pc_nha: 0, pc_khac: 0 };

let r = tinhLuongNv({ thang: "2026-11", cvs: [HC], ngayCong: ngay26 });
kiem("Đủ 26 công = đủ lương tháng", r.dong[0].co_ban === 12_000_000, r.dong[0]);
kiem("BH người lao động 10,5% = 1.260.000", r.bh_nld.cong === 1_260_000, r.bh_nld);
kiem("BH công ty 21,5% = 2.580.000", r.bh_cty.cong === 2_580_000, r.bh_cty);
kiem("Tổng thu nhập = lương + phụ cấp", r.tong_thu_nhap === 14_000_000, r.tong_thu_nhap);
kiem("Dưới giảm trừ 15,5tr thì không có thuế", r.thue === 0, r);
kiem("Thực lĩnh = tổng − BH", r.thuc_linh === 12_740_000, r.thuc_linh);

r = tinhLuongNv({ thang: "2026-11", cvs: [HC], ngayCong: [...Array(20).fill({ cong: 1 }), { cong: 0.6 }, { cong: 0.4 }] });
kiem("Nửa ngày làm tròn xuống 0,5 công (20 + 0,5 + 0)", r.dong[0].cong === 20.5, r.dong[0]);

r = tinhLuongNv({ thang: "2026-11", cvs: [{ ...HC, luong_bh: 6_000_000 }], ngayCong: ngay26 });
kiem("Lương BH thấp hơn HĐ → cảnh báo", r.canh_bao.some((c) => c.ma === "bh-thap-hon-hd"), r.canh_bao);
kiem("Có đợt 2 khi lương BH thấp", r.dot2 === r.thuc_linh - r.dot1 && r.dot2 > 0, r);
kiem("Đợt 1 = lương BH + phụ cấp − BH − thuế", r.dot1 === 6_000_000 + 2_000_000 - 630_000 - r.thue, r);

r = tinhLuongNv({ thang: "2026-11", cvs: [{ ...HC, bh_cty_chiu_het: 1 }], ngayCong: ngay26 });
kiem("Công ty chịu hết: không trừ BH vào lương", r.bh_nld_tra === 0 && r.bh_cty_dong_thay === 1_260_000, r);
kiem("Công ty chịu hết: chi phí công ty cộng cả phần đóng thay", r.chi_phi_cty === 14_000_000 + 2_580_000 + 1_260_000 + 240_000, r.chi_phi_cty);

// Lũy tiến 2026: 40tr, không phụ thuộc → tính thuế = 40 - 4,2 - 15,5 = 20,3tr → 10tr×5% + 10,3tr×10% = 1.530.000
r = tinhLuongNv({ thang: "2026-11", cvs: [{ ...HC, luong_thang: 40_000_000, luong_bh: 40_000_000, pc_dt: 0, pc_xang: 0 }], ngayCong: ngay26 });
kiem("Thuế lũy tiến 5 bậc 2026", r.thue === 1_530_000, r);
r = tinhLuongNv({ thang: "2026-11", cvs: [{ ...HC, luong_thang: 40_000_000, luong_bh: 40_000_000, pc_dt: 0, pc_xang: 0 }], ngayCong: ngay26, soPhuThuoc: 1 });
kiem("Người phụ thuộc giảm 6,2tr", r.giam_tru === 21_700_000, r.giam_tru);

const buoi = (ngay, gio_bd, gio_kt, hinh_thuc = "offline", loai_lop_id = null) => ({ cv_id: "g", ngay, gio_bd, gio_kt, hinh_thuc, loai_lop_id, lop: "L1" });
kiem("Buổi 18:00–19:30 = 1,5 giờ", soGioBuoi(buoi("2026-11-10", "18:00", "19:30")) === 1.5);
kiem("Buổi tối thường (thứ 3) hệ số 1,2", heSoBuoi(buoi("2026-11-10", "18:00", "19:30"), bang).tong === 1.2);
kiem("Buổi tối thứ 7 lấy hệ số lớn nhất 1,3 (không nhân chồng)", heSoBuoi(buoi("2026-11-14", "18:00", "19:30"), bang).khung_gio === 1.3);
kiem("Online × 0,9 · IELTS × 1,2", heSoBuoi(buoi("2026-11-10", "09:00", "10:30", "online", "hs6"), bang).tong === 1.08);

const GV = { id: "g", ten_vai: "Dạy", cach_tinh: "gio", dong_bh: 0, thue: "khau_tru", don_gia: 250_000 };
r = tinhLuongNv({ thang: "2026-11", cvs: [GV], buoi: [buoi("2026-11-10", "09:00", "11:00"), buoi("2026-11-11", "09:00", "11:00")], bangHeSo: bang });
kiem("GV thỉnh giảng 4 giờ × 250k = 1tr, dưới ngưỡng không khấu trừ", r.tong_thu_nhap === 1_000_000 && r.thue === 0, r);
r = tinhLuongNv({ thang: "2026-11", cvs: [GV], buoi: Array.from({ length: 12 }, () => buoi("2026-11-10", "09:00", "11:00")), bangHeSo: bang });
kiem("GV thỉnh giảng 6tr ≥ ngưỡng 5tr → khấu trừ 10%", r.thue === 600_000, r);
r = tinhLuongNv({ thang: "2026-11", cvs: [{ ...GV, thue: "khong_cu_tru", don_gia: 500_000 }], buoi: [buoi("2026-11-10", "09:00", "11:00")], bangHeSo: bang });
kiem("GV nước ngoài không cư trú 20%", r.thue === 200_000, r);

// Kiêm nhiệm: hành chính HĐLĐ + dạy giờ → thuế lũy tiến trên TỔNG
r = tinhLuongNv({ thang: "2026-11", cvs: [HC, { ...GV, dong_bh: 0 }], ngayCong: ngay26, buoi: Array.from({ length: 10 }, () => buoi("2026-11-10", "09:00", "11:00")), bangHeSo: bang });
kiem("Kiêm nhiệm: thuế lũy tiến gộp cả tiền dạy", r.cach_thue === "luy_tien" && r.tong_thu_nhap === 19_000_000, r);

r = tinhLuongNv({ thang: "2026-11", cvs: [HC], ngayCong: ngay26, lamThem: [{ cv_id: "a", so_gio: 4, he_so: 1, loai_ngay: "thuong" }] });
kiem("Làm thêm hệ số 1 → cảnh báo thấp hơn luật", r.canh_bao.some((c) => c.ma === "lam-them-duoi-luat"), r.canh_bao);
kiem("Tiền làm thêm = giờ × hệ số × lương/26/8", r.lam_them === Math.round(4 * 1 * 12_000_000 / 26 / 8), r.lam_them);

r = tinhLuongNv({ thang: "2026-11", cvs: [{ ...HC, pc_mien_thue: 1 }], ngayCong: ngay26 });
kiem("Khoán điện thoại/xăng không chịu thuế", r.mien_thue === 2_000_000 && r.tn_chiu_thue === 12_000_000, r);

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
