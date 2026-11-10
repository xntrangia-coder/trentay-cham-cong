// Lõi tính lương: HÀM THUẦN, không đụng CSDL — bộ tự kiểm gọi thẳng được.
// Một người có NHIỀU dòng công việc (vd hành chính lương tháng + dạy lương giờ). Mỗi dòng tính tiền riêng,
// bảo hiểm cộng theo các dòng có đóng BH, thuế TNCN thì GỘP (có dòng HĐLĐ lũy tiến thì lũy tiến trên tổng).
// Bảng lương 2 đợt: đợt 1 = bảng đóng BHXH (lương đóng BH + phụ cấp − BH − thuế); đợt 2 = phần còn lại.
import { luatCho } from "./luat-luong.js";

const tron = (x) => Math.round(x);
const thuCua = (ngay) => new Date(ngay + "T00:00:00Z").getUTCDay();
const phut = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

// Số giờ của một buổi theo lịch (gio_kt nhỏ hơn gio_bd = qua nửa đêm).
export function soGioBuoi(b) {
  let p = phut(b.gio_kt) - phut(b.gio_bd);
  if (p <= 0) p += 1440;
  return Math.round((p / 60) * 100) / 100;
}

// Hệ số của một buổi = khung giờ × hình thức × loại lớp. Khung giờ: lấy hệ số LỚN NHẤT trong các khung khớp
// (buổi tối cuối tuần không nhân chồng hai lần).
export function heSoBuoi(b, bangHeSo) {
  let kg = 1;
  const bd = phut(b.gio_bd), thu = String(thuCua(b.ngay));
  for (const x of bangHeSo.filter((x) => x.nhom === "khung_gio")) {
    const dsThu = String(x.thu || "").split(",").filter(Boolean);
    if (dsThu.length && !dsThu.includes(thu)) continue;
    if (bd >= phut(x.gio_tu || "00:00") && bd < phut(x.gio_den || "23:59") + 1) kg = Math.max(kg, Number(x.gia_tri) || 1);
  }
  const ht = bangHeSo.find((x) => x.nhom === "hinh_thuc" && x.ma === b.hinh_thuc);
  const ll = bangHeSo.find((x) => x.nhom === "loai_lop" && x.id === b.loai_lop_id);
  const r = { khung_gio: kg, hinh_thuc: ht ? Number(ht.gia_tri) || 1 : 1, loai_lop: ll ? Number(ll.gia_tri) || 1 : 1 };
  r.tong = Math.round(r.khung_gio * r.hinh_thuc * r.loai_lop * 1000) / 1000;
  return r;
}

// Công tính lương của dòng lương tháng: mỗi ngày làm tròn XUỐNG nửa công (nửa ngày = 0,5), cộng ngày phép.
export function congTinhLuong(ngayCong) {
  let c = 0, phep = 0;
  for (const n of ngayCong || []) { c += Math.floor((n.cong || 0) * 2) / 2; phep += n.cong_phep || 0; }
  return { cong: c, phep, tong: c + phep };
}

function thueLuyTien(tn, bac) {
  let con = Math.max(0, tn), truoc = 0, thue = 0;
  for (const [tran, ty] of bac) {
    if (con <= 0) break;
    const phan = Math.min(con, tran - truoc);
    thue += phan * ty; con -= phan; truoc = tran;
  }
  return tron(thue);
}

