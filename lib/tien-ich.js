// Tiện ích máy chủ (chép từ trentay-khach-quen): trả JSON, băm mật khẩu, phiên, chặn dò mật khẩu.
import { HAN } from "./cau-hinh.js";

export const json = (o, status = 200, extra = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
export const loi = (ma, status = 400) => json({ loi: ma }, status);

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const maNgauNhien = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));
export const bam256 = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

// 100.000 vòng là trần PBKDF2 của Cloudflare Workers.
export async function bamMatKhau(mk, muoi) {
  muoi = muoi || b64(crypto.getRandomValues(new Uint8Array(16)));
  const khoa = await crypto.subtle.importKey("raw", new TextEncoder().encode(mk), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(muoi), iterations: 100000 }, khoa, 256);
  return { bam: b64(bits), muoi };
}
// So hai chuỗi không để lộ độ dài khớp qua thời gian chạy.
export function bangNhau(a, b) {
  a = String(a); b = String(b);
  let khac = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) khac |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return khac === 0;
}

// ---- Phiên: cookie HttpOnly chứa token, D1 chỉ giữ mã băm ----
const TEN_COOKIE = "cc_phien";
export async function taoPhien(env, nguoiId) {
  const tok = maNgauNhien(32);
  const het = Date.now() + HAN.phien_ngay * 86400e3;
  await env.DB.prepare("INSERT INTO phien (bam, nguoi_id, het_han) VALUES (?,?,?)").bind(await bam256(tok), nguoiId, het).run();
  return `${TEN_COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${HAN.phien_ngay * 86400}`;
}
export const xoaCookie = () => `${TEN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
function docToken(req) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${TEN_COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}
export async function layPhien(env, req) {
  const tok = docToken(req);
  if (!tok) return null;
  const bam = await bam256(tok);
  const p = await env.DB.prepare("SELECT nguoi_id, het_han FROM phien WHERE bam=?").bind(bam).first();
  if (!p || p.het_han < Date.now()) return null;
  return { bam, nguoi_id: p.nguoi_id };
}
export async function huyPhien(env, req) {
  const tok = docToken(req);
  if (tok) await env.DB.prepare("DELETE FROM phien WHERE bam=?").bind(await bam256(tok)).run();
}

// ---- Chặn dò mật khẩu ----
export async function biKhoa(env, khoa) {
  const r = await env.DB.prepare("SELECT so, dau FROM thu_dang_nhap WHERE khoa=?").bind(khoa).first();
  if (!r) return false;
  if (Date.now() - r.dau > HAN.khoa_thu_phut * 60e3) return false;
  return r.so >= HAN.thu_sai_toi_da;
}
export async function ghiSai(env, khoa) {
  const r = await env.DB.prepare("SELECT so, dau FROM thu_dang_nhap WHERE khoa=?").bind(khoa).first();
  const now = Date.now();
  if (!r || now - r.dau > HAN.khoa_thu_phut * 60e3)
    await env.DB.prepare("INSERT OR REPLACE INTO thu_dang_nhap (khoa, so, dau) VALUES (?,1,?)").bind(khoa, now).run();
  else await env.DB.prepare("UPDATE thu_dang_nhap SET so=so+1 WHERE khoa=?").bind(khoa).run();
}
export const xoaSai = (env, khoa) => env.DB.prepare("DELETE FROM thu_dang_nhap WHERE khoa=?").bind(khoa).run();

// ---- Khác ----
export const cat = (s, n) => String(s ?? "").trim().slice(0, n);
export function chuanSdt(s) {
  s = String(s || "").replace(/[\u0300-\u036f]/g, "").replace(/[\s.\-()]/g, "");
  // Excel l\u01b0u S\u0110T d\u1ea1ng s\u1ed1 th\u00ec r\u1ee5ng s\u1ed1 0 \u0111\u1ea7u: 912345678 \u2192 0912345678.
  if (/^[1-9]\d{8}$/.test(s)) s = "0" + s;
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length === 11) s = "0" + s.slice(2);
  return /^0\d{9}$/.test(s) ? s : null;
}
export const chuanEmail = (s) => {
  s = String(s || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
};
export function cachMet(lat1, lng1, lat2, lng2) {
  const R = 6371e3, r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
export const toaDoHopLe = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
// 5 chữ số thập phân ≈ 1 m.
export const lamTron = (x) => Math.round(x * 1e5) / 1e5;

// Mã QR động: HMAC(khoá bí mật của doanh nghiệp, địa điểm + cửa sổ 30 giây). Không lưu, tính lại để so.
export async function maQr(khoa, ddId, cuaSo) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(khoa), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${ddId}:${cuaSo}`));
  return hex(s).slice(0, 12);
}

// Bỏ dấu + chữ thường để tìm tên tiếng Việt ("nguyen van an" khớp "Nguyễn Văn An").
export const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
