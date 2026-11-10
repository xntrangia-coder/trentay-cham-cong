// Gieo một TRUNG TÂM TIẾNG ANH MẪU để xem thử phần tính lương: quản lý, hành chính kiêm dạy, giáo viên cơ hữu,
// GV nước ngoài cư trú / không cư trú, GV thỉnh giảng, trợ giảng; 3 cơ sở (có một trường đối tác dạy thuê);
// chấm công tháng trước + tháng này, buổi dạy, làm thêm giờ.
// CHỈ chạy với máy chủ thử (CC_THU=1):  node scripts/gieo-trung-tam.mjs [http://127.0.0.1:8811]
// In ra email + mật khẩu chủ để đăng nhập.
const GOC = process.argv[2] || "http://127.0.0.1:8811";
const MK = "demo12345";

class May {
  constructor() { this.cookie = ""; this.ma = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  async goi(duong, than) {
    const h = { cookie: this.cookie, "x-cc": "1" };
    if (than !== undefined) h["content-type"] = "application/json";
    const r = await fetch(GOC + "/api/" + duong, { method: than === undefined ? "GET" : "POST", headers: h, body: than === undefined ? undefined : JSON.stringify(than) });
    const sc = r.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0];
    const d = await r.json().catch(() => null);
    if (r.status !== 200) throw new Error(`${duong} → ${r.status} ${JSON.stringify(d)}`);
    return d;
  }
}
const GIO_VN = 7 * 3600e3;
const ms = (ngay, hhmm) => Date.parse(`${ngay}T${hhmm}:00Z`) - GIO_VN;
const congNgay = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const thu = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const homNay = new Date(Date.now() + GIO_VN).toISOString().slice(0, 10);
const thangNay = homNay.slice(0, 7);
const thangTruoc = congNgay(thangNay + "-01", -1).slice(0, 7);
const ngayCua = (thang) => { const ra = []; for (let d = thang + "-01"; d.startsWith(thang); d = congNgay(d, 1)) ra.push(d); return ra; };
const ngayDaQua = [...ngayCua(thangTruoc), ...ngayCua(thangNay).filter((d) => d < homNay)];

const chu = new May();
const email = `trungtam-${Date.now().toString(36)}@demo.vn`;
await chu.goi("dang-ky", { ten_dn: "Anh ngữ Mặt Trời (mẫu)", ten: "Nguyễn Ngọc Mai", email, mk: MK, dong_y_dieu_khoan: true, ngon_ngu: "vi" });
const toi = await chu.goi("toi");

// Cơ sở: hai cơ sở của trung tâm + một trường đối tác (giáo viên đi dạy thuê).
const dd0 = (await chu.goi("dia-diem")).ds[0];
await chu.goi(`dia-diem/${dd0.id}/sua`, { ten: "Cơ sở Quận 1", lat: 10.776889, lng: 106.700806, ban_kinh: 150 });
const cs2 = (await chu.goi("dia-diem", { ten: "Cơ sở Bình Thạnh", lat: 10.80167, lng: 106.71114, ban_kinh: 150 })).id;
const cs3 = (await chu.goi("dia-diem", { ten: "Trường TH Đối tác (dạy thuê)", lat: 10.84861, lng: 106.77222, ban_kinh: 200 })).id;
const cas = (await chu.goi("ca")).ds; const caHC = cas[0].id;

const tl = await chu.goi("luong/thiet-lap");
const kt = (ten) => tl.kieu_thue.find((k) => k.ten.startsWith(ten)).id;
const bac = (ten) => tl.bac_gv.find((b) => b.ten.startsWith(ten)).id;
const loaiLop = (ten) => tl.he_so.find((x) => x.nhom === "loai_lop" && x.ten.startsWith(ten)).id;

const SDT0 = 900000000 + Math.floor(Math.random() * 9e6) * 10; // mỗi lượt gieo một dải số riêng (SĐT là duy nhất toàn hệ)
let sdt = SDT0;
async function nv(ten, ma_nv, ca = null) {
  const r = await chu.goi("nv", { ten, ma_nv, sdt: "0" + (sdt++), ca_id: ca || "", dia_diem_id: dd0.id, che_do: "van_phong" });
  return { id: r.id, ma_moi: r.ma_moi, ten };
}
// Chủ (chị Mai) là quản lý trung tâm, lương tháng, lương BH thấp hơn HĐ → có đợt 2.
await chu.goi(`nv/${toi.id}/cong-viec`, { ten_vai: "Giám đốc trung tâm", kieu_thue_id: kt("Hành chính"), luong_thang: 25_000_000, luong_bh: 8_000_000,
  pc_dt: 1_000_000, pc_xang: 1_000_000, pc_mien_thue: true });
