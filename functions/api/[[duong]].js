// Mọi API của TRENTAY Chấm Công.
// LUẬT TÁCH DỮ LIỆU: dn_id luôn lấy từ PHIÊN (hoặc từ mã kiosk của địa điểm), KHÔNG BAO GIỜ từ thân yêu cầu.
// LUẬT GIỜ: giờ chấm là giờ MÁY CHỦ; bản ghi chấm chỉ thêm, không sửa — sửa sai đi qua đơn được duyệt.
// LUẬT PHẠM VI: quản lý có pham_vi='phong_ban' chỉ thấy/sửa người trong phòng ban của mình (pbCua).
// LUẬT CỠ LỚN: không lọc mảng lồng mảng (ngàn người × chục nghìn lượt chấm) — gom theo Map; câu IN tối đa 90 tham số.
import { HAN, LOAI_DON, CA_MAU, PHIEN_BAN_CHINH_SACH, CHE_DO } from "../../lib/cau-hinh.js";
import {
  json, loi, maNgauNhien, bam256, bamMatKhau, bangNhau, taoPhien, xoaCookie, layPhien, huyPhien,
  biKhoa, ghiSai, xoaSai, cat, chuanSdt, chuanEmail, cachMet, toaDoHopLe, lamTron, maQr, boDau,
} from "../../lib/tien-ich.js";
import {
  tinhKy, ganNgay, ngayTrongThang, ngayCua, gioHopLe, ngayHopLe, dsNgay, congNgay, dauNgay, NGAY,
} from "../../lib/tinh-cong.js";
import { dinhTuyenLuong } from "../../lib/api-luong.js";
const DUONG_LUONG = /^(luong\/|day(\/|$)|lam-them(\/|$)|phieu-luong$|buoi-day(\/|$)|bang-luong|nv\/[a-f0-9]{16}\/(cong-viec|thue)|thu\/buoi-xong$)/;

export async function onRequest(ctx) {
  const { request: req, env, params } = ctx;
  const duong = (params.duong || []).join("/");
  const pt = req.method;
  // Lệnh ghi phải kèm header riêng: trang lạ không gửi hộ được (máy chủ không mở CORS).
  if (pt !== "GET" && req.headers.get("x-cc") !== "1") return loi("thieu-header", 403);
  let than = {};
  if (pt === "POST") { try { than = await req.json(); } catch { than = {}; } }
  if (!than || typeof than !== "object") than = {};
  try {
    return await dinhTuyen(env, req, pt, duong, than);
  } catch (e) {
    return json({ loi: "may-chu", chi_tiet: String(e && e.message || e).slice(0, 160) }, 500);
  }
}

async function dinhTuyen(env, req, pt, duong, than) {
  const url = new URL(req.url);
  let m;
  if (pt === "GET" && duong === "cau-hinh") return json({ han: HAN, loai_don: LOAI_DON, phien_ban_chinh_sach: PHIEN_BAN_CHINH_SACH });
  if (pt === "POST" && duong === "dang-ky") return dangKy(env, than);
  if (pt === "POST" && duong === "dang-nhap") return dangNhap(env, than);
  if (pt === "POST" && duong === "dang-xuat") { await huyPhien(env, req); return json({ ok: true }, 200, { "set-cookie": xoaCookie() }); }
  if ((m = duong.match(/^moi\/([a-f0-9]{24})$/))) return pt === "GET" ? xemMoi(env, m[1]) : nhanMoi(env, m[1], than);
  if ((m = duong.match(/^kiosk\/([a-f0-9]{16})$/)) && pt === "GET") return kiosk(env, m[1], url.searchParams.get("k"));
  if ((m = duong.match(/^kiosk\/([a-f0-9]{16})\/cham$/)) && pt === "POST") return chamThe(env, req, m[1], than);

  const phien = await layPhien(env, req);
  if (!phien) return loi("chua-dang-nhap", 401);
  const toi = await env.DB.prepare("SELECT * FROM nguoi_dung WHERE id=?").bind(phien.nguoi_id).first();
  if (!toi || toi.trang_thai !== "hoat_dong") return loi("chua-dang-nhap", 401);
  const dn = await env.DB.prepare("SELECT * FROM doanh_nghiep WHERE id=?").bind(toi.dn_id).first();
  if (!dn) return loi("chua-dang-nhap", 401);

  // ---- GĐ3 tính lương (kiểu thuê, buổi dạy, làm thêm giờ, bảng lương) — xem lib/api-luong.js ----
  if (DUONG_LUONG.test(duong)) {
    const kq = await dinhTuyenLuong(env, req, pt, duong, than, url, { toi, dn, pbCua, layNv, tinhChoNv, mapPhongBan, nhatKy, luuAnh, homNayVn, thangHopLe });
    return kq || loi("khong-tim-thay", 404);
  }

  // ---- Mọi người ----
  if (duong === "toi" && pt === "GET") return xemToi(env, toi, dn);
  if (duong === "doi-mat-khau" && pt === "POST") return doiMatKhau(env, toi, than);
  if (duong === "cham/hom-nay" && pt === "GET") return chamHomNay(env, toi);
  if (duong === "cham" && pt === "POST") return cham(env, req, toi, dn, than);
  if (duong === "cua-toi" && pt === "GET") return bangCongNv(env, dn, toi, url.searchParams.get("thang"));
  if (duong === "don" && pt === "GET") return dsDon(env, toi, url);
  if (duong === "don" && pt === "POST") return taoDon(env, toi, than);
  if ((m = duong.match(/^don\/([a-f0-9]{16})\/huy$/)) && pt === "POST") return huyDon(env, toi, m[1]);

  // ---- Theo dõi lộ trình (công khai, chỉ trong ca) — nhân viên tự bật/tắt ----
  if (duong === "vi-tri/phien" && pt === "GET") return phienTheoDoi(env, toi);
  if (duong === "vi-tri/dong-y" && pt === "POST") return dongYTheoDoi(env, toi, than);
  if (duong === "vi-tri/bat-ca" && pt === "POST") return batCa(env, toi, than);
  if (duong === "vi-tri/tat-ca" && pt === "POST") return tatCa(env, toi);
  if (duong === "vi-tri/nap" && pt === "POST") return napViTri(env, toi, than);
  if (duong === "ghe-tham" && pt === "POST") return themGheTham(env, toi, than);
  if ((m = duong.match(/^ghe-tham\/([a-f0-9]{16})\/roi$/)) && pt === "POST") return roiGheTham(env, toi, m[1]);

  // ---- Chủ / quản lý ----
  const laQuanTri = toi.vai === "chu" || toi.vai === "quan_ly";
  if (!laQuanTri) return loi("khong-co-quyen", 403);
  const toanCty = !pbCua(toi);
  if ((m = duong.match(/^don\/([a-f0-9]{16})\/(duyet|tu-choi)$/)) && pt === "POST") return xetDon(env, toi, m[1], m[2], than);
  if (duong === "hom-nay" && pt === "GET") return homNay(env, dn, toi, url);
  if (duong === "bang-cong" && pt === "GET") return bangCong(env, dn, toi, url);
  if (duong === "bang-cong.csv" && pt === "GET") return bangCongCsv(env, dn, toi, url);
  if (duong === "ban-do" && pt === "GET") return banDo(env, dn, toi);
  if (duong === "lo-trinh" && pt === "GET") return loTrinh(env, dn, toi, url);
  if (duong === "ip" && pt === "GET") return json({ ip: req.headers.get("cf-connecting-ip") || "" });
  if (duong === "nv" && pt === "GET") return dsNv(env, dn, toi, url);
  if (duong === "nv" && pt === "POST") return themNv(env, toi, dn, than);
  if (duong === "nv/nhap" && pt === "POST") return nhapNv(env, toi, dn, than);
  if (duong === "nv/the" && pt === "GET") return dsThe(env, dn, toi, url);
  if ((m = duong.match(/^nv\/([a-f0-9]{16})\/thang$/)) && pt === "GET") {
    const nv = await layNv(env, dn, toi, m[1]); if (!nv) return loi("khong-tim-thay", 404);
    return bangCongNv(env, dn, nv, url.searchParams.get("thang"));
  }
  if ((m = duong.match(/^nv\/([a-f0-9]{16})\/ngay$/)) && pt === "GET") return chiTietNgay(env, dn, toi, m[1], url.searchParams.get("ngay"));
  if ((m = duong.match(/^nv\/([a-f0-9]{16})\/(sua|doi-may|moi-lai|nghi-viec|khoi-phuc|cap-the)$/)) && pt === "POST")
    return suaNv(env, toi, dn, m[1], m[2], than);
  if ((m = duong.match(/^anh\/([a-f0-9]{16})$/)) && pt === "GET") return xemAnh(env, dn, toi, m[1]);
  if (duong === "ca" && pt === "GET") return dsCa(env, dn);
  if (duong === "dia-diem" && pt === "GET") return dsDiaDiem(env, dn, toi);
  if (duong === "phong-ban" && pt === "GET") return dsPhongBan(env, dn);
  // Cấu hình chung của công ty: chỉ chủ hoặc quản lý toàn công ty.
  if (!toanCty && pt === "POST" && /^(ca|dia-diem|phong-ban)(\/|$)/.test(duong)) return loi("khong-co-quyen", 403);
  if (duong === "ca" && pt === "POST") return luuCa(env, toi, dn, null, than);
  if ((m = duong.match(/^ca\/([a-f0-9]{16})\/(sua|xoa)$/)) && pt === "POST")
    return m[2] === "xoa" ? xoaCa(env, toi, dn, m[1]) : luuCa(env, toi, dn, m[1], than);
  if (duong === "dia-diem" && pt === "POST") return luuDiaDiem(env, toi, dn, null, than);
  if ((m = duong.match(/^dia-diem\/([a-f0-9]{16})\/(sua|xoa|doi-ma)$/)) && pt === "POST")
    return ({ sua: luuDiaDiem, xoa: xoaDiaDiem, "doi-ma": doiMaKiosk })[m[2]](env, toi, dn, m[1], than);
  if (duong === "phong-ban" && pt === "POST") return luuPhongBan(env, toi, dn, null, than);
  if ((m = duong.match(/^phong-ban\/([a-f0-9]{16})\/(sua|xoa)$/)) && pt === "POST")
    return m[2] === "xoa" ? xoaPhongBan(env, toi, dn, m[1]) : luuPhongBan(env, toi, dn, m[1], than);
  if (duong === "dn/sua" && pt === "POST") {
    if (toi.vai !== "chu") return loi("khong-co-quyen", 403);
    return suaDn(env, toi, dn, than);
  }
  // CHỈ máy chủ thử (CC_THU=1): ghi bản chấm ở giờ tuỳ ý để bộ tự kiểm thử được phần tính công.
  if (duong === "thu/cham" && pt === "POST" && env.CC_THU === "1") return thuCham(env, dn, than);
  if (duong === "thu/cham-lo" && pt === "POST" && env.CC_THU === "1") return thuChamLo(env, dn, than);
  return loi("khong-tim-thay", 404);
}

