// Đẩy bảng lương + bảng công sang Lark Base CỦA TỪNG CÔNG TY (mỗi công ty tự khai app Lark + link Base trong Cài đặt).
// Bảng "Bảng lương" tự tạo nếu chưa có. Đẩy lại một tháng = xoá các dòng của tháng đó rồi ghi mới (không đẻ trùng).
// App Secret chỉ ghi vào CSDL, KHÔNG bao giờ trả ra giao diện.
export const LARK = "https://open.larksuite.com";
export const TEN_BANG = "Bảng lương";

const T = 1, SO = 2;
export const COT = [
  ["Kỳ lương", T], ["Mã NV", T], ["Họ tên", T], ["Phòng ban", T], ["Công việc", T],
  ["Lương / tiền dạy", SO], ["Làm thêm giờ", SO], ["Phụ cấp", SO], ["Tổng thu nhập", SO], ["Lương đóng BH", SO],
  ["BH trừ lương", SO], ["BH công ty đóng", SO], ["KPCĐ", SO], ["Thuế TNCN", SO], ["Thực lĩnh", SO], ["Đợt 1", SO], ["Đợt 2", SO],
  ["Chi phí công ty", SO], ["Trạng thái", T], ["Cảnh báo", T], ["Mã dòng", T],
];

// Nhận cả link Base (https://x.larksuite.com/base/<token>?table=…) lẫn token trần.
export function tokenBase(s) {
  const m = String(s || "").match(/\/base\/([A-Za-z0-9]{10,40})/) || String(s || "").trim().match(/^([A-Za-z0-9]{10,40})$/);
  return m ? m[1] : null;
}

// Một dòng bảng lương (kết quả tinhBangLuong) → các ô Lark. Hàm THUẦN để bộ tự kiểm gọi được.
export function dongLark(x, thang, khoa) {
  return {
    "Kỳ lương": thang, "Mã NV": x.nv.ma_nv || "", "Họ tên": x.nv.ten, "Phòng ban": x.nv.phong_ban || "",
    "Công việc": x.dong.map((v) => v.ten_vai).join(" + "),
    "Lương / tiền dạy": x.dong.reduce((s, v) => s + v.co_ban, 0), "Làm thêm giờ": x.lam_them, "Phụ cấp": x.phu_cap,
    "Tổng thu nhập": x.tong_thu_nhap, "Lương đóng BH": x.luong_bh, "BH trừ lương": x.bh_nld_tra,
    "BH công ty đóng": x.bh_cty.cong + x.bh_cty_dong_thay, "KPCĐ": x.kpcd, "Thuế TNCN": x.thue, "Thực lĩnh": x.thuc_linh,
    "Đợt 1": x.dot1, "Đợt 2": x.dot2, "Chi phí công ty": x.chi_phi_cty, "Trạng thái": khoa ? "Đã khoá" : "Tạm tính",
    "Cảnh báo": x.canh_bao.map((c) => c.chu).join(" | "), "Mã dòng": `${thang}|${x.nv.id}`,
  };
}

async function goi(url, token, body, method) {
  const r = await fetch(LARK + url, { method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ code: -1, msg: "Lark trả về không đọc được (HTTP " + r.status + ")" }));
  if (j.code && j.code !== 0) { const e = new Error(`Lark ${j.code}: ${j.msg || ""}`); e.ma = j.code; throw e; }
  return j.data || j;
}
async function layToken(appId, secret) {
  const j = await goi("/open-apis/auth/v3/tenant_access_token/internal", null, { app_id: appId, app_secret: secret });
  if (!j.tenant_access_token) throw new Error("Lark không cấp token — kiểm App ID / App Secret.");
  return j.tenant_access_token;
}