// cvs: [{ id, ten_vai, cach_tinh, dong_bh, thue, luong_thang, don_gia, luong_bh, bh_cty_chiu_het, pc_dt, pc_xang, pc_nha, pc_khac }]
// ngayCong: kết quả tinhKy().ngay của người đó (chỉ cần khi có dòng lương tháng)
// buoi: [{ cv_id, ngay, gio_bd, gio_kt, hinh_thuc, loai_lop_id, lop }] — chỉ buổi ĐÃ DẠY / ĐÃ DUYỆT
// lamThem: [{ cv_id, so_gio, he_so, loai_ngay }] — chỉ đơn đã duyệt
export function tinhLuongNv({ thang, cvs, ngayCong = [], congChuan = 26, buoi = [], bangHeSo = [], lamThem = [], soPhuThuoc = 0 }) {
  const L = luatCho(thang);
  const canhBao = [];
  const dong = [];
  let phuCap = 0, tienLamThem = 0, mienThue = 0;

  for (const cv of cvs) {
    const d = { cv_id: cv.id, ten_vai: cv.ten_vai, cach_tinh: cv.cach_tinh, thue: cv.thue, dong_bh: !!cv.dong_bh, co_ban: 0, chi_tiet: "" };
    const pc = (cv.pc_dt || 0) + (cv.pc_xang || 0) + (cv.pc_nha || 0) + (cv.pc_khac || 0);
    let donGiaGio = 0;
    if (cv.cach_tinh === "thang") {
      const c = congTinhLuong(ngayCong);
      const tinh = Math.min(c.tong, congChuan);
      d.co_ban = tron((cv.luong_thang || 0) * tinh / congChuan);
      d.chi_tiet = `${c.cong} công + ${c.phep} phép / ${congChuan}`;
      d.cong = c.tong;
      if (c.tong > congChuan) canhBao.push({ ma: "vuot-cong-chuan", chu: `${cv.ten_vai}: ${c.tong} công vượt công chuẩn ${congChuan} — phần vượt chưa tính tiền, xét làm thêm giờ.` });
      donGiaGio = (cv.luong_thang || 0) / congChuan / L.gio_chuan_ngay;
    } else if (cv.cach_tinh === "gio") {
      const cuaToi = buoi.filter((b) => b.cv_id === cv.id);
      let gio = 0, tien = 0;
      d.buoi = cuaToi.map((b) => {
        const g = soGioBuoi(b), hs = heSoBuoi(b, bangHeSo), t = tron(g * (cv.don_gia || 0) * hs.tong);
        gio += g; tien += t;
        return { ngay: b.ngay, lop: b.lop, gio_bd: b.gio_bd, gio_kt: b.gio_kt, hinh_thuc: b.hinh_thuc, so_gio: g, he_so: hs.tong, tien: t };
      });
      d.co_ban = tien;
      d.so_gio = Math.round(gio * 100) / 100;
      d.chi_tiet = `${d.so_gio} giờ × ${(cv.don_gia || 0).toLocaleString("vi-VN")}đ (đã nhân hệ số)`;
      donGiaGio = cv.don_gia || 0;
      if (!cv.don_gia) canhBao.push({ ma: "thieu-don-gia", chu: `${cv.ten_vai}: chưa có đơn giá giờ.` });
    } else {
      d.co_ban = tron(cv.luong_thang || 0);
      d.chi_tiet = "khoán";
    }
    // Làm thêm giờ gắn với dòng công việc này
    const lt = lamThem.filter((x) => x.cv_id === cv.id);
    d.lam_them = 0;
    for (const x of lt) {
      const tien = tron(x.so_gio * x.he_so * donGiaGio);
      d.lam_them += tien;
      const tt = L.lam_them_toi_thieu[x.loai_ngay] || 1.5;
      if (x.he_so < tt) canhBao.push({ ma: "lam-them-duoi-luat", chu: `${cv.ten_vai}: làm thêm ${x.so_gio} giờ (${x.loai_ngay}) hệ số ${x.he_so} thấp hơn mức luật ${tt}.` });
    }
    tienLamThem += d.lam_them;
    d.phu_cap = pc;
    phuCap += pc;
    // Khoán chi điện thoại / xăng xe theo quy chế công ty thì không tính vào thu nhập chịu thuế (TT 111/2013 Điều 2).
    if (cv.pc_mien_thue) mienThue += (cv.pc_dt || 0) + (cv.pc_xang || 0);
    d.tong = d.co_ban + d.lam_them + pc;
    dong.push(d);
  }

  const tongThuNhap = dong.reduce((s, d) => s + d.tong, 0);

  // ---- Bảo hiểm ----
  const cvBh = cvs.filter((cv) => cv.dong_bh);
  let luongBh = 0, ctyChiuHet = false;
  for (const cv of cvBh) {
    const hd = cv.cach_tinh === "thang" ? cv.luong_thang || 0 : 0;
    const bh = cv.luong_bh != null && cv.luong_bh !== "" ? Number(cv.luong_bh) : hd;
    luongBh += bh;
    if (cv.bh_cty_chiu_het) ctyChiuHet = true;
    if (hd && bh < hd) canhBao.push({ ma: "bh-thap-hon-hd", chu: `${cv.ten_vai}: lương đóng BH ${bh.toLocaleString("vi-VN")}đ thấp hơn lương HĐ ${hd.toLocaleString("vi-VN")}đ — có rủi ro bị truy thu BHXH.` });
    if (cv.cach_tinh === "gio" && !bh) canhBao.push({ ma: "thieu-luong-bh", chu: `${cv.ten_vai}: HĐLĐ có đóng BH nhưng chưa khai lương đóng BH.` });
  }
  if (luongBh > L.tran_bh) luongBh = L.tran_bh;
  const bhNld = { bhxh: tron(luongBh * L.nld.bhxh), bhyt: tron(luongBh * L.nld.bhyt), bhtn: tron(luongBh * L.nld.bhtn) };
  bhNld.cong = bhNld.bhxh + bhNld.bhyt + bhNld.bhtn;
  const bhCty = { bhxh: tron(luongBh * L.cty.bhxh), bhyt: tron(luongBh * L.cty.bhyt), bhtn: tron(luongBh * L.cty.bhtn) };
  bhCty.cong = bhCty.bhxh + bhCty.bhyt + bhCty.bhtn;
  const dongThay = ctyChiuHet ? bhNld.cong : 0;          // công ty đóng luôn phần của người lao động
  const bhNldTra = ctyChiuHet ? 0 : bhNld.cong;          // số bị trừ vào lương
  const kpcd = luongBh ? tron(luongBh * L.kpcd) : 0;

  // ---- Thuế TNCN ----
  let thue = 0, cachThue = "khong", tnChiuThue = 0, giamTru = 0, tnTinhThue = 0;
  if (cvs.some((cv) => cv.thue === "luy_tien")) {
    cachThue = "luy_tien";
    // Khoản BH công ty đóng thay là thu nhập chịu thuế, rồi lại được trừ như BH bắt buộc ⇒ hai dòng triệt tiêu.
    tnChiuThue = tongThuNhap + dongThay - mienThue;
    giamTru = L.giam_tru_ban_than + soPhuThuoc * L.giam_tru_phu_thuoc;
    tnTinhThue = Math.max(0, tnChiuThue - bhNld.cong - giamTru);
    thue = thueLuyTien(tnTinhThue, L.bac_thue);
  } else {
    for (const d of dong) {
      if (d.thue === "khong_cu_tru") { thue += tron(d.tong * L.ty_le_khong_cu_tru); cachThue = "khong_cu_tru"; }
      else if (d.thue === "khau_tru" && d.tong >= L.nguong_khau_tru) { thue += tron(d.tong * L.ty_le_khau_tru); cachThue = "khau_tru"; }
      else if (d.thue === "khau_tru" && cachThue === "khong") cachThue = "duoi_nguong";
    }
    tnChiuThue = tongThuNhap;
  }

  const thucLinh = tongThuNhap - bhNldTra - thue;

  // ---- 2 đợt ----
  let dot1Gross, dot1;
  if (luongBh > 0) {
    dot1Gross = Math.min(tongThuNhap, luongBh + phuCap);
    dot1 = Math.max(0, dot1Gross - bhNldTra - thue);
  } else {
    dot1Gross = tongThuNhap;                              // không đóng BH: trả trọn ở đợt 1, đủ chứng từ khấu trừ
    dot1 = thucLinh;
  }
  const dot2 = thucLinh - dot1;
  if (dot2 > 0 && luongBh > 0) canhBao.push({ ma: "co-dot-2", chu: `Đợt 2 ${dot2.toLocaleString("vi-VN")}đ: thuế TNCN đã tính trên TỔNG cả hai đợt.` });

  return {
    luat: { tu: L.tu, chac: L.chac, nguon: L.nguon },
    dong, phu_cap: phuCap, lam_them: tienLamThem, tong_thu_nhap: tongThuNhap,
    luong_bh: luongBh, bh_nld: bhNld, bh_nld_tra: bhNldTra, bh_cty: bhCty, bh_cty_dong_thay: dongThay, kpcd,
    cach_thue: cachThue, mien_thue: mienThue, tn_chiu_thue: tnChiuThue, giam_tru: giamTru, tn_tinh_thue: tnTinhThue, thue,
    thuc_linh: thucLinh, dot1_gross: dot1Gross, dot1, dot2,
    chi_phi_cty: tongThuNhap + bhCty.cong + dongThay + kpcd,
    canh_bao: canhBao,
  };
}