// ================= Tiện ích riêng =================
const soNguyen = (x, min, max, mac) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : mac; };
const homNayVn = () => ngayCua(Date.now());
const thangHopLe = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || "")) ? s : homNayVn().slice(0, 7);
const LO_IN = 90; // số id mỗi câu IN (D1 nhận tối đa 100 tham số)
async function nhatKy(env, dnId, ai, viec, doiTuong = "") {
  await env.DB.prepare("INSERT INTO nhat_ky (dn_id, ai, viec, doi_tuong, luc) VALUES (?,?,?,?,?)").bind(dnId, ai, viec, doiTuong, Date.now()).run();
}
// Phòng ban mà người này bị giới hạn trong đó; null = thấy cả công ty.
const pbCua = (toi) => (toi.vai === "quan_ly" && toi.pham_vi === "phong_ban" ? toi.phong_ban_id || "-" : null);
const trongPhamVi = (toi, nv) => { const pb = pbCua(toi); return !pb || nv.phong_ban_id === pb; };
async function layNv(env, dn, toi, id) {
  const nv = await env.DB.prepare("SELECT * FROM nguoi_dung WHERE id=? AND dn_id=?").bind(id, dn.id).first();
  return nv && trongPhamVi(toi, nv) ? nv : null;
}
const congKhaiCham = (c) => ({ id: c.id, loai: c.loai, luc: c.luc, canh_bao: c.canh_bao ? c.canh_bao.split(",") : [],
  qua_qr: !!c.qua_qr, qua_the: !!c.qua_the, co_anh: !!c.co_anh, cach_met: c.cach_met, lat: c.lat, lng: c.lng, sai_so: c.sai_so, ip: c.ip, dia_diem_id: c.dia_diem_id });
const congKhaiNv = (n) => ({ id: n.id, ten: n.ten, sdt: n.sdt, email: n.email, ma_nv: n.ma_nv, vai: n.vai, che_do: n.che_do,
  ca_id: n.ca_id, dia_diem_id: n.dia_diem_id, phong_ban_id: n.phong_ban_id, pham_vi: n.pham_vi, trang_thai: n.trang_thai,
  da_nhan: !!n.mk_bam, co_may: !!n.may_bam, co_the: !!n.ma_the,
  ma_moi: n.mk_bam ? null : n.ma_moi, ma_moi_lai: n.mk_bam && n.ma_moi ? n.ma_moi : null });

async function mapCa(env, dn) {
  const { results } = await env.DB.prepare("SELECT * FROM ca WHERE dn_id=?").bind(dn.id).all();
  return new Map(results.map((c) => [c.id, c]));
}
async function mapPhongBan(env, dn) {
  const { results } = await env.DB.prepare("SELECT id, ten FROM phong_ban WHERE dn_id=?").bind(dn.id).all();
  return new Map(results.map((p) => [p.id, p.ten]));
}
const nhom = (ds, khoa) => { const m = new Map(); for (const x of ds) { const k = x[khoa]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };

// Điều kiện lọc nhân viên dùng chung cho Hôm nay / Bảng công / Nhân viên / CSV / in thẻ.
// pb: id phòng ban | "khong" (chưa có phòng ban) | rỗng (tất cả). Quản lý phòng ban bị ép về phòng ban của mình.
function dieuKienNv(toi, url, { chiHoatDong = true } = {}) {
  const dk = ["n.dn_id=?"], ts = [toi.dn_id];
  const pb = pbCua(toi) || String(url.searchParams.get("pb") || "");
  if (pb === "khong") dk.push("n.phong_ban_id IS NULL");
  else if (pb) { dk.push("n.phong_ban_id=?"); ts.push(pb); }
  const q = boDau(url.searchParams.get("q")).replace(/[%_]/g, "").slice(0, 40);
  if (q) { const l = `%${q}%`; dk.push("(n.ten_tim LIKE ? OR lower(COALESCE(n.ma_nv,'')) LIKE ? OR COALESCE(n.sdt,'') LIKE ?)"); ts.push(l, l, l); }
  const tt = url.searchParams.get("tt");
  if (tt === "nghi_viec") dk.push("n.trang_thai='nghi_viec'");
  else if (tt === "chua_nhan") dk.push("n.trang_thai='hoat_dong' AND n.mk_bam IS NULL AND n.che_do<>'the'");
  else if (chiHoatDong) dk.push("n.trang_thai='hoat_dong'");
  return { dk: dk.join(" AND "), ts };
}
const trangCua = (url) => soNguyen(url.searchParams.get("trang"), 1, 100000, 1);

// Bản chấm của nhiều người trong một khoảng, gom theo người. Chỉ lấy cột lõi tính công cần.
async function banGhiNhieu(env, dnId, ids, tu, den) {
  const ra = new Map();
  for (let i = 0; i < ids.length; i += LO_IN) {
    const lo = ids.slice(i, i + LO_IN);
    const { results } = await env.DB.prepare(`SELECT nv_id, loai, luc, canh_bao FROM cham WHERE dn_id=? AND luc>=? AND luc<?
      AND nv_id IN (${lo.map(() => "?").join(",")}) ORDER BY luc`).bind(dnId, tu, den, ...lo).all();
    for (const b of results) { if (!ra.has(b.nv_id)) ra.set(b.nv_id, []); ra.get(b.nv_id).push(b); }
  }
  return ra;
}

// ================= Tài khoản =================
async function dangKy(env, t) {
  const tenDn = cat(t.ten_dn, 80), ten = cat(t.ten, 60), email = chuanEmail(t.email);
  if (tenDn.length < 2) return loi("thieu-ten-dn");
  if (ten.length < 2) return loi("thieu-ten");
  if (!email) return loi("sai-email");
  if (String(t.mk || "").length < 8) return loi("mat-khau-ngan");
  if (t.dong_y_dieu_khoan !== true) return loi("thieu-dong-y");
  if (await env.DB.prepare("SELECT 1 FROM nguoi_dung WHERE email=?").bind(email).first()) return loi("email-da-co", 409);
  const now = Date.now(), dnId = maNgauNhien(8), uid = maNgauNhien(8), caId = maNgauNhien(8), ddId = maNgauNhien(8);
  const { bam, muoi } = await bamMatKhau(String(t.mk));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO doanh_nghiep (id, ten, ngon_ngu, khoa_qr, tao_luc) VALUES (?,?,?,?,?)")
      .bind(dnId, tenDn, t.ngon_ngu === "en" ? "en" : "vi", maNgauNhien(32), now),
    env.DB.prepare("INSERT INTO ca (id, dn_id, ten, gio_vao, gio_ra, nghi_phut, cho_muon_phut, ngay_lam, tao_luc) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(caId, dnId, CA_MAU.ten, CA_MAU.gio_vao, CA_MAU.gio_ra, CA_MAU.nghi_phut, CA_MAU.cho_muon_phut, CA_MAU.ngay_lam, now),
    env.DB.prepare("INSERT INTO dia_diem (id, dn_id, ten, ma_kiosk, tao_luc) VALUES (?,?,?,?,?)")
      .bind(ddId, dnId, t.ngon_ngu === "en" ? "Main office" : "Văn phòng chính", maNgauNhien(8), now),
    env.DB.prepare(`INSERT INTO nguoi_dung (id, dn_id, ten, ten_tim, email, vai, ca_id, dia_diem_id, mk_bam, mk_muoi, dong_y_luc, dong_y_ban, ma_the, tao_luc)
      VALUES (?,?,?,?,?,'chu',?,?,?,?,?,?,?,?)`).bind(uid, dnId, ten, boDau(ten), email, caId, ddId, bam, muoi, now, PHIEN_BAN_CHINH_SACH, maNgauNhien(6), now),
  ]);
  await nhatKy(env, dnId, uid, "dang-ky");
  return json({ ok: true }, 200, { "set-cookie": await taoPhien(env, uid) });
}

async function dangNhap(env, t) {
  const vao = String(t.dang_nhap || "").trim();
  const email = vao.includes("@") ? chuanEmail(vao) : null, sdt = email ? null : chuanSdt(vao);
  if (!email && !sdt) return loi("sai-dang-nhap", 401);
  const khoa = "dn:" + (email || sdt);
  if (await biKhoa(env, khoa)) return loi("tam-khoa", 429);
  const u = await env.DB.prepare(`SELECT * FROM nguoi_dung WHERE ${email ? "email" : "sdt"}=?`).bind(email || sdt).first();
  if (!u || !u.mk_bam || u.trang_thai !== "hoat_dong") { await ghiSai(env, khoa); return loi("sai-dang-nhap", 401); }
  const { bam } = await bamMatKhau(String(t.mk || ""), u.mk_muoi);
  if (!bangNhau(bam, u.mk_bam)) { await ghiSai(env, khoa); return loi("sai-dang-nhap", 401); }
  await xoaSai(env, khoa);
  return json({ ok: true }, 200, { "set-cookie": await taoPhien(env, u.id) });
}

async function xemMoi(env, ma) {
  const u = await env.DB.prepare("SELECT n.ten, n.sdt, n.email, d.ten AS dn_ten FROM nguoi_dung n JOIN doanh_nghiep d ON d.id=n.dn_id WHERE n.ma_moi=? AND n.trang_thai='hoat_dong'").bind(ma).first();
  if (!u) return loi("khong-tim-thay", 404);
  return json({ ten: u.ten, dn_ten: u.dn_ten, dang_nhap: u.sdt || u.email });
}
async function nhanMoi(env, ma, t) {
  const u = await env.DB.prepare("SELECT * FROM nguoi_dung WHERE ma_moi=? AND trang_thai='hoat_dong'").bind(ma).first();
  if (!u) return loi("khong-tim-thay", 404);
  if (String(t.mk || "").length < 8) return loi("mat-khau-ngan");
  if (t.dong_y !== true) return loi("thieu-dong-y");
  const may = String(t.may || "");
  if (!/^[a-f0-9]{32}$/.test(may)) return loi("thieu-may");
  const { bam, muoi } = await bamMatKhau(String(t.mk));
  // Nhận lời mời trên máy nào thì gắn máy đó (nếu chưa gắn máy nào).
  await env.DB.prepare(`UPDATE nguoi_dung SET mk_bam=?, mk_muoi=?, ma_moi=NULL, dong_y_luc=?, dong_y_ban=?,
    may_bam=COALESCE(may_bam, ?) WHERE id=?`).bind(bam, muoi, Date.now(), PHIEN_BAN_CHINH_SACH, await bam256(may), u.id).run();
  await env.DB.prepare("DELETE FROM phien WHERE nguoi_id=?").bind(u.id).run();
  await nhatKy(env, u.dn_id, u.id, "nhan-moi");
  return json({ ok: true }, 200, { "set-cookie": await taoPhien(env, u.id) });
}