// Bảng công tháng (chấm công) — cùng Base, bảng riêng.
export const TEN_BANG_CONG = "Bảng công";
export const COT_CONG = [
  ["Kỳ công", T], ["Mã NV", T], ["Họ tên", T], ["Phòng ban", T], ["Ca", T], ["Ngày có ca", SO], ["Công thực", SO], ["Công phép", SO],
  ["Nghỉ không lương", SO], ["Vắng", SO], ["Thiếu giờ ra", SO], ["Số lần muộn", SO], ["Phút muộn", SO], ["Phút về sớm", SO],
  ["Phút ở lại", SO], ["Lần chấm có cảnh báo", SO], ["Giờ dạy", SO], ["Buổi dạy", SO], ["Mã dòng", T],
];
export function dongCong(x, thang, day = {}) {
  const t = x.tong, d = day[x.nv.id] || { gio: 0, buoi: 0 };
  return { "Kỳ công": thang, "Mã NV": x.nv.ma_nv || "", "Họ tên": x.nv.ten, "Phòng ban": x.nv.phong_ban || "", "Ca": x.nv.ca || "",
    "Ngày có ca": t.ngay_ca, "Công thực": t.cong, "Công phép": t.cong_phep, "Nghỉ không lương": t.nghi_kl, "Vắng": t.vang, "Thiếu giờ ra": t.thieu_ra,
    "Số lần muộn": t.lan_muon, "Phút muộn": t.muon_phut, "Phút về sớm": t.som_phut, "Phút ở lại": t.o_lai_phut, "Lần chấm có cảnh báo": t.canh_bao,
    "Giờ dạy": d.gio, "Buổi dạy": d.buoi, "Mã dòng": `${thang}|${x.nv.id}` };
}

const truongSo = (type) => (type === SO ? { property: { formatter: "1,000" } } : {});
// Tìm (hoặc tạo) bảng theo TÊN; bảng có sẵn mà thiếu cột thì thêm cột. Trả table_id.
async function damBaoBang(token, base, ten, cot) {
  const ds = await goi(`/open-apis/bitable/v1/apps/${base}/tables?page_size=100`, token);
  const bang = (ds.items || []).find((t) => t.name === ten);
  if (!bang) {
    const t = await goi(`/open-apis/bitable/v1/apps/${base}/tables`, token,
      { table: { name: ten, default_view_name: "Tất cả", fields: cot.map(([field_name, type]) => ({ field_name, type, ...truongSo(type) })) } });
    return t.table_id;
  }
  const f = await goi(`/open-apis/bitable/v1/apps/${base}/tables/${bang.table_id}/fields?page_size=100`, token);
  const co = new Set((f.items || []).map((x) => x.field_name));
  for (const [field_name, type] of cot) if (!co.has(field_name))
    await goi(`/open-apis/bitable/v1/apps/${base}/tables/${bang.table_id}/fields`, token, { field_name, type, ...truongSo(type) });
  return bang.table_id;
}
// Thay trọn các dòng của MỘT tháng: xoá dòng cũ có cùng kỳ rồi ghi mới (đẩy lại nhiều lần vẫn chỉ một bộ).
async function thayThang(token, base, bang, cotKy, thang, dong) {
  const goc = `/open-apis/bitable/v1/apps/${base}/tables/${bang}/records`;
  let xoa = 0;
  for (let vong = 0; vong < 20; vong++) {
    const d = await goi(`${goc}/search?page_size=500`, token,
      { field_names: [cotKy], filter: { conjunction: "and", conditions: [{ field_name: cotKy, operator: "is", value: [thang] }] } });
    const ids = (d.items || []).map((r) => r.record_id);
    if (!ids.length) break;
    await goi(`${goc}/batch_delete`, token, { records: ids });
    xoa += ids.length;
  }
  for (let i = 0; i < dong.length; i += 500) await goi(`${goc}/batch_create`, token, { records: dong.slice(i, i + 500).map((fields) => ({ fields })) });
  return { bang, ghi: dong.length, xoa };
}

export async function kiemKetNoi(cfg) {
  const token = await layToken(cfg.app_id, cfg.secret);
  return { bang: await damBaoBang(token, cfg.base, TEN_BANG, COT), bang_cong: await damBaoBang(token, cfg.base, TEN_BANG_CONG, COT_CONG) };
}
// luong: { ds, khoa } (bảng lương) · cong: { ds, day } (bảng công + giờ dạy) — đẩy cả hai trong một lượt.
export async function dayLarkThang(cfg, thang, luong, cong) {
  const token = await layToken(cfg.app_id, cfg.secret);
  const kq = {};
  if (luong) kq.luong = await thayThang(token, cfg.base, await damBaoBang(token, cfg.base, TEN_BANG, COT), "Kỳ lương", thang,
    luong.ds.map((x) => dongLark(x, thang, luong.khoa)));
  if (cong) kq.cong = await thayThang(token, cfg.base, await damBaoBang(token, cfg.base, TEN_BANG_CONG, COT_CONG), "Kỳ công", thang,
    cong.ds.map((x) => dongCong(x, thang, cong.day)));
  return kq;
}
