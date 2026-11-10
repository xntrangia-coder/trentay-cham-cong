// Lõi tính công: HÀM THUẦN, không đụng CSDL — bộ tự kiểm gọi thẳng được.
// Đầu vào: ca làm, bản ghi thô, đơn đã duyệt. Đầu ra: bảng công từng ngày + tổng tháng.
// Mọi giờ là giờ Việt Nam (+7, không có giờ mùa hè).

export const GIO_VN = 7 * 3600e3, NGAY = 86400e3, PHUT = 60e3;

export const phut = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
export const gioHopLe = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
export const ngayHopLe = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s + "T00:00:00Z"));
export const dauNgay = (ngay) => Date.parse(ngay + "T00:00:00Z") - GIO_VN;      // nửa đêm VN, ms
export const ngayCua = (ms) => new Date(ms + GIO_VN).toISOString().slice(0, 10);
export const gioCua = (ms) => new Date(ms + GIO_VN).toISOString().slice(11, 16);
export const thuCua = (ngay) => new Date(ngay + "T00:00:00Z").getUTCDay();      // 0 = Chủ nhật
export const congNgay = (ngay, n) => new Date(Date.parse(ngay + "T00:00:00Z") + n * NGAY).toISOString().slice(0, 10);

export function dsNgay(tu, den) {
  const ra = [];
  for (let d = tu; d <= den && ra.length < 400; d = congNgay(d, 1)) ra.push(d);
  return ra;
}
export function ngayTrongThang(thang) {               // "2026-11" -> ["2026-11-01", …]
  const tu = thang + "-01";
  const den = congNgay(congNgay(tu, 32).slice(0, 7) + "-01", -1);
  return dsNgay(tu, den);
}

// Khung giờ ca của MỘT ngày; null nếu hôm đó không phải ngày làm.
export function khungCa(ca, ngay) {
  if (!ca) return null;
  const thu = String(ca.ngay_lam || "").split(",").filter((x) => x !== "").map(Number);
  if (!thu.includes(thuCua(ngay))) return null;
  const d = dauNgay(ngay);
  const vao = d + phut(ca.gio_vao) * PHUT;
  let ra = d + phut(ca.gio_ra) * PHUT;
  if (ra <= vao) ra += NGAY;                           // ca qua đêm
  return { vao, ra, nghi: (ca.nghi_phut || 0) * PHUT, cho: (ca.cho_muon_phut || 0) * PHUT, qua_dem: ra - d > NGAY };
}

// Gán mỗi bản ghi vào đúng MỘT ngày công. Bản ghi rạng sáng thuộc ca qua đêm của hôm trước.
export function ganNgay(ca, ban) {
  const nhom = new Map();
  for (const b of ban) {
    let d = ngayCua(b.luc);
    const truoc = khungCa(ca, congNgay(d, -1));
    if (truoc && truoc.qua_dem && b.luc <= truoc.ra + 6 * 3600e3) d = congNgay(d, -1);
    if (!nhom.has(d)) nhom.set(d, []);
    nhom.get(d).push(b);
  }
  for (const ds of nhom.values()) ds.sort((a, b) => a.luc - b.luc);
  return nhom;
}