async function xemToi(env, toi, dn) {
  const ca = toi.ca_id ? await env.DB.prepare("SELECT * FROM ca WHERE id=? AND dn_id=?").bind(toi.ca_id, dn.id).first() : null;
  const pb = toi.phong_ban_id ? await env.DB.prepare("SELECT ten FROM phong_ban WHERE id=? AND dn_id=?").bind(toi.phong_ban_id, dn.id).first() : null;
  return json({
    id: toi.id, ten: toi.ten, vai: toi.vai, che_do: toi.che_do, email: toi.email, sdt: toi.sdt, ma_nv: toi.ma_nv, co_may: !!toi.may_bam,
    phong_ban: pb?.ten || "", gioi_han_pb: pbCua(toi),
    co_day: !!(await env.DB.prepare(`SELECT 1 FROM cong_viec cv JOIN kieu_thue kt ON kt.id=cv.kieu_thue_id
      WHERE cv.dn_id=? AND cv.nv_id=? AND cv.con_hieu_luc=1 AND kt.cach_tinh='gio' LIMIT 1`).bind(dn.id, toi.id).first()),
    ca: ca && { ten: ca.ten, gio_vao: ca.gio_vao, gio_ra: ca.gio_ra, ngay_lam: ca.ngay_lam },
    dn: { ten: dn.ten, bat_qr: !!dn.bat_qr, bat_gps: !!dn.bat_gps, bat_selfie: !!dn.bat_selfie, giu_anh_ngay: dn.giu_anh_ngay,
      cong_chuan: dn.cong_chuan, ngon_ngu: dn.ngon_ngu },
  });
}
async function doiMatKhau(env, toi, t) {
  const { bam } = await bamMatKhau(String(t.cu || ""), toi.mk_muoi);
  if (!bangNhau(bam, toi.mk_bam)) return loi("sai-mat-khau");
  if (String(t.moi || "").length < 8) return loi("mat-khau-ngan");
  const m = await bamMatKhau(String(t.moi));
  await env.DB.prepare("UPDATE nguoi_dung SET mk_bam=?, mk_muoi=? WHERE id=?").bind(m.bam, m.muoi, toi.id).run();
  return json({ ok: true });
}

// ================= Màn QR ở quầy / máy quét thẻ ở cổng =================
async function layKiosk(env, ddId, k) {
  const dd = await env.DB.prepare("SELECT d.*, n.ten AS dn_ten, n.khoa_qr, n.bat_selfie, n.giu_anh_ngay FROM dia_diem d JOIN doanh_nghiep n ON n.id=d.dn_id WHERE d.id=?").bind(ddId).first();
  return dd && k && bangNhau(String(k), dd.ma_kiosk) ? dd : null;
}
async function kiosk(env, ddId, k) {
  const dd = await layKiosk(env, ddId, k);
  if (!dd) return loi("khong-tim-thay", 404);
  const s = HAN.qr_cua_so_giay * 1000, cuaSo = Math.floor(Date.now() / s);
  return json({ ten: dd.ten, dn_ten: dd.dn_ten, bat_selfie: !!dd.bat_selfie, ma: `${dd.id}.${await maQr(dd.khoa_qr, dd.id, cuaSo)}`,
    doi_sau_ms: (cuaSo + 1) * s - Date.now() });
}

// Công nhân không dùng điện thoại: quẹt thẻ (mã QR in sẵn) vào máy tính bảng ở cổng, máy chụp ảnh.
// Máy cổng xác thực bằng mã kiosk của địa điểm; VÀO hay RA máy chủ tự quyết theo lần chấm trước.
async function chamThe(env, req, ddId, t) {
  const dd = await layKiosk(env, ddId, t.k);
  if (!dd) return loi("khong-tim-thay", 404);
  const mm = String(t.the || "").match(/TTCC:([a-f0-9]{16})\.([a-f0-9]{12})/);
  if (!mm) return loi("the-sai");
  const nv = await env.DB.prepare("SELECT * FROM nguoi_dung WHERE id=? AND dn_id=?").bind(mm[1], dd.dn_id).first();
  if (!nv || !nv.ma_the || !bangNhau(mm[2], nv.ma_the)) return loi("the-sai");
  if (nv.trang_thai !== "hoat_dong") return loi("the-nghi-viec");
  const now = Date.now();
  const cuoi = await env.DB.prepare("SELECT * FROM cham WHERE dn_id=? AND nv_id=? ORDER BY luc DESC LIMIT 1").bind(dd.dn_id, nv.id).first();
  // Giữ thẻ trước camera vài giây thì máy đọc nhiều lần: trong cửa sổ lặp trả lại bản ghi cũ, không đảo VÀO/RA.
  if (cuoi && now - cuoi.luc < HAN.the_lap_giay * 1000)
    return json({ ok: true, vua_cham: true, ten: nv.ten, ma_nv: nv.ma_nv, cham: { loai: cuoi.loai, luc: cuoi.luc } });
  const loai = cuoi && cuoi.loai === "vao" && now - cuoi.luc < HAN.the_ra_trong_gio * 3600e3 ? "ra" : "vao";
  const anh = typeof t.anh === "string" ? t.anh : "";
  if (anh && !anhHopLe(anh)) return loi("anh-loi");
  if (!anh && dd.bat_selfie) return loi("thieu-anh");
  const id = maNgauNhien(8);
  const lenh = [env.DB.prepare(`INSERT INTO cham (id, dn_id, nv_id, loai, luc, dia_diem_id, ip, qua_the, co_anh, canh_bao)
    VALUES (?,?,?,?,?,?,?,1,?,'')`).bind(id, dd.dn_id, nv.id, loai, now, dd.id, req.headers.get("cf-connecting-ip") || "", anh ? 1 : 0)];
  lenh.push(...await luuAnh(env, dd.dn_id, id, anh, now));
  await env.DB.batch(lenh);
  await donAnhCu(env, dd.dn_id, dd.giu_anh_ngay, now);
  return json({ ok: true, ten: nv.ten, ma_nv: nv.ma_nv, cham: { loai, luc: now } });
}

// ================= Ảnh xác nhận: R2 nếu có (binding ANH), không thì trong D1 =================
const anhHopLe = (anh) => anh.length <= Math.ceil(HAN.anh_toi_da_kb * 1024 * 4 / 3) + 30 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(anh);
const khoaR2 = (dnId, chamId) => `${dnId}/${chamId}.jpg`;
async function luuAnh(env, dnId, chamId, anh, now) {
  if (!anh) return [];
  if (env.ANH) {
    const bin = Uint8Array.from(atob(anh.slice(anh.indexOf(",") + 1)), (c) => c.charCodeAt(0));
    await env.ANH.put(khoaR2(dnId, chamId), bin, { httpMetadata: { contentType: "image/jpeg" } });
    return [env.DB.prepare("INSERT INTO anh_cham (cham_id, dn_id, du_lieu, luc, kho) VALUES (?,?,'',?,'r2')").bind(chamId, dnId, now)];
  }
  return [env.DB.prepare("INSERT INTO anh_cham (cham_id, dn_id, du_lieu, luc, kho) VALUES (?,?,?,?,'d1')").bind(chamId, dnId, anh, now)];
}
// Xoá ảnh quá hạn giữ, mỗi lượt chấm dọn tối đa 25 tấm (không cần lịch chạy nền, không làm chậm giờ cao điểm).
async function donAnhCu(env, dnId, giuNgay, now) {
  const { results } = await env.DB.prepare("SELECT cham_id, kho FROM anh_cham WHERE dn_id=? AND luc<? LIMIT 25").bind(dnId, now - giuNgay * NGAY).all();
  if (!results.length) return;
  const r2 = results.filter((a) => a.kho === "r2").map((a) => khoaR2(dnId, a.cham_id));
  if (r2.length && env.ANH) await env.ANH.delete(r2);
  await env.DB.prepare(`DELETE FROM anh_cham WHERE dn_id=? AND cham_id IN (${results.map(() => "?").join(",")})`)
    .bind(dnId, ...results.map((a) => a.cham_id)).run();
}

