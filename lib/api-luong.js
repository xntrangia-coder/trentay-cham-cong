// API GĐ3 tính lương — tách khỏi [[duong]].js cho dễ đọc. Mọi câu SQL nghiệp vụ có dn_id=? (luật bất biến 1).
// `c` là bộ trợ thủ do bộ định tuyến chính đưa vào (để không import vòng).
import { json, loi, maNgauNhien, cat, cachMet, toaDoHopLe, lamTron } from "./tien-ich.js";
import { gioHopLe, ngayHopLe, ngayTrongThang, congNgay, thuCua, dsNgay } from "./tinh-cong.js";
import { tinhLuongNv, soGioBuoi, heSoBuoi } from "./tinh-luong.js";
import { tokenBase, kiemKetNoi, dayLarkThang } from "./lark-luong.js";
import { luatCho, KIEU_THUE_MAU, BAC_GV_MAU, HE_SO_MAU, HE_SO_LAM_THEM, LOAI_NGAY } from "./luat-luong.js";

const CACH_TINH = ["thang", "gio", "khoan"], THUE = ["luy_tien", "khau_tru", "khong_cu_tru", "khong"], NHOM_HS = ["khung_gio", "hinh_thuc", "loai_lop"];
const tien = (x) => { const n = Math.round(Number(String(x ?? "").replace(/[^\d.-]/g, ""))); return Number.isFinite(n) && n >= 0 ? Math.min(n, 2e9) : 0; };
const tienHoacNull = (x) => (x === "" || x == null ? null : tien(x));
const MO = { "bat-dau": "dang_day", "ket-thuc": "xong" };