// Một ngày công. `bayGio` để biết hôm nay còn đang làm hay đã hết ngày.
export function tinhNgay({ ca, ngay, ban = [], don = [], bayGio = Date.now() }) {
  const k = khungCa(ca, ngay);
  const ra = { ngay, co_ca: !!k, vao: null, ra: null, trang_thai: "", cong: 0, cong_phep: 0, nghi_kl: 0,
    muon_phut: 0, som_phut: 0, o_lai_phut: 0, lam_phut: 0, canh_bao: 0, sua_bang_don: false };

  const nghi = don.find((x) => x.loai === "nghi_phep" || x.loai === "nghi_khong_luong");
  if (nghi && k) {
    ra.trang_thai = nghi.loai === "nghi_phep" ? "nghi_phep" : "nghi_kl";
    if (nghi.loai === "nghi_phep") ra.cong_phep = 1; else ra.nghi_kl = 1;
    return ra;
  }

  let vao = ban.find((b) => b.loai === "vao");
  let tra = [...ban].reverse().find((b) => b.loai === "ra" && (!vao || b.luc > vao.luc));
  let tVao = vao ? vao.luc : null, tRa = tra ? tra.luc : null;
  ra.canh_bao = ban.filter((b) => b.canh_bao).length;

  const quen = don.find((x) => x.loai === "quen_cham");
  if (quen) {
    const d = dauNgay(ngay);
    if (quen.gio_vao && tVao === null) { tVao = d + phut(quen.gio_vao) * PHUT; ra.sua_bang_don = true; }
    if (quen.gio_ra && tRa === null) {
      tRa = d + phut(quen.gio_ra) * PHUT;
      if (tVao !== null && tRa <= tVao) tRa += NGAY;
      ra.sua_bang_don = true;
    }
  }
  ra.vao = tVao; ra.ra = tRa;

  const hetNgay = k ? bayGio > k.ra : bayGio >= dauNgay(congNgay(ngay, 1));
  if (tVao === null) {
    if (!k) ra.trang_thai = tRa ? "ngoai_ca" : "nghi";
    else ra.trang_thai = bayGio < k.vao ? "chua_den" : hetNgay ? "vang" : "chua_vao";
    return ra;
  }
  if (tRa === null) { ra.trang_thai = hetNgay ? "thieu_ra" : "dang_lam"; return ra; }

  if (!k) {                                            // làm ngày không có ca: ghi giờ, chưa tính công
    ra.lam_phut = Math.round((tRa - tVao) / PHUT);
    ra.trang_thai = "ngoai_ca";
    return ra;
  }
  const dauCa = k.ra - k.vao;
  let lam = Math.max(0, Math.min(tRa, k.ra) - Math.max(tVao, k.vao));
  if (lam > dauCa / 2) lam = Math.max(0, lam - k.nghi);  // làm quá nửa ca thì trừ giờ nghỉ trưa
  const chuan = Math.max(PHUT, dauCa - k.nghi);
  ra.lam_phut = Math.round(lam / PHUT);
  ra.cong = Math.round(Math.min(1, lam / chuan) * 100) / 100;
  if (tVao > k.vao + k.cho) ra.muon_phut = Math.round((tVao - k.vao) / PHUT);  // quá ngưỡng thì tính từ đầu ca
  if (tRa < k.ra) ra.som_phut = Math.round((k.ra - tRa) / PHUT);
  if (tRa > k.ra) ra.o_lai_phut = Math.round((tRa - k.ra) / PHUT);
  ra.trang_thai = ra.muon_phut ? "muon" : ra.som_phut ? "ve_som" : "du";
  return ra;
}

// Đơn duyệt áp cho ngày nào (đơn nghỉ có thể nhiều ngày).
export function donCuaNgay(dsDon, ngay) {
  return dsDon.filter((d) => d.trang_thai === "duyet" && d.ngay <= ngay && ngay <= d.den_ngay);
}

export function tinhKy({ ca, ngays, ban, don, bayGio = Date.now() }) {
  const nhom = ganNgay(ca, ban);
  const ngayCong = ngays.map((ngay) => tinhNgay({ ca, ngay, ban: nhom.get(ngay) || [], don: donCuaNgay(don, ngay), bayGio }));
  const tong = { cong: 0, cong_phep: 0, nghi_kl: 0, lan_muon: 0, muon_phut: 0, som_phut: 0, o_lai_phut: 0,
    vang: 0, thieu_ra: 0, canh_bao: 0, ngay_ca: 0 };
  for (const x of ngayCong) {
    tong.cong += x.cong; tong.cong_phep += x.cong_phep; tong.nghi_kl += x.nghi_kl;
    if (x.muon_phut) { tong.lan_muon++; tong.muon_phut += x.muon_phut; }
    tong.som_phut += x.som_phut; tong.o_lai_phut += x.o_lai_phut; tong.canh_bao += x.canh_bao;
    if (x.trang_thai === "vang") tong.vang++;
    if (x.trang_thai === "thieu_ra") tong.thieu_ra++;
    if (x.co_ca) tong.ngay_ca++;
  }
  tong.cong = Math.round(tong.cong * 100) / 100;
  return { ngay: ngayCong, tong };
}