// ================= Chấm công bằng điện thoại =================
async function banGhiTu(env, dnId, nvId, tu, den) {
  const { results } = await env.DB.prepare("SELECT * FROM cham WHERE dn_id=? AND nv_id=? AND luc>=? AND luc<? ORDER BY luc")
    .bind(dnId, nvId, tu, den).all();
  return results;
}
async function donDuyet(env, dnId, nvId, tu, den) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM don WHERE dn_id=? ${nvId ? "AND nv_id=?" : ""} AND trang_thai='duyet' AND ngay<=? AND den_ngay>=?`)
    .bind(...(nvId ? [dnId, nvId, den, tu] : [dnId, den, tu])).all();
  return results;
}

async function chamHomNay(env, toi) {
  const hom = homNayVn();
  const ca = toi.ca_id ? await env.DB.prepare("SELECT * FROM ca WHERE id=? AND dn_id=?").bind(toi.ca_id, toi.dn_id).first() : null;
  const ban = await banGhiTu(env, toi.dn_id, toi.id, dauNgay(hom) - NGAY, Date.now() + 1);
  const don = await donDuyet(env, toi.dn_id, toi.id, congNgay(hom, -1), hom);
  const ky = tinhKy({ ca, ngays: [congNgay(hom, -1), hom], ban, don });
  // Ca qua đêm: nếu hôm qua còn đang làm dở thì hiện hôm qua.
  const homQua = ky.ngay[0];
  const ngay = homQua.trang_thai === "dang_lam" ? homQua : ky.ngay[1];
  const cuaNgay = ban.filter((b) => ganMot(ca, b) === ngay.ngay);
  const cuoi = cuaNgay[cuaNgay.length - 1];
  return json({ ngay, ban: cuaNgay.map(congKhaiCham), tiep_theo: cuoi && cuoi.loai === "vao" ? "ra" : "vao" });
}
// Ngày công của một bản ghi — dùng đúng luật gán ngày (ca qua đêm) của lõi tính công.
const ganMot = (ca, b) => [...ganNgay(ca, [b]).keys()][0];

async function cham(env, req, toi, dn, t) {
  if (!toi.dong_y_luc) return loi("thieu-dong-y");
  const loai = t.loai === "vao" || t.loai === "ra" ? t.loai : null;
  if (!loai) return loi("sai-loai");
  const may = String(t.may || "");
  if (!/^[a-f0-9]{32}$/.test(may)) return loi("thieu-may");
  const mayBam = await bam256(may);
  if (toi.may_bam && toi.may_bam !== mayBam) return loi("may-khac", 403);
  const now = Date.now();

  const cuoi = await env.DB.prepare("SELECT * FROM cham WHERE dn_id=? AND nv_id=? ORDER BY luc DESC LIMIT 1").bind(dn.id, toi.id).first();
  if (cuoi && cuoi.loai === loai && now - cuoi.luc < HAN.cham_lap_giay * 1000) return json({ ok: true, vua_cham: true, cham: congKhaiCham(cuoi) });

  const canhBao = [];
  const vanPhong = toi.che_do !== "thi_truong";
  let dd = null, quaQr = 0;
  if (vanPhong) {
    const qr = String(t.qr || "").trim();
    if (qr) {
      const mm = qr.match(/([a-f0-9]{16})\.([a-f0-9]{12})/);
      if (!mm) return loi("qr-sai");
      dd = await env.DB.prepare("SELECT * FROM dia_diem WHERE id=? AND dn_id=?").bind(mm[1], dn.id).first();
      if (!dd) return loi("qr-sai");
      const cs = Math.floor(now / (HAN.qr_cua_so_giay * 1000));
      const dung = bangNhau(mm[2], await maQr(dn.khoa_qr, dd.id, cs)) || bangNhau(mm[2], await maQr(dn.khoa_qr, dd.id, cs - 1));
      if (!dung) return loi("qr-het-han");
      quaQr = 1;
    } else if (dn.bat_qr) {
      return loi("thieu-qr");
    } else {
      canhBao.push("khong-qr");
      dd = toi.dia_diem_id ? await env.DB.prepare("SELECT * FROM dia_diem WHERE id=? AND dn_id=?").bind(toi.dia_diem_id, dn.id).first() : null;
    }
  }

  let lat = Number(t.lat), lng = Number(t.lng);
  const saiSo = soNguyen(t.sai_so, 0, 100000, 0);
  const coGps = t.lat != null && t.lng != null && toaDoHopLe(lat, lng);
  if (!coGps) { if (dn.bat_gps) return loi("thieu-vi-tri"); lat = lng = null; }
  else { lat = lamTron(lat); lng = lamTron(lng); if (saiSo > 200) canhBao.push("gps-yeu"); }
  let cach = null;
  if (vanPhong && dd && coGps && dd.lat != null && dd.lng != null) {
    cach = cachMet(lat, lng, dd.lat, dd.lng);
    if (cach > dd.ban_kinh + Math.min(saiSo, HAN.sai_so_gps_cong_toi_da)) {
      // Đã quét đúng QR ở quầy thì người đang đứng tại quầy: GPS lệch chỉ là cảnh báo. Không QR thì chặn.
      if (!quaQr) return json({ loi: "ngoai-vung", cach_met: cach, ban_kinh: dd.ban_kinh }, 400);
      canhBao.push("xa");
    }
  }

  const ip = req.headers.get("cf-connecting-ip") || "";
  if (vanPhong && dd && String(dd.ip_ds || "").trim()) {
    const khop = dd.ip_ds.split(",").map((s) => s.trim()).filter(Boolean)
      .some((p) => (p.endsWith(".") || p.endsWith(":")) ? ip.startsWith(p) : ip === p);
    if (!khop) canhBao.push("ip-la");
  }

  const anh = typeof t.anh === "string" ? t.anh : "";
  if (anh && !anhHopLe(anh)) return loi("anh-loi");
  if (!anh && dn.bat_selfie) return loi("thieu-anh");

  const id = maNgauNhien(8);
  const lenh = [
    env.DB.prepare(`INSERT INTO cham (id, dn_id, nv_id, loai, luc, dia_diem_id, lat, lng, sai_so, cach_met, ip, qua_qr, co_anh, canh_bao)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, dn.id, toi.id, loai, now, dd ? dd.id : null, lat, lng, coGps ? saiSo : null,
      cach, ip, quaQr, anh ? 1 : 0, canhBao.join(",")),
    ...await luuAnh(env, dn.id, id, anh, now),
  ];
  if (!toi.may_bam) lenh.push(env.DB.prepare("UPDATE nguoi_dung SET may_bam=? WHERE id=? AND may_bam IS NULL").bind(mayBam, toi.id));
  await env.DB.batch(lenh);
  await donAnhCu(env, dn.id, dn.giu_anh_ngay, now);
  return json({ ok: true, cham: { id, loai, luc: now, canh_bao: canhBao, qua_qr: !!quaQr, cach_met: cach, dia_diem: dd && dd.ten } });
}

async function thuCham(env, dn, t) {
  const nv = await env.DB.prepare("SELECT * FROM nguoi_dung WHERE id=? AND dn_id=?").bind(String(t.nv_id || ""), dn.id).first();
  if (!nv) return loi("khong-tim-thay", 404);
  const id = maNgauNhien(8);
  await env.DB.prepare("INSERT INTO cham (id, dn_id, nv_id, loai, luc, canh_bao) VALUES (?,?,?,?,?,?)")
    .bind(id, dn.id, nv.id, t.loai === "ra" ? "ra" : "vao", Number(t.luc) || Date.now(), cat(t.canh_bao, 60)).run();
  return json({ ok: true, id });
}
// Gieo nhiều bản chấm một lượt (đo tải bảng công tháng cho ngàn người). Không kiểm nhân viên từng dòng: chỉ máy thử.
async function thuChamLo(env, dn, t) {
  const ds = Array.isArray(t.ds) ? t.ds.slice(0, 500) : [];
  const lenh = ds.map((x) => env.DB.prepare("INSERT INTO cham (id, dn_id, nv_id, loai, luc, canh_bao) VALUES (?,?,?,?,?,'')")
    .bind(maNgauNhien(8), dn.id, String(x.nv_id), x.loai === "ra" ? "ra" : "vao", Number(x.luc)));
  if (lenh.length) await env.DB.batch(lenh);
  return json({ ok: true, so: lenh.length });
}

// ================= Bảng công =================
async function bangCongNv(env, dn, nv, thangVao) {
  const thang = thangHopLe(thangVao);
  const ngays = ngayTrongThang(thang);
  const ca = nv.ca_id ? await env.DB.prepare("SELECT * FROM ca WHERE id=? AND dn_id=?").bind(nv.ca_id, dn.id).first() : null;
  const ban = await banGhiTu(env, dn.id, nv.id, dauNgay(ngays[0]), dauNgay(congNgay(ngays.at(-1), 1)) + 12 * 3600e3);
  const don = await donDuyet(env, dn.id, nv.id, ngays[0], ngays.at(-1));
  const ky = tinhKy({ ca, ngays, ban, don });
  return json({ thang, nv: { id: nv.id, ten: nv.ten, ma_nv: nv.ma_nv }, ca: ca && { ten: ca.ten, gio_vao: ca.gio_vao, gio_ra: ca.gio_ra },
    cong_chuan: dn.cong_chuan, ...ky });
}

// Khoảng thời gian của một tháng công: thêm 12 giờ sau ngày cuối để bắt giờ ra của ca qua đêm.
const khoangThang = (ngays) => [dauNgay(ngays[0]), dauNgay(congNgay(ngays.at(-1), 1)) + 12 * 3600e3];
// Người đã nghỉ việc chỉ hiện nếu tháng đó còn dữ liệu.
const DK_CO_DU_LIEU = "(n.trang_thai='hoat_dong' OR EXISTS (SELECT 1 FROM cham c WHERE c.dn_id=n.dn_id AND c.nv_id=n.id AND c.luc>=? AND c.luc<?))";