// ---- Thiết lập: tự gieo bộ mẫu lần đầu công ty mở phần lương ----
async function khoiTao(env, dn) {
  const co = await env.DB.prepare("SELECT 1 FROM kieu_thue WHERE dn_id=? LIMIT 1").bind(dn.id).first();
  if (co) return;
  const now = Date.now();
  await env.DB.batch([
    ...KIEU_THUE_MAU.map((k, i) => env.DB.prepare("INSERT INTO kieu_thue (id, dn_id, ten, cach_tinh, dong_bh, thue, tao_luc) VALUES (?,?,?,?,?,?,?)")
      .bind(maNgauNhien(8), dn.id, k.ten, k.cach_tinh, k.dong_bh, k.thue, now + i)),
    ...BAC_GV_MAU.map((b, i) => env.DB.prepare("INSERT INTO bac_gv (id, dn_id, ten, don_gia, tao_luc) VALUES (?,?,?,?,?)")
      .bind(maNgauNhien(8), dn.id, b.ten, b.don_gia, now + i)),
    ...HE_SO_MAU.map((h, i) => env.DB.prepare("INSERT INTO he_so (id, dn_id, nhom, ten, gia_tri, ma, gio_tu, gio_den, thu, tao_luc) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(maNgauNhien(8), dn.id, h.nhom, h.ten, h.gia_tri, h.ma || null, h.gio_tu || null, h.gio_den || null, h.thu || null, now + i)),
  ]);
}
async function thietLap(env, dn) {
  await khoiTao(env, dn);
  const [kt, bg, hs] = await Promise.all([
    env.DB.prepare("SELECT * FROM kieu_thue WHERE dn_id=? ORDER BY tao_luc").bind(dn.id).all(),
    env.DB.prepare("SELECT * FROM bac_gv WHERE dn_id=? ORDER BY tao_luc").bind(dn.id).all(),
    env.DB.prepare("SELECT * FROM he_so WHERE dn_id=? ORDER BY nhom, tao_luc").bind(dn.id).all(),
  ]);
  return { kieu_thue: kt.results, bac_gv: bg.results, he_so: hs.results };
}

async function luuKieuThue(env, dn, id, t) {
  const ten = cat(t.ten, 60); if (ten.length < 2) return loi("thieu-ten");
  const ct = CACH_TINH.includes(t.cach_tinh) ? t.cach_tinh : "thang", th = THUE.includes(t.thue) ? t.thue : "luy_tien";
  const bh = t.dong_bh ? 1 : 0;
  if (id) {
    const r = await env.DB.prepare("UPDATE kieu_thue SET ten=?, cach_tinh=?, dong_bh=?, thue=? WHERE id=? AND dn_id=?").bind(ten, ct, bh, th, id, dn.id).run();
    if (!r.meta.changes) return loi("khong-tim-thay", 404);
  } else {
    id = maNgauNhien(8);
    await env.DB.prepare("INSERT INTO kieu_thue (id, dn_id, ten, cach_tinh, dong_bh, thue, tao_luc) VALUES (?,?,?,?,?,?,?)").bind(id, dn.id, ten, ct, bh, th, Date.now()).run();
  }
  return json({ ok: true, id });
}
async function luuBacGv(env, dn, id, t) {
  const ten = cat(t.ten, 60); if (ten.length < 2) return loi("thieu-ten");
  const dg = tien(t.don_gia);
  if (id) {
    const r = await env.DB.prepare("UPDATE bac_gv SET ten=?, don_gia=? WHERE id=? AND dn_id=?").bind(ten, dg, id, dn.id).run();
    if (!r.meta.changes) return loi("khong-tim-thay", 404);
  } else {
    id = maNgauNhien(8);
    await env.DB.prepare("INSERT INTO bac_gv (id, dn_id, ten, don_gia, tao_luc) VALUES (?,?,?,?,?)").bind(id, dn.id, ten, dg, Date.now()).run();
  }
  return json({ ok: true, id });
}
async function luuHeSo(env, dn, id, t) {
  const ten = cat(t.ten, 60); if (ten.length < 1) return loi("thieu-ten");
  const nhom = NHOM_HS.includes(t.nhom) ? t.nhom : null; if (!nhom && !id) return loi("sai-loai");
  const gt = Math.round(Math.min(10, Math.max(0, Number(t.gia_tri) || 1)) * 1000) / 1000;
  const gioTu = gioHopLe(t.gio_tu) ? t.gio_tu : null, gioDen = gioHopLe(t.gio_den) ? t.gio_den : null;
  const thu = [...new Set(String(t.thu || "").split(",").map((x) => x.trim()).filter((x) => /^[0-6]$/.test(x)))].join(",") || null;
  if (id) {
    const r = await env.DB.prepare("UPDATE he_so SET ten=?, gia_tri=?, gio_tu=?, gio_den=?, thu=? WHERE id=? AND dn_id=?").bind(ten, gt, gioTu, gioDen, thu, id, dn.id).run();
    if (!r.meta.changes) return loi("khong-tim-thay", 404);
  } else {
    id = maNgauNhien(8);
    await env.DB.prepare("INSERT INTO he_so (id, dn_id, nhom, ten, gia_tri, gio_tu, gio_den, thu, tao_luc) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(id, dn.id, nhom, ten, gt, gioTu, gioDen, thu, Date.now()).run();
  }
  return json({ ok: true, id });
}
async function xoa(env, dn, bang, id) {
  if (bang === "kieu_thue" && await env.DB.prepare("SELECT 1 FROM cong_viec WHERE dn_id=? AND kieu_thue_id=? AND con_hieu_luc=1 LIMIT 1").bind(dn.id, id).first())
    return loi("dang-dung", 409);
  if (bang === "he_so" && await env.DB.prepare("SELECT 1 FROM he_so WHERE id=? AND dn_id=? AND nhom='hinh_thuc'").bind(id, dn.id).first())
    return loi("khong-xoa-duoc", 409);
  await env.DB.prepare(`DELETE FROM ${bang} WHERE id=? AND dn_id=?`).bind(id, dn.id).run();
  return json({ ok: true });
}

// ---- Dòng công việc của một người ----
async function dsCongViec(env, dn, nvId) {
  const { results } = await env.DB.prepare(`SELECT cv.*, kt.ten AS kieu_ten, kt.cach_tinh, kt.dong_bh, kt.thue, bg.ten AS bac_ten, bg.don_gia AS bac_don_gia
    FROM cong_viec cv JOIN kieu_thue kt ON kt.id=cv.kieu_thue_id LEFT JOIN bac_gv bg ON bg.id=cv.bac_gv_id
    WHERE cv.dn_id=? AND cv.nv_id=? AND cv.con_hieu_luc=1 ORDER BY cv.tao_luc`).bind(dn.id, nvId).all();
  return results.map((x) => ({ ...x, don_gia: x.don_gia_rieng ?? x.bac_don_gia ?? 0 }));
}
async function luuCongViec(env, dn, nvId, id, t) {
  const ten = cat(t.ten_vai, 60); if (ten.length < 2) return loi("thieu-ten");
  const kt = await env.DB.prepare("SELECT * FROM kieu_thue WHERE id=? AND dn_id=?").bind(String(t.kieu_thue_id || ""), dn.id).first();
  if (!kt) return loi("thieu-kieu-thue");
  const bac = t.bac_gv_id ? await env.DB.prepare("SELECT id FROM bac_gv WHERE id=? AND dn_id=?").bind(String(t.bac_gv_id), dn.id).first() : null;
  const v = [ten, kt.id, tien(t.luong_thang), bac ? bac.id : null, tienHoacNull(t.don_gia_rieng), tienHoacNull(t.luong_bh), t.bh_cty_chiu_het ? 1 : 0,
    tien(t.pc_dt), tien(t.pc_xang), tien(t.pc_nha), tien(t.pc_khac), t.pc_mien_thue ? 1 : 0];
  if (id) {
    const r = await env.DB.prepare(`UPDATE cong_viec SET ten_vai=?, kieu_thue_id=?, luong_thang=?, bac_gv_id=?, don_gia_rieng=?, luong_bh=?, bh_cty_chiu_het=?,
      pc_dt=?, pc_xang=?, pc_nha=?, pc_khac=?, pc_mien_thue=? WHERE id=? AND dn_id=? AND nv_id=?`).bind(...v, id, dn.id, nvId).run();
    if (!r.meta.changes) return loi("khong-tim-thay", 404);
  } else {
    id = maNgauNhien(8);
    await env.DB.prepare(`INSERT INTO cong_viec (ten_vai, kieu_thue_id, luong_thang, bac_gv_id, don_gia_rieng, luong_bh, bh_cty_chiu_het,
      pc_dt, pc_xang, pc_nha, pc_khac, pc_mien_thue, id, dn_id, nv_id, tao_luc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...v, id, dn.id, nvId, Date.now()).run();
  }
  return json({ ok: true, id });
}

// ---- Buổi dạy ----
const congKhaiBuoi = (b) => ({ id: b.id, nv_id: b.nv_id, nv_ten: b.nv_ten, cv_id: b.cv_id, lop: b.lop, loai_lop_id: b.loai_lop_id, ngay: b.ngay,
  gio_bd: b.gio_bd, gio_kt: b.gio_kt, hinh_thuc: b.hinh_thuc, dia_diem_id: b.dia_diem_id, dia_diem: b.dd_ten, trang_thai: b.trang_thai,
  bat_luc: b.bat_luc, ket_luc: b.ket_luc, cach_met: b.cach_met, canh_bao: b.canh_bao ? b.canh_bao.split(",") : [], tao_boi_gv: b.tao_boi === b.nv_id,
  so_gio: soGioBuoi(b) });
async function dsBuoi(env, dn, { nvId, tu, den, pb }) {
  const dk = ["b.dn_id=?", "b.ngay>=?", "b.ngay<=?"], ts = [dn.id, tu, den];
  if (nvId) { dk.push("b.nv_id=?"); ts.push(nvId); }
  if (pb) { dk.push("n.phong_ban_id=?"); ts.push(pb); }
  const { results } = await env.DB.prepare(`SELECT b.*, n.ten AS nv_ten, d.ten AS dd_ten FROM buoi_day b JOIN nguoi_dung n ON n.id=b.nv_id
    LEFT JOIN dia_diem d ON d.id=b.dia_diem_id WHERE ${dk.join(" AND ")} ORDER BY b.ngay, b.gio_bd LIMIT 2000`).bind(...ts).all();
  return results;
}
async function kiemBuoi(env, dn, t, nvId) {
  if (!ngayHopLe(t.ngay)) return { loi: "sai-ngay" };
  if (!gioHopLe(t.gio_bd) || !gioHopLe(t.gio_kt) || t.gio_bd === t.gio_kt) return { loi: "sai-gio" };
  const cv = await env.DB.prepare(`SELECT cv.id FROM cong_viec cv JOIN kieu_thue kt ON kt.id=cv.kieu_thue_id
    WHERE cv.id=? AND cv.dn_id=? AND cv.nv_id=? AND cv.con_hieu_luc=1 AND kt.cach_tinh='gio'`).bind(String(t.cv_id || ""), dn.id, nvId).first();
  if (!cv) return { loi: "thieu-viec-day" };
  const hinhThuc = t.hinh_thuc === "online" ? "online" : "offline";
  let dd = null;
  if (hinhThuc === "offline") {
    dd = await env.DB.prepare("SELECT id FROM dia_diem WHERE id=? AND dn_id=?").bind(String(t.dia_diem_id || ""), dn.id).first();
    if (!dd) return { loi: "thieu-co-so" };
  }
  const ll = t.loai_lop_id ? await env.DB.prepare("SELECT id FROM he_so WHERE id=? AND dn_id=? AND nhom='loai_lop'").bind(String(t.loai_lop_id), dn.id).first() : null;
  return { v: { cv_id: cv.id, lop: cat(t.lop, 60), loai_lop_id: ll ? ll.id : null, gio_bd: t.gio_bd, gio_kt: t.gio_kt, hinh_thuc: hinhThuc, dia_diem_id: dd ? dd.id : null } };
}
// Quản lý xếp buổi (có thể lặp hằng tuần tới một ngày), hoặc giáo viên tự thêm buổi dạy phát sinh.
async function themBuoi(env, dn, toi, nvId, t) {
  const k = await kiemBuoi(env, dn, t, nvId); if (k.loi) return loi(k.loi);
  let ngays = [t.ngay];
  if (ngayHopLe(t.lap_den) && t.lap_den > t.ngay) ngays = dsNgay(t.ngay, t.lap_den).filter((d) => thuCua(d) === thuCua(t.ngay)).slice(0, 60);
  const now = Date.now(), v = k.v;
  await env.DB.batch(ngays.map((ngay) => env.DB.prepare(`INSERT INTO buoi_day (id, dn_id, nv_id, cv_id, lop, loai_lop_id, ngay, gio_bd, gio_kt, hinh_thuc, dia_diem_id, tao_boi, tao_luc)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(maNgauNhien(8), dn.id, nvId, v.cv_id, v.lop, v.loai_lop_id, ngay, v.gio_bd, v.gio_kt, v.hinh_thuc, v.dia_diem_id, toi.id, now)));
  return json({ ok: true, so: ngays.length });
}
// Giáo viên bấm Bắt đầu / Kết thúc buổi. Offline: GPS phải trong bán kính cơ sở CỦA BUỔI.
async function xacNhanBuoi(env, c, toi, dn, id, viec, t) {
  const b = await env.DB.prepare("SELECT * FROM buoi_day WHERE id=? AND dn_id=? AND nv_id=?").bind(id, dn.id, toi.id).first();
  if (!b) return loi("khong-tim-thay", 404);
  if (viec === "bat-dau" && b.trang_thai !== "ke_hoach") return loi("da-bat-dau", 409);
  if (viec === "ket-thuc" && b.trang_thai !== "dang_day") return loi("chua-bat-dau", 409);
  const now = Date.now();
  if (viec === "bat-dau" && b.ngay !== c.homNayVn()) return loi("khong-phai-hom-nay");
  const canhBao = b.canh_bao ? b.canh_bao.split(",") : [];
  let lat = null, lng = null, cach = null;
  if (b.hinh_thuc === "offline") {
    lat = Number(t.lat); lng = Number(t.lng);
    if (t.lat == null || !toaDoHopLe(lat, lng)) return loi("thieu-vi-tri");
    lat = lamTron(lat); lng = lamTron(lng);
    const dd = await env.DB.prepare("SELECT * FROM dia_diem WHERE id=? AND dn_id=?").bind(b.dia_diem_id, dn.id).first();
    if (dd && dd.lat != null) {
      cach = cachMet(lat, lng, dd.lat, dd.lng);
      const sai = Math.min(Number(t.sai_so) || 0, 80);
      if (cach > dd.ban_kinh + sai) return json({ loi: "ngoai-vung", cach_met: cach, ban_kinh: dd.ban_kinh, co_so: dd.ten }, 400);
    } else canhBao.push("co-so-chua-toa-do");
  }
  if (viec === "bat-dau") {
    // Bắt đầu trễ hơn 15 phút so với lịch thì ghi cảnh báo — tiền vẫn theo giờ lịch, quản lý xem lại.
    const [h, m] = b.gio_bd.split(":").map(Number);
    const lich = Date.parse(b.ngay + "T00:00:00Z") - 7 * 3600e3 + (h * 60 + m) * 60e3;
    if (now > lich + 15 * 60e3) canhBao.push("bat-dau-tre");
  }
  const sets = viec === "bat-dau" ? "bat_luc=?, lat=?, lng=?, cach_met=?" : "ket_luc=?";
  const vals = viec === "bat-dau" ? [now, lat, lng, cach] : [now];
  const anh = typeof t.anh === "string" && t.anh.startsWith("data:image/") ? t.anh : "";
  const lenh = [env.DB.prepare(`UPDATE buoi_day SET trang_thai=?, ${sets}, canh_bao=?, co_anh=MAX(co_anh, ?) WHERE id=? AND dn_id=?`)
    .bind(MO[viec], ...vals, [...new Set(canhBao)].join(","), anh ? 1 : 0, id, dn.id)];
  if (anh) lenh.push(...await c.luuAnh(env, dn.id, `b${id.slice(1)}`.slice(0, 16), anh, now));
  await env.DB.batch(lenh);
  return json({ ok: true, trang_thai: MO[viec], cach_met: cach });
}

// ---- Làm thêm giờ ----
async function dsLamThem(env, dn, { nvId, tu, den, pb }) {
  const dk = ["l.dn_id=?", "l.ngay>=?", "l.ngay<=?"], ts = [dn.id, tu, den];
  if (nvId) { dk.push("l.nv_id=?"); ts.push(nvId); }
  if (pb) { dk.push("n.phong_ban_id=?"); ts.push(pb); }
  const { results } = await env.DB.prepare(`SELECT l.*, n.ten AS nv_ten, cv.ten_vai FROM lam_them l JOIN nguoi_dung n ON n.id=l.nv_id
    LEFT JOIN cong_viec cv ON cv.id=l.cv_id WHERE ${dk.join(" AND ")} ORDER BY l.ngay DESC, l.tao_luc DESC LIMIT 1000`).bind(...ts).all();
  return results;
}
async function taoLamThem(env, dn, toi, t) {
  if (!ngayHopLe(t.ngay)) return loi("sai-ngay");
  const gio = Math.round(Number(t.so_gio) * 4) / 4;
  if (!(gio > 0 && gio <= 12)) return loi("sai-so-gio");
  const cv = await env.DB.prepare("SELECT id FROM cong_viec WHERE id=? AND dn_id=? AND nv_id=? AND con_hieu_luc=1").bind(String(t.cv_id || ""), dn.id, toi.id).first();
  if (!cv) return loi("thieu-viec");
  const lyDo = cat(t.ly_do, 300); if (lyDo.length < 3) return loi("thieu-ly-do");
  await env.DB.prepare("INSERT INTO lam_them (id, dn_id, nv_id, cv_id, ngay, so_gio, loai_ngay, ly_do, tao_luc) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(maNgauNhien(8), dn.id, toi.id, cv.id, t.ngay, gio, LOAI_NGAY.includes(t.loai_ngay) ? t.loai_ngay : "thuong", lyDo, Date.now()).run();
  return json({ ok: true });
}

// ---- Bảng lương ----
async function tinhBangLuong(env, c, dn, toi, thang) {
  const ngays = ngayTrongThang(thang), tu = ngays[0], den = ngays.at(-1);
  const pb = c.pbCua(toi);
  const { results: cvAll } = await env.DB.prepare(`SELECT cv.*, kt.cach_tinh, kt.dong_bh, kt.thue, kt.ten AS kieu_ten, bg.don_gia AS bac_don_gia
    FROM cong_viec cv JOIN kieu_thue kt ON kt.id=cv.kieu_thue_id LEFT JOIN bac_gv bg ON bg.id=cv.bac_gv_id
    JOIN nguoi_dung n ON n.id=cv.nv_id WHERE cv.dn_id=? AND cv.con_hieu_luc=1 ${pb ? "AND n.phong_ban_id=?" : ""}`).bind(...(pb ? [dn.id, pb] : [dn.id])).all();
  if (!cvAll.length) return [];
  const cvTheoNv = new Map();
  for (const cv of cvAll) { cv.don_gia = cv.don_gia_rieng ?? cv.bac_don_gia ?? 0; if (!cvTheoNv.has(cv.nv_id)) cvTheoNv.set(cv.nv_id, []); cvTheoNv.get(cv.nv_id).push(cv); }
  const ids = [...cvTheoNv.keys()];
  const nvs = [];
  for (let i = 0; i < ids.length; i += 90) {
    const lo = ids.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT * FROM nguoi_dung WHERE dn_id=? AND id IN (${lo.map(() => "?").join(",")})`).bind(dn.id, ...lo).all();
    nvs.push(...results);
  }
  nvs.sort((a, b) => (a.ten_tim || "").localeCompare(b.ten_tim || ""));
  const canCong = nvs.filter((n) => cvTheoNv.get(n.id).some((cv) => cv.cach_tinh === "thang"));
  const [cong, buoi, lt, hs, pbs] = await Promise.all([
    canCong.length ? c.tinhChoNv(env, dn, canCong, ngays) : [],
    dsBuoi(env, dn, { tu, den, pb }),
    dsLamThem(env, dn, { tu, den, pb }),
    env.DB.prepare("SELECT * FROM he_so WHERE dn_id=?").bind(dn.id).all(),
    c.mapPhongBan(env, dn),
  ]);
  const congTheoNv = new Map(cong.map((x) => [x.nv.id, x.ngay]));
  const buoiTinh = buoi.filter((b) => b.trang_thai === "xong" || b.trang_thai === "duyet");
  const buoiTheoNv = new Map(), ltTheoNv = new Map();
  for (const b of buoiTinh) { if (!buoiTheoNv.has(b.nv_id)) buoiTheoNv.set(b.nv_id, []); buoiTheoNv.get(b.nv_id).push(b); }
  for (const x of lt.filter((x) => x.trang_thai === "duyet")) { if (!ltTheoNv.has(x.nv_id)) ltTheoNv.set(x.nv_id, []); ltTheoNv.get(x.nv_id).push(x); }
  const choDuyet = buoi.filter((b) => b.trang_thai === "ke_hoach" || b.trang_thai === "dang_day");
  return nvs.map((nv) => {
    const kq = tinhLuongNv({ thang, cvs: cvTheoNv.get(nv.id), ngayCong: congTheoNv.get(nv.id) || [], congChuan: dn.cong_chuan,
      buoi: buoiTheoNv.get(nv.id) || [], bangHeSo: hs.results, lamThem: ltTheoNv.get(nv.id) || [], soPhuThuoc: nv.so_phu_thuoc || 0 });
    const chuaXong = choDuyet.filter((b) => b.nv_id === nv.id && b.ngay < c.homNayVn()).length;
    if (chuaXong) kq.canh_bao.push({ ma: "buoi-chua-xac-nhan", chu: `${chuaXong} buổi dạy đã qua nhưng chưa xác nhận — chưa tính tiền.` });
    if (nv.gpld_het && nv.gpld_het <= congNgay(c.homNayVn(), 45))
      kq.canh_bao.push({ ma: "gpld", chu: `Giấy phép lao động hết hạn ${nv.gpld_het}.` });
    return { nv: { id: nv.id, ten: nv.ten, ma_nv: nv.ma_nv, phong_ban: pbs.get(nv.phong_ban_id) || "", so_phu_thuoc: nv.so_phu_thuoc || 0 }, ...kq };
  });
}
async function layKy(env, dn, thang) {
  const k = await env.DB.prepare("SELECT * FROM ky_luong WHERE dn_id=? AND thang=?").bind(dn.id, thang).first();
  return k ? { khoa_luc: k.khoa_luc, ds: JSON.parse(k.du_lieu) } : null;
}
async function bangLuong(env, c, dn, toi, thang) {
  const ky = await layKy(env, dn, thang);
  let ds = ky ? ky.ds : await tinhBangLuong(env, c, dn, toi, thang);
  const pb = c.pbCua(toi);
  if (ky && pb) { const pbTen = (await c.mapPhongBan(env, dn)).get(pb); ds = ds.filter((x) => x.nv.phong_ban === pbTen); }
  const tong = { tong_thu_nhap: 0, bh_nld_tra: 0, bh_cty: 0, thue: 0, thuc_linh: 0, dot1: 0, dot2: 0, chi_phi_cty: 0 };
  for (const x of ds) { for (const k of Object.keys(tong)) tong[k] += k === "bh_cty" ? x.bh_cty.cong + x.bh_cty_dong_thay : x[k]; }
  const L = luatCho(thang);
  return { thang, khoa: ky ? ky.khoa_luc : null, cong_chuan: dn.cong_chuan, luat: { tu: L.tu, chac: L.chac, nguon: L.nguon }, tong, ds };
}
const oCsv = (v) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function csvLuong(bl, kieu) {
  const d = [];
  if (kieu === "dot1") {
    d.push(["Mã NV", "Họ tên", "Phòng ban", "Lương đóng BH", "Phụ cấp", "Tổng thu nhập đợt 1", "BHXH NLĐ 8%", "BHYT NLĐ 1,5%", "BHTN NLĐ 1%",
      "Cộng BH NLĐ trừ lương", "BH công ty 21,5%", "BH công ty đóng thay NLĐ", "KPCĐ 2%", "Thu nhập chịu thuế", "Giảm trừ gia cảnh", "Thu nhập tính thuế",
      "Thuế TNCN", "Thực lĩnh đợt 1"]);
    for (const x of bl.ds) d.push([x.nv.ma_nv, x.nv.ten, x.nv.phong_ban, x.luong_bh, x.phu_cap, x.dot1_gross, x.bh_nld.bhxh, x.bh_nld.bhyt, x.bh_nld.bhtn,
      x.bh_nld_tra, x.bh_cty.cong, x.bh_cty_dong_thay, x.kpcd, x.tn_chiu_thue, x.giam_tru, x.tn_tinh_thue, x.thue, x.dot1]);
  } else {
    d.push(["Mã NV", "Họ tên", "Phòng ban", "Công việc", "Lương cơ bản / tiền dạy", "Làm thêm giờ", "Phụ cấp", "Tổng thu nhập", "BH trừ lương", "Thuế TNCN",
      "Thực lĩnh", "Đợt 1", "Đợt 2", "Chi phí công ty", "Cảnh báo"]);
    for (const x of bl.ds) d.push([x.nv.ma_nv, x.nv.ten, x.nv.phong_ban, x.dong.map((v) => v.ten_vai).join(" + "), x.dong.reduce((s, v) => s + v.co_ban, 0),
      x.lam_them, x.phu_cap, x.tong_thu_nhap, x.bh_nld_tra, x.thue, x.thuc_linh, x.dot1, x.dot2, x.chi_phi_cty, x.canh_bao.map((c) => c.chu).join(" | ")]);
  }
  return "﻿" + d.map((r) => r.map(oCsv).join(",")).join("\r\n");
}

// ---- Lark: mỗi công ty tự khai app Lark + Base; secret không bao giờ trả ra ----
const cfgLark = (dn) => dn.lark_app_id && dn.lark_secret && dn.lark_base ? { app_id: dn.lark_app_id, secret: dn.lark_secret, base: dn.lark_base } : null;
async function dayLark(env, c, dn, toi, thang) {
  const cfg = cfgLark(dn); if (!cfg) return { ok: false, loi: "chua-noi-lark" };
  const ngays = ngayTrongThang(thang);
  const pb = c.pbCua(toi);
  const [bl, nvs, buoi] = await Promise.all([
    bangLuong(env, c, dn, toi, thang),
    env.DB.prepare(`SELECT * FROM nguoi_dung n WHERE n.dn_id=? AND n.trang_thai='hoat_dong' ${pb ? "AND n.phong_ban_id=?" : ""} ORDER BY n.ten_tim`)
      .bind(...(pb ? [dn.id, pb] : [dn.id])).all(),
    dsBuoi(env, dn, { tu: ngays[0], den: ngays.at(-1), pb }),
  ]);
  const cong = nvs.results.length ? await c.tinhChoNv(env, dn, nvs.results, ngays) : [];
  const day = {};
  for (const b of buoi) if (b.trang_thai === "xong" || b.trang_thai === "duyet") {
    const d = day[b.nv_id] || (day[b.nv_id] = { gio: 0, buoi: 0 }); d.gio = Math.round((d.gio + soGioBuoi(b)) * 100) / 100; d.buoi++;
  }
  try {
    const kq = await dayLarkThang(cfg, thang, { ds: bl.ds, khoa: !!bl.khoa }, { ds: cong, day });
    const ghi = `${thang} · lương ${kq.luong.ghi} · công ${kq.cong.ghi} dòng · ${new Date().toISOString()}`;
    await env.DB.prepare("UPDATE doanh_nghiep SET lark_lan_cuoi=? WHERE id=?").bind(ghi, dn.id).run();
    return { ok: true, ghi: kq.luong.ghi, ghi_cong: kq.cong.ghi, xoa: kq.luong.xoa };
  } catch (e) { return { ok: false, loi: "lark", chi_tiet: String(e.message || e).slice(0, 200) }; }
}

// ================= Định tuyến =================
export async function dinhTuyenLuong(env, req, pt, duong, t, url, c) {
  const { toi, dn } = c;
  let m;
  const qt = toi.vai === "chu" || toi.vai === "quan_ly", toanCty = qt && !c.pbCua(toi);
  const thang = c.thangHopLe(url.searchParams.get("thang"));
  const ngays = ngayTrongThang(thang);

  // ---- Mọi người: việc của tôi, buổi dạy, làm thêm, phiếu lương ----
  if (duong === "luong/cua-toi" && pt === "GET") {
    const cvs = await dsCongViec(env, dn, toi.id);
    const hs = (await env.DB.prepare("SELECT id, nhom, ten, ma FROM he_so WHERE dn_id=? AND nhom IN ('loai_lop','hinh_thuc')").bind(dn.id).all()).results;
    const dd = (await env.DB.prepare("SELECT id, ten FROM dia_diem WHERE dn_id=? ORDER BY tao_luc").bind(dn.id).all()).results;
    return json({ cong_viec: cvs.map((x) => ({ id: x.id, ten_vai: x.ten_vai, cach_tinh: x.cach_tinh })), loai_lop: hs.filter((x) => x.nhom === "loai_lop"), dia_diem: dd });
  }
  if (duong === "day/cua-toi" && pt === "GET") {
    const tu = congNgay(c.homNayVn(), -7), den = congNgay(c.homNayVn(), 14);
    return json({ hom_nay: c.homNayVn(), ds: (await dsBuoi(env, dn, { nvId: toi.id, tu, den })).map(congKhaiBuoi) });
  }
  if (duong === "day" && pt === "POST") return themBuoi(env, dn, toi, toi.id, t);
  if ((m = duong.match(/^day\/([a-f0-9]{16})\/(bat-dau|ket-thuc)$/)) && pt === "POST") return xacNhanBuoi(env, c, toi, dn, m[1], m[2], t);
  if (duong === "lam-them/cua-toi" && pt === "GET")
    return json({ ds: await dsLamThem(env, dn, { nvId: toi.id, tu: congNgay(c.homNayVn(), -92), den: congNgay(c.homNayVn(), 31) }) });
  if (duong === "lam-them" && pt === "POST") return taoLamThem(env, dn, toi, t);
  if ((m = duong.match(/^lam-them\/([a-f0-9]{16})\/huy$/)) && pt === "POST") {
    const r = await env.DB.prepare("DELETE FROM lam_them WHERE id=? AND dn_id=? AND nv_id=? AND trang_thai='cho'").bind(m[1], dn.id, toi.id).run();
    return r.meta.changes ? json({ ok: true }) : loi("khong-tim-thay", 404);
  }
  // Phiếu lương: nhân viên chỉ thấy khi kỳ đã khoá (số tạm tính còn đổi, đưa ra là gây hiểu lầm).
  if (duong === "phieu-luong" && pt === "GET") {
    const ky = await layKy(env, dn, thang);
    const cua = ky && ky.ds.find((x) => x.nv.id === toi.id);
    return json({ thang, khoa: ky ? ky.khoa_luc : null, phieu: cua || null });
  }

  if (!qt) return loi("khong-co-quyen", 403);
  // ---- Quản trị ----
  if (duong === "luong/thiet-lap" && pt === "GET") return json({ ...(await thietLap(env, dn)), he_so_lam_them: HE_SO_LAM_THEM, luat: luatCho(c.homNayVn().slice(0, 7)) });
  if (/^luong\/(kieu-thue|bac-gv|he-so)/.test(duong) && pt === "POST") {
    if (!toanCty) return loi("khong-co-quyen", 403);
    if ((m = duong.match(/^luong\/(kieu-thue|bac-gv|he-so)(?:\/([a-f0-9]{16})\/(sua|xoa))?$/))) {
      const bang = { "kieu-thue": "kieu_thue", "bac-gv": "bac_gv", "he-so": "he_so" }[m[1]];
      if (m[3] === "xoa") return xoa(env, dn, bang, m[2]);
      const luu = { kieu_thue: luuKieuThue, bac_gv: luuBacGv, he_so: luuHeSo }[bang];
      return luu(env, dn, m[2] || null, t);
    }
  }
  if ((m = duong.match(/^nv\/([a-f0-9]{16})\/cong-viec$/))) {
    const nv = await c.layNv(env, dn, toi, m[1]); if (!nv) return loi("khong-tim-thay", 404);
    if (pt === "GET") return json({ nv: { id: nv.id, ten: nv.ten, so_phu_thuoc: nv.so_phu_thuoc || 0, gpld_het: nv.gpld_het || "" }, ds: await dsCongViec(env, dn, nv.id) });
    return luuCongViec(env, dn, nv.id, null, t);
  }
  if ((m = duong.match(/^nv\/([a-f0-9]{16})\/cong-viec\/([a-f0-9]{16})\/(sua|xoa)$/)) && pt === "POST") {
    const nv = await c.layNv(env, dn, toi, m[1]); if (!nv) return loi("khong-tim-thay", 404);
    if (m[3] === "xoa") { await env.DB.prepare("UPDATE cong_viec SET con_hieu_luc=0 WHERE id=? AND dn_id=? AND nv_id=?").bind(m[2], dn.id, nv.id).run(); return json({ ok: true }); }
    return luuCongViec(env, dn, nv.id, m[2], t);
  }
  if ((m = duong.match(/^nv\/([a-f0-9]{16})\/thue$/)) && pt === "POST") {
    const nv = await c.layNv(env, dn, toi, m[1]); if (!nv) return loi("khong-tim-thay", 404);
    const pt2 = Math.min(20, Math.max(0, Math.round(Number(t.so_phu_thuoc) || 0)));
    await env.DB.prepare("UPDATE nguoi_dung SET so_phu_thuoc=?, gpld_het=? WHERE id=? AND dn_id=?").bind(pt2, ngayHopLe(t.gpld_het) ? t.gpld_het : null, nv.id, dn.id).run();
    return json({ ok: true });
  }
  if (duong === "buoi-day" && pt === "GET") {
    const tu = ngayHopLe(url.searchParams.get("tu")) ? url.searchParams.get("tu") : ngays[0];
    const den = ngayHopLe(url.searchParams.get("den")) ? url.searchParams.get("den") : ngays.at(-1);
    const nvId = /^[a-f0-9]{16}$/.test(url.searchParams.get("nv") || "") ? url.searchParams.get("nv") : null;
    const [ds, gv] = await Promise.all([dsBuoi(env, dn, { nvId, tu, den, pb: c.pbCua(toi) }),
      env.DB.prepare(`SELECT DISTINCT n.id, n.ten, cv.id AS cv_id, cv.ten_vai FROM cong_viec cv JOIN kieu_thue kt ON kt.id=cv.kieu_thue_id
        JOIN nguoi_dung n ON n.id=cv.nv_id WHERE cv.dn_id=? AND cv.con_hieu_luc=1 AND kt.cach_tinh='gio' AND n.trang_thai='hoat_dong'
        ${c.pbCua(toi) ? "AND n.phong_ban_id=?" : ""} ORDER BY n.ten_tim`).bind(...(c.pbCua(toi) ? [dn.id, c.pbCua(toi)] : [dn.id])).all()]);
    const hs = (await env.DB.prepare("SELECT * FROM he_so WHERE dn_id=?").bind(dn.id).all()).results;
    return json({ tu, den, ds: ds.map((b) => ({ ...congKhaiBuoi(b), he_so: heSoBuoi(b, hs).tong })), giao_vien: gv.results,
      loai_lop: hs.filter((x) => x.nhom === "loai_lop") });
  }
  if (duong === "buoi-day" && pt === "POST") {
    const nv = await c.layNv(env, dn, toi, String(t.nv_id || "")); if (!nv) return loi("khong-tim-thay", 404);
    return themBuoi(env, dn, toi, nv.id, t);
  }
  if ((m = duong.match(/^buoi-day\/([a-f0-9]{16})\/(duyet|huy|mo-lai)$/)) && pt === "POST") {
    const b = await env.DB.prepare("SELECT b.*, n.phong_ban_id FROM buoi_day b JOIN nguoi_dung n ON n.id=b.nv_id WHERE b.id=? AND b.dn_id=?").bind(m[1], dn.id).first();
    if (!b || (c.pbCua(toi) && b.phong_ban_id !== c.pbCua(toi))) return loi("khong-tim-thay", 404);
    if (await layKy(env, dn, b.ngay.slice(0, 7))) return loi("ky-da-khoa", 409);
    const tt = { duyet: "duyet", huy: "huy", "mo-lai": "ke_hoach" }[m[2]];
    await env.DB.prepare("UPDATE buoi_day SET trang_thai=? WHERE id=? AND dn_id=?").bind(tt, b.id, dn.id).run();
    await c.nhatKy(env, dn.id, toi.id, "buoi-" + m[2], b.id);
    return json({ ok: true });
  }
  if (duong === "lam-them" && pt === "GET")
    return json({ ds: await dsLamThem(env, dn, { tu: ngays[0], den: ngays.at(-1), pb: c.pbCua(toi) }), he_so: HE_SO_LAM_THEM, toi_thieu: luatCho(thang).lam_them_toi_thieu });
  if ((m = duong.match(/^lam-them\/([a-f0-9]{16})\/(duyet|tu-choi)$/)) && pt === "POST") {
    const x = await env.DB.prepare("SELECT l.*, n.phong_ban_id FROM lam_them l JOIN nguoi_dung n ON n.id=l.nv_id WHERE l.id=? AND l.dn_id=?").bind(m[1], dn.id).first();
    if (!x || (c.pbCua(toi) && x.phong_ban_id !== c.pbCua(toi))) return loi("khong-tim-thay", 404);
    if (x.trang_thai !== "cho") return loi("da-xet", 409);
    if (x.nv_id === toi.id && toi.vai !== "chu") return loi("khong-tu-duyet", 403);
    const hs = Number(t.he_so);
    if (m[2] === "duyet" && !HE_SO_LAM_THEM.includes(hs)) return loi("sai-he-so");
    await env.DB.prepare("UPDATE lam_them SET trang_thai=?, he_so=?, nguoi_duyet=?, duyet_luc=? WHERE id=? AND dn_id=?")
      .bind(m[2] === "duyet" ? "duyet" : "tu_choi", m[2] === "duyet" ? hs : null, toi.id, Date.now(), x.id, dn.id).run();
    await c.nhatKy(env, dn.id, toi.id, "lam-them-" + m[2], x.id);
    return json({ ok: true });
  }
  if (duong === "bang-luong" && pt === "GET") return json(await bangLuong(env, c, dn, toi, thang));
  if (duong === "bang-luong.csv" && pt === "GET") {
    const kieu = url.searchParams.get("kieu") === "dot1" ? "dot1" : "tong";
    return new Response(csvLuong(await bangLuong(env, c, dn, toi, thang), kieu), { headers: { "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store", "content-disposition": `attachment; filename="bang-luong-${thang}-${kieu === "dot1" ? "dot1-bhxh" : "tong-hop"}.csv"` } });
  }
  if (duong === "bang-luong/khoa" && pt === "POST") {
    if (!toanCty) return loi("khong-co-quyen", 403);
    const th = c.thangHopLe(t.thang);
    if (await layKy(env, dn, th)) return loi("ky-da-khoa", 409);
    const ds = await tinhBangLuong(env, c, dn, toi, th);
    await env.DB.prepare("INSERT INTO ky_luong (dn_id, thang, du_lieu, khoa_luc, khoa_boi) VALUES (?,?,?,?,?)").bind(dn.id, th, JSON.stringify(ds), Date.now(), toi.id).run();
    await c.nhatKy(env, dn.id, toi.id, "khoa-ky-luong", th);
    // Đã nối Lark thì khoá kỳ là tự đẩy bảng chốt sang Lark (đè bản tạm tính của tháng đó).
    const lark = cfgLark(dn) ? await dayLark(env, c, dn, toi, th) : null;
    return json({ ok: true, lark });
  }
  if (duong === "bang-luong/day-lark" && pt === "POST") {
    if (!toanCty) return loi("khong-co-quyen", 403);
    const kq = await dayLark(env, c, dn, toi, c.thangHopLe(t.thang));
    return kq.ok ? json(kq) : json(kq, kq.loi === "chua-noi-lark" ? 400 : 502);
  }
  if (duong === "luong/lark" && pt === "GET")
    return json({ app_id: dn.lark_app_id || "", base: dn.lark_base || "", co_secret: !!dn.lark_secret, lan_cuoi: dn.lark_lan_cuoi || "" });
  if (duong === "luong/lark" && pt === "POST") {
    if (toi.vai !== "chu") return loi("khong-co-quyen", 403);
    if (t.xoa) { await env.DB.prepare("UPDATE doanh_nghiep SET lark_app_id=NULL, lark_secret=NULL, lark_base=NULL WHERE id=?").bind(dn.id).run(); return json({ ok: true }); }
    const appId = cat(t.app_id, 40), base = tokenBase(t.base), secret = cat(t.secret, 80) || dn.lark_secret;
    if (!/^cli_[a-z0-9]{8,30}$/i.test(appId)) return loi("sai-app-id");
    if (!base) return loi("sai-base");
    if (!secret) return loi("thieu-secret");
    try { await kiemKetNoi({ app_id: appId, secret, base }); }
    catch (e) { return json({ loi: "lark", chi_tiet: String(e.message || e).slice(0, 200) }, 502); }
    await env.DB.prepare("UPDATE doanh_nghiep SET lark_app_id=?, lark_secret=?, lark_base=? WHERE id=?").bind(appId, secret, base, dn.id).run();
    await c.nhatKy(env, dn.id, toi.id, "noi-lark");
    return json({ ok: true });
  }
  if (duong === "bang-luong/mo-khoa" && pt === "POST") {
    if (toi.vai !== "chu") return loi("khong-co-quyen", 403);
    const th = c.thangHopLe(t.thang);
    await env.DB.prepare("DELETE FROM ky_luong WHERE dn_id=? AND thang=?").bind(dn.id, th).run();
    await c.nhatKy(env, dn.id, toi.id, "mo-khoa-ky-luong", th);
    return json({ ok: true });
  }
  // Máy thử: ghi buổi dạy đã xong ở ngày quá khứ (bộ tự kiểm + dữ liệu mẫu).
  if (duong === "thu/buoi-xong" && pt === "POST" && env.CC_THU === "1") {
    const k = await kiemBuoi(env, dn, t, String(t.nv_id || "")); if (k.loi) return loi(k.loi);
    const v = k.v;
    await env.DB.prepare(`INSERT INTO buoi_day (id, dn_id, nv_id, cv_id, lop, loai_lop_id, ngay, gio_bd, gio_kt, hinh_thuc, dia_diem_id, trang_thai, bat_luc, ket_luc, tao_boi, tao_luc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(maNgauNhien(8), dn.id, t.nv_id, v.cv_id, v.lop, v.loai_lop_id, t.ngay, v.gio_bd, v.gio_kt, v.hinh_thuc, v.dia_diem_id,
      t.trang_thai === "ke_hoach" ? "ke_hoach" : "xong", Date.now(), Date.now(), toi.id, Date.now()).run();
    return json({ ok: true });
  }
  return null;
}
