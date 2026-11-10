// Tự kiểm lõi tính công (hàm thuần, không cần máy chủ):  node kiem-tra-tinh-cong.mjs
import { tinhNgay, tinhKy, ganNgay, khungCa, ngayTrongThang, dauNgay, PHUT } from "./lib/tinh-cong.js";

let dat = 0, truot = 0;
const kiem = (ten, dk, them = "") => { dk ? dat++ : truot++; console.log(`${dk ? "✔" : "✖"} ${ten}${dk ? "" : "  " + JSON.stringify(them)}`); };
const luc = (ngay, gio) => dauNgay(ngay) + (Number(gio.slice(0, 2)) * 60 + Number(gio.slice(3))) * PHUT;
const b = (loai, ngay, gio, canh_bao = "") => ({ loai, luc: luc(ngay, gio), canh_bao });

const HC = { gio_vao: "08:00", gio_ra: "17:00", nghi_phut: 60, cho_muon_phut: 5, ngay_lam: "1,2,3,4,5,6" };
const DEM = { gio_vao: "22:00", gio_ra: "06:00", nghi_phut: 30, cho_muon_phut: 5, ngay_lam: "0,1,2,3,4,5,6" };
const SAU = Date.parse("2027-01-01");   // "bây giờ" ở tương lai: mọi ngày thử đã hết

// 2026-11-02 là thứ Hai.
let r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "07:55"), b("ra", "2026-11-02", "17:02")], bayGio: SAU });
kiem("Đủ giờ: 1 công, không muộn, ở lại 2 phút", r.cong === 1 && r.trang_thai === "du" && r.muon_phut === 0 && r.o_lai_phut === 2, r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "08:04"), b("ra", "2026-11-02", "17:00")], bayGio: SAU });
kiem("Muộn 4 phút trong ngưỡng 5 phút: không tính muộn", r.muon_phut === 0 && r.trang_thai === "du", r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "08:20"), b("ra", "2026-11-02", "17:00")], bayGio: SAU });
kiem("Muộn 20 phút: tính đủ 20 phút từ đầu ca, công < 1", r.muon_phut === 20 && r.trang_thai === "muon" && r.cong < 1 && r.cong > 0.95, r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "08:00"), b("ra", "2026-11-02", "12:00")], bayGio: SAU });
kiem("Làm nửa buổi sáng (4 giờ, không trừ nghỉ trưa): 0,5 công, về sớm 300 phút", r.cong === 0.5 && r.som_phut === 300, r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "08:00")], bayGio: SAU });
kiem("Có vào không có ra, ngày đã qua: thiếu giờ ra, 0 công", r.trang_thai === "thieu_ra" && r.cong === 0, r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "08:00")], bayGio: luc("2026-11-02", "10:00") });
kiem("Có vào, đang trong ca: đang làm", r.trang_thai === "dang_lam", r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [], bayGio: SAU });
kiem("Ngày có ca, không chấm: vắng", r.trang_thai === "vang", r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [], bayGio: luc("2026-11-02", "07:00") });
kiem("Trước giờ ca: chưa đến", r.trang_thai === "chua_den", r);
r = tinhNgay({ ca: HC, ngay: "2026-11-08", ban: [], bayGio: SAU });
kiem("Chủ nhật không có ca: nghỉ, không tính vắng", r.trang_thai === "nghi" && !r.co_ca, r);
r = tinhNgay({ ca: HC, ngay: "2026-11-08", ban: [b("vao", "2026-11-08", "09:00"), b("ra", "2026-11-08", "12:00")], bayGio: SAU });
kiem("Làm Chủ nhật: ghi giờ (180 phút), chưa cộng công", r.trang_thai === "ngoai_ca" && r.lam_phut === 180 && r.cong === 0, r);

// Đơn
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "08:00")], don: [{ loai: "quen_cham", gio_ra: "17:00" }], bayGio: SAU });
kiem("Quên chấm ra + đơn duyệt: đủ công, đánh dấu sửa bằng đơn", r.cong === 1 && r.sua_bang_don, r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", ban: [b("vao", "2026-11-02", "07:58"), b("ra", "2026-11-02", "17:00")],
  don: [{ loai: "quen_cham", gio_vao: "06:00" }], bayGio: SAU });
kiem("Đơn quên chấm KHÔNG đè giờ đã chấm thật", r.vao === luc("2026-11-02", "07:58") && !r.sua_bang_don, r);
r = tinhNgay({ ca: HC, ngay: "2026-11-02", don: [{ loai: "nghi_phep" }], bayGio: SAU });
kiem("Nghỉ phép duyệt: 1 công phép, không vắng", r.cong_phep === 1 && r.trang_thai === "nghi_phep", r);

// Ca qua đêm
const ban = [b("vao", "2026-11-02", "21:58"), b("ra", "2026-11-03", "06:03"), b("vao", "2026-11-03", "22:10"), b("ra", "2026-11-04", "06:00")];
const nhom = ganNgay(DEM, ban);
kiem("Ca đêm: giờ ra rạng sáng thuộc về ngày bắt đầu ca", nhom.get("2026-11-02")?.length === 2 && nhom.get("2026-11-03")?.length === 2, [...nhom.keys()]);
const ky = tinhKy({ ca: DEM, ngays: ["2026-11-02", "2026-11-03"], ban, don: [], bayGio: SAU });
kiem("Ca đêm: hai ngày đều 1 công / muộn 10 phút", ky.ngay[0].cong === 1 && ky.ngay[1].muon_phut === 10, ky.ngay);
kiem("Khung ca đêm dài 8 giờ", (() => { const k = khungCa(DEM, "2026-11-02"); return k.ra - k.vao === 8 * 60 * PHUT; })());

// Tháng
kiem("Tháng 2/2028 có 29 ngày, tháng 11/2026 có 30", ngayTrongThang("2028-02").length === 29 && ngayTrongThang("2026-11").length === 30);
const ngays = ngayTrongThang("2026-11");
const banThang = [];
for (const n of ngays) if (new Date(n + "T00:00:00Z").getUTCDay() !== 0 && n <= "2026-11-10")
  banThang.push(b("vao", n, n === "2026-11-03" ? "08:30" : "07:55"), b("ra", n, "17:00"));
const kyT = tinhKy({ ca: HC, ngays, ban: banThang, don: [{ loai: "nghi_phep", ngay: "2026-11-11", den_ngay: "2026-11-12", trang_thai: "duyet" }], bayGio: SAU });
kiem("Tháng 11/2026 (1/11 là Chủ nhật): 25 ngày có ca", kyT.tong.ngay_ca === 25, kyT.tong);
kiem("8 ngày đi làm, 1 lần muộn 30 phút", kyT.tong.lan_muon === 1 && kyT.tong.muon_phut === 30 && kyT.tong.cong > 7.9 && kyT.tong.cong < 8, kyT.tong);
kiem("2 ngày phép, 15 ngày vắng còn lại", kyT.tong.cong_phep === 2 && kyT.tong.vang === 15, kyT.tong);

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