async function tinhChoNv(env, dn, nvs, ngays) {
  const [tu, den] = khoangThang(ngays);
  const [cas, pbs, banTheoNv, don] = await Promise.all([
    mapCa(env, dn), mapPhongBan(env, dn), banGhiNhieu(env, dn.id, nvs.map((n) => n.id), tu, den), donDuyet(env, dn.id, null, ngays[0], ngays.at(-1)),
  ]);
  const donTheoNv = nhom(don, "nv_id");
  return nvs.map((nv) => {
    const ca = cas.get(nv.ca_id) || null;
    const ky = tinhKy({ ca, ngays, ban: banTheoNv.get(nv.id) || [], don: donTheoNv.get(nv.id) || [] });
    return { nv: { id: nv.id, ten: nv.ten, ma_nv: nv.ma_nv, trang_thai: nv.trang_thai, ca: ca?.ten || "", phong_ban: pbs.get(nv.phong_ban_id) || "" }, ...ky };
  });
}
async function bangCong(env, dn, toi, url) {
  const thang = thangHopLe(url.searchParams.get("thang"));
  const ngays = ngayTrongThang(thang), [tu, den] = khoangThang(ngays);
  const { dk, ts } = dieuKienNv(toi, url, { chiHoatDong: false });
  const dieuKien = `${dk} AND ${DK_CO_DU_LIEU}`, thamSo = [...ts, tu, den];
  const trang = trangCua(url), co = HAN.trang_co;
  const [dem, ds] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS so FROM nguoi_dung n WHERE ${dieuKien}`).bind(...thamSo).first(),
    env.DB.prepare(`SELECT n.* FROM nguoi_dung n WHERE ${dieuKien} ORDER BY n.ten_tim LIMIT ? OFFSET ?`).bind(...thamSo, co, (trang - 1) * co).all(),
  ]);
  const kq = await tinhChoNv(env, dn, ds.results, ngays);
  return json({ thang, cong_chuan: dn.cong_chuan, trang, so_trang: Math.max(1, Math.ceil(dem.so / co)), tong_nv: dem.so,
    ds: kq.map((x) => ({ nv: x.nv, tong: x.tong })) });
}
const oCsv = (v) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
async function bangCongCsv(env, dn, toi, url) {
  const thang = thangHopLe(url.searchParams.get("thang")), kieu = url.searchParams.get("kieu");
  const ngays = ngayTrongThang(thang), [tu, den] = khoangThang(ngays);
  const { dk, ts } = dieuKienNv(toi, url, { chiHoatDong: false });
  const { results: nvs } = await env.DB.prepare(`SELECT n.* FROM nguoi_dung n WHERE ${dk} AND ${DK_CO_DU_LIEU} ORDER BY n.ten_tim`).bind(...ts, tu, den).all();
  const ds = await tinhChoNv(env, dn, nvs, ngays);
  const dong = [];
  if (kieu === "chi-tiet") {
    dong.push(["Mã NV", "Họ tên", "Phòng ban", "Ngày", "Trạng thái", "Giờ vào", "Giờ ra", "Công", "Phép", "Đi muộn (phút)", "Về sớm (phút)", "Ở lại (phút)", "Cảnh báo", "Sửa bằng đơn"]);
    const gio = (ms) => ms ? new Date(ms + 7 * 3600e3).toISOString().slice(11, 16) : "";
    for (const x of ds) for (const n of x.ngay)
      if (n.co_ca || n.vao || n.ra) dong.push([x.nv.ma_nv, x.nv.ten, x.nv.phong_ban, n.ngay, n.trang_thai, gio(n.vao), gio(n.ra), n.cong, n.cong_phep,
        n.muon_phut, n.som_phut, n.o_lai_phut, n.canh_bao, n.sua_bang_don ? "có" : ""]);
  } else {
    dong.push(["Mã NV", "Họ tên", "Phòng ban", "Ca", "Ngày có ca", "Công thực", "Công phép", "Nghỉ không lương", "Vắng", "Thiếu giờ ra",
      "Số lần muộn", "Phút muộn", "Phút về sớm", "Phút ở lại", "Lần chấm có cảnh báo"]);
    for (const x of ds) dong.push([x.nv.ma_nv, x.nv.ten, x.nv.phong_ban, x.nv.ca, x.tong.ngay_ca, x.tong.cong, x.tong.cong_phep, x.tong.nghi_kl,
      x.tong.vang, x.tong.thieu_ra, x.tong.lan_muon, x.tong.muon_phut, x.tong.som_phut, x.tong.o_lai_phut, x.tong.canh_bao]);
  }
  // BOM để Excel mở đúng tiếng Việt.
  const chu = "﻿" + dong.map((r) => r.map(oCsv).join(",")).join("\r\n");
  return new Response(chu, { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store",
    "content-disposition": `attachment; filename="bang-cong-${thang}${kieu === "chi-tiet" ? "-chi-tiet" : ""}.csv"` } });
}

// Hôm nay: ô đếm tính trên CẢ phạm vi đang lọc (phòng ban, ô tìm); danh sách thì lọc thêm theo ô bấm rồi chia trang.
async function homNay(env, dn, toi, url) {
  const hom = homNayVn();
  const { dk, ts } = dieuKienNv(toi, url);
  const [{ results: nvs }, { results: ban }, don, cas, pbs, cho] = await Promise.all([
    env.DB.prepare(`SELECT n.id, n.ten, n.ma_nv, n.ca_id, n.che_do, n.mk_bam, n.phong_ban_id FROM nguoi_dung n WHERE ${dk} ORDER BY n.ten_tim`).bind(...ts).all(),
    env.DB.prepare("SELECT nv_id, loai, luc, canh_bao FROM cham WHERE dn_id=? AND luc>=? ORDER BY luc").bind(dn.id, dauNgay(hom) - NGAY).all(),
    donDuyet(env, dn.id, null, congNgay(hom, -1), hom),
    mapCa(env, dn), mapPhongBan(env, dn),
    env.DB.prepare(`SELECT COUNT(*) AS so FROM don d JOIN nguoi_dung n ON n.id=d.nv_id WHERE d.dn_id=? AND d.trang_thai='cho'
      ${pbCua(toi) ? "AND n.phong_ban_id=?" : ""}`).bind(...(pbCua(toi) ? [dn.id, pbCua(toi)] : [dn.id])).first(),
  ]);
  const banTheoNv = nhom(ban, "nv_id"), donTheoNv = nhom(don, "nv_id");
  const ngays = [congNgay(hom, -1), hom];
  const ds = nvs.map((nv) => {
    const ca = cas.get(nv.ca_id) || null;
    const banNv = banTheoNv.get(nv.id) || [];
    const ky = tinhKy({ ca, ngays, ban: banNv, don: donTheoNv.get(nv.id) || [] });
    const ngay = ky.ngay[0].trang_thai === "dang_lam" ? ky.ngay[0] : ky.ngay[1];
    const cb = [...new Set(banNv.filter((b) => b.canh_bao && ganMot(ca, b) === ngay.ngay).flatMap((b) => b.canh_bao.split(",")))];
    return { nv: { id: nv.id, ten: nv.ten, ma_nv: nv.ma_nv, ca: ca?.ten || "", che_do: nv.che_do, da_nhan: !!nv.mk_bam || nv.che_do === "the",
      phong_ban: pbs.get(nv.phong_ban_id) || "" }, ngay, canh_bao: cb };
  });
  const LOC = {
    da_vao: (x) => x.ngay.vao, muon: (x) => x.ngay.muon_phut > 0, chua_vao: (x) => ["chua_vao", "vang"].includes(x.ngay.trang_thai),
    nghi: (x) => ["nghi_phep", "nghi_kl"].includes(x.ngay.trang_thai), canh_bao: (x) => x.canh_bao.length,
  };
  const dem = (f) => ds.filter(f).length;
  const tong = { nv: ds.length, da_vao: dem(LOC.da_vao), muon: dem(LOC.muon), chua_vao: dem(LOC.chua_vao), nghi: dem(LOC.nghi), canh_bao: dem(LOC.canh_bao) };
  const loc = LOC[url.searchParams.get("loc")];
  const sau = loc ? ds.filter(loc) : ds;
  const trang = trangCua(url), co = HAN.trang_co;
  return json({ ngay: hom, don_cho: cho.so, tong, trang, so_trang: Math.max(1, Math.ceil(sau.length / co)), so_dong: sau.length,
    ds: sau.slice((trang - 1) * co, trang * co) });
}

async function chiTietNgay(env, dn, toi, nvId, ngay) {
  const nv = await layNv(env, dn, toi, nvId);
  if (!nv || !ngayHopLe(ngay)) return loi("khong-tim-thay", 404);
  const ca = nv.ca_id ? await env.DB.prepare("SELECT * FROM ca WHERE id=? AND dn_id=?").bind(nv.ca_id, dn.id).first() : null;
  const ban = await banGhiTu(env, dn.id, nv.id, dauNgay(ngay) - NGAY, dauNgay(congNgay(ngay, 1)) + 12 * 3600e3);
  const cua = ban.filter((b) => ganMot(ca, b) === ngay);
  const { results: anh } = await env.DB.prepare(`SELECT cham_id FROM anh_cham WHERE dn_id=? AND cham_id IN (${cua.map(() => "?").join(",") || "''"})`)
    .bind(dn.id, ...cua.map((b) => b.id)).all();
  const conAnh = new Set(anh.map((a) => a.cham_id));
  const { results: dds } = await env.DB.prepare("SELECT id, ten FROM dia_diem WHERE dn_id=?").bind(dn.id).all();
  const tenDd = new Map(dds.map((d) => [d.id, d.ten]));
  return json({ nv: { id: nv.id, ten: nv.ten },
    ngay, ban: cua.map((b) => ({ ...congKhaiCham(b), con_anh: conAnh.has(b.id), dia_diem: tenDd.get(b.dia_diem_id) || "" })) });
}

async function xemAnh(env, dn, toi, chamId) {
  const a = await env.DB.prepare(`SELECT a.du_lieu, a.kho, n.phong_ban_id FROM anh_cham a JOIN cham c ON c.id=a.cham_id
    JOIN nguoi_dung n ON n.id=c.nv_id WHERE a.cham_id=? AND a.dn_id=?`).bind(chamId, dn.id).first();
  if (!a || !trongPhamVi(toi, a)) return loi("khong-tim-thay", 404);
  const dau = { "content-type": "image/jpeg", "cache-control": "private, no-store" };
  if (a.kho === "r2") {
    const o = env.ANH ? await env.ANH.get(khoaR2(dn.id, chamId)) : null;
    return o ? new Response(o.body, { headers: dau }) : loi("khong-tim-thay", 404);
  }
  const b64 = a.du_lieu.slice(a.du_lieu.indexOf(",") + 1);
  return new Response(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), { headers: dau });
}

// ================= Đơn từ =================
async function dsDon(env, toi, url) {
  const tatCa = url.searchParams.get("tat_ca") === "1" && (toi.vai === "chu" || toi.vai === "quan_ly");
  const tt = ["cho", "duyet", "tu_choi", "huy"].includes(url.searchParams.get("trang_thai")) ? url.searchParams.get("trang_thai") : null;
  const dk = ["d.dn_id=?"], ts = [toi.dn_id];
  if (!tatCa) { dk.push("d.nv_id=?"); ts.push(toi.id); }
  else if (pbCua(toi)) { dk.push("n.phong_ban_id=?"); ts.push(pbCua(toi)); }
  if (tt) { dk.push("d.trang_thai=?"); ts.push(tt); }
  const { results } = await env.DB.prepare(`SELECT d.*, n.ten AS nv_ten, n.ma_nv FROM don d JOIN nguoi_dung n ON n.id=d.nv_id
    WHERE ${dk.join(" AND ")} ORDER BY d.tao_luc DESC LIMIT 200`).bind(...ts).all();
  return json({ ds: results });
}
async function taoDon(env, toi, t) {
  const loai = LOAI_DON.includes(t.loai) ? t.loai : null;
  if (!loai) return loi("sai-loai");
  if (!ngayHopLe(t.ngay)) return loi("sai-ngay");
  const hom = homNayVn();
  let denNgay = loai === "quen_cham" ? t.ngay : (ngayHopLe(t.den_ngay) ? t.den_ngay : t.ngay);
  if (denNgay < t.ngay) return loi("sai-ngay");
  if (dsNgay(t.ngay, denNgay).length > 31) return loi("qua-dai");
  let gioVao = null, gioRa = null;
  if (loai === "quen_cham") {
    if (t.ngay > hom) return loi("sai-ngay");
    gioVao = gioHopLe(t.gio_vao) ? t.gio_vao : null; gioRa = gioHopLe(t.gio_ra) ? t.gio_ra : null;
    if (!gioVao && !gioRa) return loi("thieu-gio");
  }
  const lyDo = cat(t.ly_do, 300);
  if (lyDo.length < 3) return loi("thieu-ly-do");
  const id = maNgauNhien(8);
  await env.DB.prepare(`INSERT INTO don (id, dn_id, nv_id, loai, ngay, den_ngay, gio_vao, gio_ra, ly_do, tao_luc) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, toi.dn_id, toi.id, loai, t.ngay, denNgay, gioVao, gioRa, lyDo, Date.now()).run();
  return json({ ok: true, id });
}
async function huyDon(env, toi, id) {
  const r = await env.DB.prepare("UPDATE don SET trang_thai='huy' WHERE id=? AND dn_id=? AND nv_id=? AND trang_thai='cho'").bind(id, toi.dn_id, toi.id).run();
  return r.meta.changes ? json({ ok: true }) : loi("khong-tim-thay", 404);
}
async function xetDon(env, toi, id, viec, t) {
  const d = await env.DB.prepare("SELECT d.*, n.phong_ban_id FROM don d JOIN nguoi_dung n ON n.id=d.nv_id WHERE d.id=? AND d.dn_id=?").bind(id, toi.dn_id).first();
  if (!d || !trongPhamVi(toi, d)) return loi("khong-tim-thay", 404);
  if (d.trang_thai !== "cho") return loi("da-xet", 409);
  // Không ai tự duyệt đơn của mình, trừ chủ doanh nghiệp.
  if (d.nv_id === toi.id && toi.vai !== "chu") return loi("khong-tu-duyet", 403);
  await env.DB.prepare("UPDATE don SET trang_thai=?, nguoi_duyet=?, duyet_luc=?, ghi_chu_duyet=? WHERE id=?")
    .bind(viec === "duyet" ? "duyet" : "tu_choi", toi.id, Date.now(), cat(t.ghi_chu, 200), id).run();
  await nhatKy(env, toi.dn_id, toi.id, "don-" + viec, id);
  return json({ ok: true });
}