await chu.goi(`nv/${toi.id}/thue`, { so_phu_thuoc: 2 });

const lan = await nv("Trần Thị Lan", "HC01", caHC);
await chu.goi(`nv/${lan.id}/cong-viec`, { ten_vai: "Hành chính – tuyển sinh", kieu_thue_id: kt("Hành chính"), luong_thang: 9_000_000, luong_bh: 6_000_000,
  pc_dt: 300_000, pc_xang: 500_000, pc_mien_thue: true });
const cvLanDay = (await chu.goi(`nv/${lan.id}/cong-viec`, { ten_vai: "Dạy giao tiếp buổi tối", kieu_thue_id: kt("Giáo viên thỉnh giảng"), bac_gv_id: bac("GV Việt Nam — IELTS") })).id;
await chu.goi(`nv/${lan.id}/thue`, { so_phu_thuoc: 1 });

const minh = await nv("Lê Văn Minh", "GV01");
const cvMinh = (await chu.goi(`nv/${minh.id}/cong-viec`, { ten_vai: "Giáo viên IELTS", kieu_thue_id: kt("Giáo viên cơ hữu"), bac_gv_id: bac("GV Việt Nam — IELTS"),
  luong_bh: 5_000_000, bh_cty_chiu_het: true })).id;

const john = await nv("John Smith", "NN01");
const cvJohn = (await chu.goi(`nv/${john.id}/cong-viec`, { ten_vai: "Native teacher", kieu_thue_id: kt("Giáo viên nước ngoài — không cư trú"), bac_gv_id: bac("GV bản ngữ") })).id;
await chu.goi(`nv/${john.id}/thue`, { gpld_het: congNgay(homNay, 30) });

const sarah = await nv("Sarah Lee", "NN02");
const cvSarah = (await chu.goi(`nv/${sarah.id}/cong-viec`, { ten_vai: "Foreign teacher (resident)", kieu_thue_id: kt("Giáo viên nước ngoài — cư trú"),
  bac_gv_id: bac("GV nước ngoài"), luong_bh: 10_000_000 })).id;
await chu.goi(`nv/${sarah.id}/thue`, { gpld_het: congNgay(homNay, 400) });

const tuan = await nv("Phạm Quốc Tuấn", "TG01");
const cvTuan = (await chu.goi(`nv/${tuan.id}/cong-viec`, { ten_vai: "GV thỉnh giảng", kieu_thue_id: kt("Giáo viên thỉnh giảng"), don_gia_rieng: 300_000 })).id;

const vy = await nv("Đỗ Ngọc Vy", "TA01");
const cvVy = (await chu.goi(`nv/${vy.id}/cong-viec`, { ten_vai: "Trợ giảng", kieu_thue_id: kt("Trợ giảng"), bac_gv_id: bac("Trợ giảng") })).id;

// ---- Chấm công hành chính (chủ + Lan), T2–T7 ----
const lo = [];
for (const d of ngayDaQua) {
  if (thu(d) === 0) continue;
  for (const [ai, so] of [[toi.id, 0], [lan.id, 1]]) {
    const n = Number(d.slice(8)) + so;
    if (n % 13 === 5) continue;                                         // vắng
    const vao = n % 11 === 3 ? "08:25" : "07:5" + (n % 9);              // vài lần muộn
    const ra = n % 9 === 4 ? "12:00" : "17:0" + (n % 7);                // vài nửa ngày
    lo.push({ nv_id: ai, loai: "vao", luc: ms(d, vao) }, { nv_id: ai, loai: "ra", luc: ms(d, ra) });
  }
}
for (let i = 0; i < lo.length; i += 400) await chu.goi("thu/cham-lo", { ds: lo.slice(i, i + 400) });