// ================= Nhân viên =================
async function dsNv(env, dn, toi, url) {
  const { dk, ts } = dieuKienNv(toi, url, { chiHoatDong: url.searchParams.get("tt") !== "tat_ca" });
  const trang = trangCua(url), co = HAN.trang_co;
  const [dem, ds] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS so FROM nguoi_dung n WHERE ${dk}`).bind(...ts).first(),
    env.DB.prepare(`SELECT n.* FROM nguoi_dung n WHERE ${dk} ORDER BY n.trang_thai, n.ten_tim LIMIT ? OFFSET ?`).bind(...ts, co, (trang - 1) * co).all(),
  ]);
  return json({ ds: ds.results.map(congKhaiNv), trang, so_trang: Math.max(1, Math.ceil(dem.so / co)), tong: dem.so });
}
// Kiểm & chuẩn hoá trường nhân viên. dsCo: bộ tra sẵn khi nhập hàng loạt (khỏi hỏi CSDL từng dòng).
async function kiemTruongNv(env, toi, dn, t, cu, dsCo = null) {
  const ten = cat(t.ten, 60);
  if (ten.length < 2) return { loi: "thieu-ten" };
  const cheDo = CHE_DO.includes(t.che_do) ? t.che_do : (cu ? cu.che_do : "van_phong");
  const sdt = t.sdt ? chuanSdt(t.sdt) : null, email = t.email ? chuanEmail(t.email) : null;
  if (t.sdt && !sdt) return { loi: "sai-sdt" };
  if (t.email && !email) return { loi: "sai-email" };
  // Quẹt thẻ ở cổng thì không cần đăng nhập app; còn lại phải có SĐT hoặc email.
  if (!sdt && !email && cheDo !== "the") return { loi: "thieu-dang-nhap" };
  if (dsCo) {
    if (sdt && dsCo.sdt.has(sdt)) return { loi: "sdt-da-co", s: 409 };
    if (email && dsCo.email.has(email)) return { loi: "email-da-co", s: 409 };
  } else {
    if (sdt && await env.DB.prepare("SELECT 1 FROM nguoi_dung WHERE sdt=? AND id<>?").bind(sdt, cu?.id || "").first()) return { loi: "sdt-da-co", s: 409 };
    if (email && await env.DB.prepare("SELECT 1 FROM nguoi_dung WHERE email=? AND id<>?").bind(email, cu?.id || "").first()) return { loi: "email-da-co", s: 409 };
  }
  const coTrong = async (bang, id) => id && (dsCo ? dsCo[bang].has(String(id))
    : await env.DB.prepare(`SELECT 1 FROM ${bang} WHERE id=? AND dn_id=?`).bind(String(id), dn.id).first()) ? String(id) : null;
  const caId = await coTrong("ca", t.ca_id), ddId = await coTrong("dia_diem", t.dia_diem_id);
  let pbId = await coTrong("phong_ban", t.phong_ban_id);
  if (pbCua(toi)) pbId = pbCua(toi); // quản lý phòng ban chỉ thêm/sửa người vào phòng ban của mình
  let vai = cu ? cu.vai : "nhan_vien", phamVi = cu ? cu.pham_vi : "cong_ty";
  if (cu?.vai !== "chu" && (t.vai === "quan_ly" || t.vai === "nhan_vien")) {
    if ((t.vai !== vai || (t.pham_vi && t.pham_vi !== phamVi)) && toi.vai !== "chu") return { loi: "khong-co-quyen", s: 403 };
    vai = t.vai;
    if (t.pham_vi === "phong_ban" || t.pham_vi === "cong_ty") phamVi = t.pham_vi;
  }
  if (vai === "quan_ly" && phamVi === "phong_ban" && !pbId) return { loi: "can-phong-ban" };
  return { ten, sdt, email, ma_nv: cat(t.ma_nv, 20) || null, che_do: cheDo, ca_id: caId, dia_diem_id: ddId, phong_ban_id: pbId, vai, pham_vi: phamVi };
}
const lenhThemNv = (env, dn, v, id, maMoi) => env.DB.prepare(`INSERT INTO nguoi_dung (id, dn_id, ten, ten_tim, email, sdt, ma_nv, vai, pham_vi,
  che_do, ca_id, dia_diem_id, phong_ban_id, ma_moi, ma_the, tao_luc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(id, dn.id, v.ten, boDau(v.ten), v.email, v.sdt, v.ma_nv, v.vai, v.pham_vi, v.che_do, v.ca_id, v.dia_diem_id, v.phong_ban_id,
    maMoi, maNgauNhien(6), Date.now());
async function themNv(env, toi, dn, t) {
  const dem = await env.DB.prepare("SELECT COUNT(*) AS so FROM nguoi_dung WHERE dn_id=?").bind(dn.id).first();
  if (dem.so >= HAN.nv_toi_da) return loi("qua-gioi-han");
  const v = await kiemTruongNv(env, toi, dn, t, null);
  if (v.loi) return loi(v.loi, v.s || 400);
  // Người quẹt thẻ ở cổng không dùng app nên không có lời mời.
  const id = maNgauNhien(8), maMoi = v.che_do === "the" ? null : maNgauNhien(12);
  await lenhThemNv(env, dn, v, id, maMoi).run();
  await nhatKy(env, dn.id, toi.id, "them-nv", id);
  return json({ ok: true, id, ma_moi: maMoi });
}

// Nhập từ Excel: trình duyệt đọc tệp rồi gửi từng lượt ≤ HAN.nhap_lo dòng. Phòng ban/ca/địa điểm khớp theo TÊN;
// phòng ban chưa có thì tự tạo (nếu người nhập được quyền). Mỗi dòng trả kết quả riêng, dòng lỗi không chặn dòng khác.
const CHE_DO_TEN = { "van phong": "van_phong", "van_phong": "van_phong", "thi truong": "thi_truong", "thi_truong": "thi_truong",
  "di thi truong": "thi_truong", "the": "the", "quet the": "the", "the cong": "the", "office": "van_phong", "field": "thi_truong", "card": "the" };
async function nhapNv(env, toi, dn, t) {
  const dong = Array.isArray(t.dong) ? t.dong.slice(0, HAN.nhap_lo) : [];
  if (!dong.length) return loi("trong");
  const [dem, cas, dds, pbs] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS so FROM nguoi_dung WHERE dn_id=?").bind(dn.id).first(),
    env.DB.prepare("SELECT id, ten FROM ca WHERE dn_id=?").bind(dn.id).all(),
    env.DB.prepare("SELECT id, ten FROM dia_diem WHERE dn_id=?").bind(dn.id).all(),
    env.DB.prepare("SELECT id, ten FROM phong_ban WHERE dn_id=?").bind(dn.id).all(),
  ]);
  const theoTen = (ds) => new Map(ds.results.map((x) => [boDau(x.ten), x.id]));
  const caTen = theoTen(cas), ddTen = theoTen(dds), pbTen = theoTen(pbs);
  const sdts = dong.map((d) => chuanSdt(d.sdt)).filter(Boolean), emails = dong.map((d) => chuanEmail(d.email)).filter(Boolean);
  const daCo = async (cot, ds) => ds.length ? new Set((await env.DB.prepare(`SELECT ${cot} AS v FROM nguoi_dung WHERE ${cot} IN (${ds.map(() => "?").join(",")})`)
    .bind(...ds).all()).results.map((x) => x.v)) : new Set();
  const dsCo = { sdt: await daCo("sdt", sdts), email: await daCo("email", emails),
    ca: new Set(cas.results.map((x) => x.id)), dia_diem: new Set(dds.results.map((x) => x.id)), phong_ban: new Set(pbs.results.map((x) => x.id)) };
  const lenh = [], ket = [];
  let con = HAN.nv_toi_da - dem.so;
  for (let i = 0; i < dong.length; i++) {
    const d = dong[i] || {};
    if (con <= 0) { ket.push({ i, loi: "qua-gioi-han" }); continue; }
    let pbId = null;
    const tenPb = cat(d.phong_ban, 60);
    if (tenPb) {
      pbId = pbTen.get(boDau(tenPb)) || null;
      if (!pbId && !pbCua(toi)) {   // phòng ban mới: tạo luôn
        pbId = maNgauNhien(8); pbTen.set(boDau(tenPb), pbId); dsCo.phong_ban.add(pbId);
        lenh.push(env.DB.prepare("INSERT INTO phong_ban (id, dn_id, ten, tao_luc) VALUES (?,?,?,?)").bind(pbId, dn.id, tenPb, Date.now()));
      }
    }
    const caId = d.ca ? caTen.get(boDau(d.ca)) : (cas.results[0]?.id || null);
    if (d.ca && !caId) { ket.push({ i, loi: "ca-la" }); continue; }
    const ddId = d.dia_diem ? ddTen.get(boDau(d.dia_diem)) : (dds.results[0]?.id || null);
    if (d.dia_diem && !ddId) { ket.push({ i, loi: "dd-la" }); continue; }
    const cheDo = CHE_DO_TEN[boDau(d.che_do)] || "van_phong";
    const v = await kiemTruongNv(env, toi, dn, { ten: d.ten, sdt: d.sdt, email: d.email, ma_nv: d.ma_nv, che_do: cheDo,
      ca_id: caId, dia_diem_id: ddId, phong_ban_id: pbId }, null, dsCo);
    if (v.loi) { ket.push({ i, loi: v.loi }); continue; }
    // Trùng ngay trong tệp: dòng sau bị loại.
    if (v.sdt) dsCo.sdt.add(v.sdt);
    if (v.email) dsCo.email.add(v.email);
    const id = maNgauNhien(8), maMoi = v.che_do === "the" ? null : maNgauNhien(12);
    lenh.push(lenhThemNv(env, dn, v, id, maMoi));
    ket.push({ i, ok: true, id, ma_moi: maMoi, ten: v.ten, sdt: v.sdt, email: v.email });
    con--;
  }
  if (lenh.length) await env.DB.batch(lenh);
  const soOk = ket.filter((k) => k.ok).length;
  if (soOk) await nhatKy(env, dn.id, toi.id, "nhap-nv", String(soOk));
  return json({ ok: true, ket });
}

// Danh sách để in thẻ: mọi người đang làm trong phạm vi lọc; ai chưa có mã thẻ thì cấp luôn.
async function dsThe(env, dn, toi, url) {
  const { dk, ts } = dieuKienNv(toi, url);
  const { results } = await env.DB.prepare(`SELECT n.id, n.ten, n.ma_nv, n.ma_the, n.phong_ban_id FROM nguoi_dung n WHERE ${dk}
    ORDER BY n.ten_tim LIMIT 2000`).bind(...ts).all();
  const thieu = results.filter((n) => !n.ma_the);
  for (const n of thieu) n.ma_the = maNgauNhien(6);
  for (let i = 0; i < thieu.length; i += 100)
    await env.DB.batch(thieu.slice(i, i + 100).map((n) => env.DB.prepare("UPDATE nguoi_dung SET ma_the=? WHERE id=? AND ma_the IS NULL").bind(n.ma_the, n.id)));
  const pbs = await mapPhongBan(env, dn);
  return json({ dn_ten: dn.ten, ds: results.map((n) => ({ id: n.id, ten: n.ten, ma_nv: n.ma_nv, phong_ban: pbs.get(n.phong_ban_id) || "",
    the: `TTCC:${n.id}.${n.ma_the}` })) });
}

async function suaNv(env, toi, dn, id, viec, t) {
  const nv = await layNv(env, dn, toi, id);
  if (!nv) return loi("khong-tim-thay", 404);
  if (nv.vai === "chu" && toi.vai !== "chu") return loi("khong-co-quyen", 403);
  if (viec === "sua") {
    const v = await kiemTruongNv(env, toi, dn, t, nv);
    if (v.loi) return loi(v.loi, v.s || 400);
    await env.DB.prepare(`UPDATE nguoi_dung SET ten=?, ten_tim=?, email=?, sdt=?, ma_nv=?, vai=?, pham_vi=?, che_do=?, ca_id=?, dia_diem_id=?,
      phong_ban_id=? WHERE id=?`).bind(v.ten, boDau(v.ten), v.email, v.sdt, v.ma_nv, v.vai, v.pham_vi, v.che_do, v.ca_id, v.dia_diem_id, v.phong_ban_id, id).run();
  } else if (viec === "doi-may") {
    await env.DB.prepare("UPDATE nguoi_dung SET may_bam=NULL WHERE id=?").bind(id).run();
  } else if (viec === "moi-lai") {
    const ma = maNgauNhien(12);
    await env.DB.prepare("UPDATE nguoi_dung SET ma_moi=? WHERE id=?").bind(ma, id).run();
    await nhatKy(env, dn.id, toi.id, "nv-" + viec, id);
    return json({ ok: true, ma_moi: ma });
  } else if (viec === "cap-the") {
    // Mất thẻ / nghi thẻ bị sao chép: cấp mã mới, thẻ cũ hết dùng ngay.
    await env.DB.prepare("UPDATE nguoi_dung SET ma_the=? WHERE id=?").bind(maNgauNhien(6), id).run();
  } else if (viec === "nghi-viec") {
    if (nv.id === toi.id) return loi("khong-co-quyen", 403);
    await env.DB.batch([
      env.DB.prepare("UPDATE nguoi_dung SET trang_thai='nghi_viec', ma_moi=NULL WHERE id=?").bind(id),
      env.DB.prepare("DELETE FROM phien WHERE nguoi_id=?").bind(id),
    ]);
  } else if (viec === "khoi-phuc") {
    await env.DB.prepare("UPDATE nguoi_dung SET trang_thai='hoat_dong' WHERE id=?").bind(id).run();
  }
  await nhatKy(env, dn.id, toi.id, "nv-" + viec, id);
  return json({ ok: true });
}

// ================= Phòng ban =================
async function dsPhongBan(env, dn) {
  const { results } = await env.DB.prepare(`SELECT p.id, p.ten, (SELECT COUNT(*) FROM nguoi_dung n WHERE n.phong_ban_id=p.id AND n.trang_thai='hoat_dong') AS so_nv
    FROM phong_ban p WHERE p.dn_id=? ORDER BY p.ten`).bind(dn.id).all();
  return json({ ds: results });
}
async function luuPhongBan(env, toi, dn, id, t) {
  const ten = cat(t.ten, 60);
  if (ten.length < 1) return loi("thieu-ten");
  const trung = await env.DB.prepare("SELECT id FROM phong_ban WHERE dn_id=? AND lower(ten)=lower(?) AND id<>?").bind(dn.id, ten, id || "").first();
  if (trung) return loi("pb-trung", 409);
  if (id) {
    const r = await env.DB.prepare("UPDATE phong_ban SET ten=? WHERE id=? AND dn_id=?").bind(ten, id, dn.id).run();
    if (!r.meta.changes) return loi("khong-tim-thay", 404);
  } else {
    id = maNgauNhien(8);
    await env.DB.prepare("INSERT INTO phong_ban (id, dn_id, ten, tao_luc) VALUES (?,?,?,?)").bind(id, dn.id, ten, Date.now()).run();
  }
  await nhatKy(env, dn.id, toi.id, "luu-phong-ban", id);
  return json({ ok: true, id });
}
async function xoaPhongBan(env, toi, dn, id) {
  // Quản lý phòng ban bị xoá phòng ban thì về phạm vi công ty sẽ là mở quyền — nên hạ về nhân viên.
  await env.DB.batch([
    env.DB.prepare("UPDATE nguoi_dung SET vai='nhan_vien', pham_vi='cong_ty' WHERE phong_ban_id=? AND dn_id=? AND vai='quan_ly' AND pham_vi='phong_ban'").bind(id, dn.id),
    env.DB.prepare("UPDATE nguoi_dung SET phong_ban_id=NULL WHERE phong_ban_id=? AND dn_id=?").bind(id, dn.id),
    env.DB.prepare("DELETE FROM phong_ban WHERE id=? AND dn_id=?").bind(id, dn.id),
  ]);
  await nhatKy(env, dn.id, toi.id, "xoa-phong-ban", id);
  return json({ ok: true });
}