// ---- Buổi dạy: lịch cố định mỗi tuần ----
const LICH = [
  { nv: minh.id, cv: cvMinh, thu: [1, 3, 5], bd: "18:00", kt: "20:00", lop: "IELTS 6.5 – K12", ll: loaiLop("Luyện thi"), dd: dd0.id },
  { nv: minh.id, cv: cvMinh, thu: [6], bd: "08:00", kt: "10:00", lop: "IELTS 5.5 – K14", ll: loaiLop("Luyện thi"), dd: cs2 },
  { nv: lan.id, cv: cvLanDay, thu: [2, 4], bd: "18:30", kt: "20:00", lop: "Giao tiếp người lớn", ll: loaiLop("Giao tiếp"), dd: dd0.id },
  { nv: john.id, cv: cvJohn, thu: [2, 4, 6], bd: "17:30", kt: "19:00", lop: "Kids Starters", ll: loaiLop("Thiếu nhi"), dd: cs2 },
  { nv: john.id, cv: cvJohn, thu: [3], bd: "14:00", kt: "15:30", lop: "Dạy thuê – lớp 4A", ll: loaiLop("Thiếu nhi"), dd: cs3 },
  { nv: sarah.id, cv: cvSarah, thu: [1, 3], bd: "19:00", kt: "20:30", lop: "Speaking Club", ll: loaiLop("Giao tiếp"), dd: dd0.id },
  { nv: sarah.id, cv: cvSarah, thu: [0], bd: "09:00", kt: "10:00", lop: "1:1 Online – chị Hằng", ll: loaiLop("Kèm 1:1"), online: true },
  { nv: tuan.id, cv: cvTuan, thu: [6, 0], bd: "14:00", kt: "16:00", lop: "IELTS Writing cuối tuần", ll: loaiLop("Luyện thi"), dd: cs2 },
  { nv: vy.id, cv: cvVy, thu: [2, 4, 6], bd: "17:30", kt: "19:00", lop: "Trợ giảng Kids", ll: loaiLop("Thiếu nhi"), dd: cs2 },
];
const tuongLai = Array.from({ length: 10 }, (_, i) => congNgay(homNay, i));
let soBuoi = 0;
for (const l of LICH) for (const d of [...ngayDaQua, ...tuongLai]) {
  if (!l.thu.includes(thu(d))) continue;
  const than = { nv_id: l.nv, cv_id: l.cv, lop: l.lop, loai_lop_id: l.ll, ngay: d, gio_bd: l.bd, gio_kt: l.kt,
    hinh_thuc: l.online ? "online" : "offline", dia_diem_id: l.dd || "" };
  if (d < homNay) {
    // Hai buổi tuần trước của Tuấn chưa xác nhận → hiện cảnh báo trên bảng lương.
    const chuaXN = l.nv === tuan.id && d >= congNgay(homNay, -7);
    await chu.goi("thu/buoi-xong", { ...than, trang_thai: chuaXN ? "ke_hoach" : "xong" });
  } else await chu.goi("buoi-day", than);
  soBuoi++;
}

// ---- Làm thêm giờ: Lan đăng ký (nhận lời mời trên "điện thoại" của Lan), chủ duyệt ----
const mayLan = new May();
await mayLan.goi("moi/" + lan.ma_moi, { mk: MK, dong_y: true, may: mayLan.ma });
const cvLan = (await mayLan.goi("luong/cua-toi")).cong_viec.find((c) => c.cach_tinh === "thang").id;
await mayLan.goi("lam-them", { cv_id: cvLan, ngay: congNgay(homNay, -3), so_gio: 3, loai_ngay: "thuong", ly_do: "Trực tư vấn tuyển sinh buổi tối" });
await mayLan.goi("lam-them", { cv_id: cvLan, ngay: congNgay(homNay, -1), so_gio: 4, loai_ngay: "nghi_tuan", ly_do: "Trực hội thảo du học Chủ nhật" });
await mayLan.goi("lam-them", { cv_id: cvLan, ngay: congNgay(homNay, -2), so_gio: 2, loai_ngay: "thuong", ly_do: "Soạn hồ sơ học viên" });
const lts = (await chu.goi(`lam-them?thang=${thangNay}`)).ds;
const ltCu = lts.filter((x) => x.loai_ngay === "thuong").sort((a, b) => a.ngay.localeCompare(b.ngay))[0];
await chu.goi(`lam-them/${ltCu.id}/duyet`, { he_so: 1.5 });
const ltCn = lts.find((x) => x.loai_ngay === "nghi_tuan");
await chu.goi(`lam-them/${ltCn.id}/duyet`, { he_so: 2 });

// Giáo viên Minh nhận lời mời để xem màn «Dạy» bằng tài khoản giáo viên.
const mayMinh = new May();
await mayMinh.goi("moi/" + minh.ma_moi, { mk: MK, dong_y: true, may: mayMinh.ma });

console.log(JSON.stringify({ email, mat_khau: MK, gv_minh: { dang_nhap: "0" + (SDT0 + 1), mat_khau: MK }, so_buoi: soBuoi, cham: lo.length }, null, 2));