// ================= Ca làm & địa điểm =================
async function dsCa(env, dn) {
  const { results } = await env.DB.prepare("SELECT * FROM ca WHERE dn_id=? ORDER BY tao_luc").bind(dn.id).all();
  return json({ ds: results });
}
async function luuCa(env, toi, dn, id, t) {
  const ten = cat(t.ten, 40);
  if (ten.length < 1) return loi("thieu-ten");
  if (!gioHopLe(t.gio_vao) || !gioHopLe(t.gio_ra) || t.gio_vao === t.gio_ra) return loi("sai-gio");
  const ngayLam = [...new Set(String(t.ngay_lam || "").split(",").map((x) => x.trim()).filter((x) => /^[0-6]$/.test(x)))].sort().join(",");
  if (!ngayLam) return loi("thieu-ngay-lam");
  const nghi = soNguyen(t.nghi_phut, 0, 240, 60), cho = soNguyen(t.cho_muon_phut, 0, 120, 5);
  if (id) {
    const r = await env.DB.prepare("UPDATE ca SET ten=?, gio_vao=?, gio_ra=?, nghi_phut=?, cho_muon_phut=?, ngay_lam=? WHERE id=? AND dn_id=?")
      .bind(ten, t.gio_vao, t.gio_ra, nghi, cho, ngayLam, id, dn.id).run();
    if (!r.meta.changes) return loi("khong-tim-thay", 404);
  } else {
    id = maNgauNhien(8);
    await env.DB.prepare("INSERT INTO ca (id, dn_id, ten, gio_vao, gio_ra, nghi_phut, cho_muon_phut, ngay_lam, tao_luc) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(id, dn.id, ten, t.gio_vao, t.gio_ra, nghi, cho, ngayLam, Date.now()).run();
  }
  await nhatKy(env, dn.id, toi.id, "luu-ca", id);
  return json({ ok: true, id });
}
async function xoaCa(env, toi, dn, id) {
  await env.DB.batch([
    env.DB.prepare("UPDATE nguoi_dung SET ca_id=NULL WHERE ca_id=? AND dn_id=?").bind(id, dn.id),
    env.DB.prepare("DELETE FROM ca WHERE id=? AND dn_id=?").bind(id, dn.id),
  ]);
  await nhatKy(env, dn.id, toi.id, "xoa-ca", id);
  return json({ ok: true });
}
async function dsDiaDiem(env, dn, toi) {
  const { results } = await env.DB.prepare("SELECT * FROM dia_diem WHERE dn_id=? ORDER BY tao_luc").bind(dn.id).all();
  // Mã kiosk mở được màn QR / máy quét thẻ: chỉ chủ và quản lý toàn công ty được thấy.
  return json({ ds: pbCua(toi) ? results.map(({ ma_kiosk, ...x }) => x) : results });
}
async function luuDiaDiem(env, toi, dn, id, t) {
  const ten = cat(t.ten, 60);
  if (ten.length < 1) return loi("thieu-ten");
  let lat = t.lat === "" || t.lat == null ? null : Number(t.lat), lng = t.lng === "" || t.lng == null ? null : Number(t.lng);
  if ((lat !== null || lng !== null) && !toaDoHopLe(lat, lng)) return loi("sai-toa-do");
  if (lat !== null) { lat = lamTron(lat); lng = lamTron(lng); }
  const banKinh = soNguyen(t.ban_kinh, 30, 3000, 150);
  const ip = String(t.ip_ds || "").split(",").map((s) => s.trim()).filter((s) => /^[0-9a-fA-F.:]{2,45}$/.test(s)).slice(0, 10).join(",");
  if (id) {
    const r = await env.DB.prepare("UPDATE dia_diem SET ten=?, lat=?, lng=?, ban_kinh=?, ip_ds=? WHERE id=? AND dn_id=?")
      .bind(ten, lat, lng, banKinh, ip, id, dn.id).run();
    if (!r.meta.changes) return loi("khong-tim-thay", 404);
  } else {
    id = maNgauNhien(8);
    await env.DB.prepare("INSERT INTO dia_diem (id, dn_id, ten, lat, lng, ban_kinh, ip_ds, ma_kiosk, tao_luc) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(id, dn.id, ten, lat, lng, banKinh, ip, maNgauNhien(8), Date.now()).run();
  }
  await nhatKy(env, dn.id, toi.id, "luu-dia-diem", id);
  return json({ ok: true, id });
}
async function xoaDiaDiem(env, toi, dn, id) {
  await env.DB.batch([
    env.DB.prepare("UPDATE nguoi_dung SET dia_diem_id=NULL WHERE dia_diem_id=? AND dn_id=?").bind(id, dn.id),
    env.DB.prepare("DELETE FROM dia_diem WHERE id=? AND dn_id=?").bind(id, dn.id),
  ]);
  await nhatKy(env, dn.id, toi.id, "xoa-dia-diem", id);
  return json({ ok: true });
}
async function doiMaKiosk(env, toi, dn, id) {
  const r = await env.DB.prepare("UPDATE dia_diem SET ma_kiosk=? WHERE id=? AND dn_id=?").bind(maNgauNhien(8), id, dn.id).run();
  if (!r.meta.changes) return loi("khong-tim-thay", 404);
  await nhatKy(env, dn.id, toi.id, "doi-ma-kiosk", id);
  return json({ ok: true });
}
async function suaDn(env, toi, dn, t) {
  const ten = cat(t.ten, 80) || dn.ten;
  const b = (k) => (t[k] === undefined ? dn[k] : t[k] ? 1 : 0);
  await env.DB.prepare("UPDATE doanh_nghiep SET ten=?, bat_qr=?, bat_gps=?, bat_selfie=?, giu_anh_ngay=?, cong_chuan=?, ngon_ngu=? WHERE id=?")
    .bind(ten, b("bat_qr"), b("bat_gps"), b("bat_selfie"), soNguyen(t.giu_anh_ngay, 7, 365, dn.giu_anh_ngay),
      soNguyen(t.cong_chuan, 20, 31, dn.cong_chuan), t.ngon_ngu === "en" ? "en" : t.ngon_ngu === "vi" ? "vi" : dn.ngon_ngu, dn.id).run();
  await nhatKy(env, dn.id, toi.id, "sua-dn");
  return json({ ok: true });
}

// ================= Theo dõi lộ trình (GĐ4, công khai, chỉ trong ca) =================
async function phienTheoDoi(env, toi) {
  const p = await env.DB.prepare("SELECT id, bat_luc FROM ca_phien WHERE dn_id=? AND nv_id=? AND tat_luc IS NULL ORDER BY bat_luc DESC LIMIT 1")
    .bind(toi.dn_id, toi.id).first();
  return json({ dong_y: !!toi.theo_doi_dong_y_luc, phien: p ? { id: p.id, bat_luc: p.bat_luc } : null,
    giu_ngay: HAN.vi_tri_giu_ngay, nhip_phut: HAN.theo_doi_song_phut, ban: PHIEN_BAN_CHINH_SACH });
}
async function dongYTheoDoi(env, toi, t) {
  const now = Date.now();
  if (t.rut) { // rút đồng ý = đóng ca + xoá sạch vị trí của chính mình ngay
    await env.DB.batch([
      env.DB.prepare("UPDATE nguoi_dung SET theo_doi_dong_y_luc=NULL, theo_doi_dong_y_ban=NULL WHERE id=?").bind(toi.id),
      env.DB.prepare("UPDATE ca_phien SET tat_luc=? WHERE dn_id=? AND nv_id=? AND tat_luc IS NULL").bind(now, toi.dn_id, toi.id),
      env.DB.prepare("DELETE FROM vi_tri WHERE dn_id=? AND nv_id=?").bind(toi.dn_id, toi.id),
    ]);
    await nhatKy(env, toi.dn_id, toi.id, "rut-dong-y-theo-doi");
    return json({ ok: true, rut: true });
  }
  await env.DB.prepare("UPDATE nguoi_dung SET theo_doi_dong_y_luc=?, theo_doi_dong_y_ban=? WHERE id=?")
    .bind(now, PHIEN_BAN_CHINH_SACH, toi.id).run();
  await nhatKy(env, toi.dn_id, toi.id, "dong-y-theo-doi");
  return json({ ok: true });
}
async function batCa(env, toi, t) {
  if (!toi.theo_doi_dong_y_luc) return loi("thieu-dong-y-theo-doi");
  const now = Date.now(), id = maNgauNhien(8);
  await env.DB.batch([
    env.DB.prepare("UPDATE ca_phien SET tat_luc=? WHERE dn_id=? AND nv_id=? AND tat_luc IS NULL").bind(now, toi.dn_id, toi.id),
    env.DB.prepare("INSERT INTO ca_phien (id, dn_id, nv_id, bat_luc, dong_y_ban, may, tao_luc) VALUES (?,?,?,?,?,?,?)")
      .bind(id, toi.dn_id, toi.id, now, toi.theo_doi_dong_y_ban || PHIEN_BAN_CHINH_SACH, cat(t.may, 40), now),
  ]);
  await nhatKy(env, toi.dn_id, toi.id, "bat-ca", id);
  return json({ ok: true, phien: { id, bat_luc: now } });
}
async function tatCa(env, toi) {
  const r = await env.DB.prepare("UPDATE ca_phien SET tat_luc=? WHERE dn_id=? AND nv_id=? AND tat_luc IS NULL").bind(Date.now(), toi.dn_id, toi.id).run();
  await nhatKy(env, toi.dn_id, toi.id, "tat-ca");
  return json({ ok: true, dong: r.meta.changes });
}
async function napViTri(env, toi, t) {
  const phienId = String(t.phien_id || "");
  const p = await env.DB.prepare("SELECT id, tat_luc FROM ca_phien WHERE id=? AND dn_id=? AND nv_id=?").bind(phienId, toi.dn_id, toi.id).first();
  if (!p) return loi("phien-sai");
  if (p.tat_luc) return loi("phien-dong"); // app bật ca mới rồi nạp tiếp
  const diem = (Array.isArray(t.diem) ? t.diem : []).slice(0, HAN.vi_tri_lo)
    .map((d) => ({ luc: Number(d.luc), lat: Number(d.lat), lng: Number(d.lng),
      do_cx: d.do_cx == null ? null : soNguyen(d.do_cx, 0, 100000, 0),
      pin: d.pin == null ? null : soNguyen(d.pin, 0, 100, 0), toc_do: d.toc_do == null ? null : Number(d.toc_do) }))
    .filter((d) => Number.isFinite(d.luc) && toaDoHopLe(d.lat, d.lng));
  for (let i = 0; i < diem.length; i += 50) {
    await env.DB.batch(diem.slice(i, i + 50).map((d) => env.DB.prepare(
      "INSERT INTO vi_tri (dn_id, nv_id, phien_id, luc, lat, lng, do_cx, pin, toc_do) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(toi.dn_id, toi.id, phienId, d.luc, lamTron(d.lat), lamTron(d.lng), d.do_cx, d.pin, d.toc_do)));
  }
  // Rải tải dọn điểm quá hạn lưu trữ.
  await env.DB.prepare("DELETE FROM vi_tri WHERE dn_id=? AND luc < ?").bind(toi.dn_id, Date.now() - HAN.vi_tri_giu_ngay * 864e5).run();
  return json({ ok: true, so: diem.length });
}
async function themGheTham(env, toi, t) {
  const loai = HAN.ghe_loai.includes(t.loai) ? t.loai : "khach";
  let lat = t.lat == null ? null : Number(t.lat), lng = t.lng == null ? null : Number(t.lng);
  if (lat != null && !toaDoHopLe(lat, lng)) lat = lng = null;
  else if (lat != null) { lat = lamTron(lat); lng = lamTron(lng); }
  let phienId = null;
  if (t.phien_id) {
    const p = await env.DB.prepare("SELECT id FROM ca_phien WHERE id=? AND dn_id=? AND nv_id=? AND tat_luc IS NULL").bind(String(t.phien_id), toi.dn_id, toi.id).first();
    if (p) phienId = p.id;
  }
  const now = Date.now(), id = maNgauNhien(8);
  await env.DB.prepare("INSERT INTO ghe_tham (id, dn_id, nv_id, phien_id, loai, ten, lat, lng, luc_den, ghi_chu, tao_luc) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, toi.dn_id, toi.id, phienId, loai, cat(t.ten, 120), lat, lng, now, cat(t.ghi_chu, 500), now).run();
  return json({ ok: true, id, luc_den: now });
}
async function roiGheTham(env, toi, id) {
  const r = await env.DB.prepare("UPDATE ghe_tham SET luc_di=? WHERE id=? AND dn_id=? AND nv_id=? AND luc_di IS NULL").bind(Date.now(), id, toi.dn_id, toi.id).run();
  return json({ ok: !!r.meta.changes });
}
// Quản lý: bản đồ trực tiếp — vị trí mới nhất mỗi người còn "đang chạy" (có điểm trong cửa sổ song_phut).
async function banDo(env, dn, toi) {
  const pb = pbCua(toi);
  const now = Date.now(), tu = now - HAN.theo_doi_song_phut * 60000;
  const { results: vt } = await env.DB.prepare(
    `SELECT nv_id, lat, lng, luc, do_cx, pin FROM vi_tri
     WHERE dn_id=? AND id IN (SELECT MAX(id) FROM vi_tri WHERE dn_id=? AND luc>=? GROUP BY nv_id)`).bind(dn.id, dn.id, tu).all();
  if (!vt.length) return json({ ds: [], luc: now, song_phut: HAN.theo_doi_song_phut });
  const ids = [...new Set(vt.map((x) => x.nv_id))], ten = new Map();
  for (let i = 0; i < ids.length; i += LO_IN) {
    const lo = ids.slice(i, i + LO_IN);
    const { results } = await env.DB.prepare(
      `SELECT id, ten, ma_nv, phong_ban_id FROM nguoi_dung WHERE dn_id=? AND id IN (${lo.map(() => "?").join(",")})`).bind(dn.id, ...lo).all();
    for (const r of results) ten.set(r.id, r);
  }
  const ds = vt.map((x) => {
    const n = ten.get(x.nv_id);
    if (!n || (pb && n.phong_ban_id !== pb)) return null;
    return { nv_id: x.nv_id, ten: n.ten, ma_nv: n.ma_nv, lat: x.lat, lng: x.lng, luc: x.luc, do_cx: x.do_cx, pin: x.pin, phut: Math.round((now - x.luc) / 60000) };
  }).filter(Boolean);
  return json({ ds, luc: now, song_phut: HAN.theo_doi_song_phut });
}
// Quản lý: lộ trình một người trong một ngày (đường đi + điểm ghé + số km).
async function loTrinh(env, dn, toi, url) {
  const nv = await layNv(env, dn, toi, String(url.searchParams.get("nv") || ""));
  if (!nv) return loi("khong-tim-thay", 404);
  const ng = url.searchParams.get("ngay");
  const ngay = ngayHopLe(ng) ? ng : homNayVn();
  const tu = dauNgay(ngay), den = tu + 864e5;
  const { results: diem } = await env.DB.prepare(
    "SELECT luc, lat, lng, do_cx, pin FROM vi_tri WHERE dn_id=? AND nv_id=? AND luc>=? AND luc<? ORDER BY luc").bind(dn.id, nv.id, tu, den).all();
  const { results: ghe } = await env.DB.prepare(
    "SELECT id, loai, ten, lat, lng, luc_den, luc_di, ghi_chu FROM ghe_tham WHERE dn_id=? AND nv_id=? AND luc_den>=? AND luc_den<? ORDER BY luc_den").bind(dn.id, nv.id, tu, den).all();
  let m = 0;
  for (let i = 1; i < diem.length; i++) {
    const a = diem[i - 1], b = diem[i];
    if ((a.do_cx || 0) > 100 || (b.do_cx || 0) > 100) continue;
    const d = cachMet(a.lat, a.lng, b.lat, b.lng), dt = (b.luc - a.luc) / 1000;
    if (d > 5 && d < dt * 40 + 100) m += d; // bỏ bước nhảy vô lý (> ~144 km/h)
  }
  return json({ nv: { id: nv.id, ten: nv.ten, ma_nv: nv.ma_nv }, ngay, diem, ghe, km: Math.round(m / 100) / 10,
    tu, song_phut: HAN.theo_doi_song_phut });
}
