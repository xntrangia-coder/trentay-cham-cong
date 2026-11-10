// Chạy TRỌN luồng nhân viên thị trường trên Chrome thật (khung điện thoại, GPS giả):
// nhận lời mời → đồng ý theo dõi → BẮT ĐẦU CA → app tự gửi vị trí → đánh dấu điểm ghé.
// Rồi QUẢN LÝ (chủ) đọc /api/ban-do thấy người này đang chạy. Chụp 2 màn.
//   node chup-lo-trinh.mjs [http://127.0.0.1:8811]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GOC = process.argv[2] || "http://127.0.0.1:8811";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RA = new URL("./anh-chup/", import.meta.url);
fs.mkdirSync(RA, { recursive: true });
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let dat = 0, truot = 0;
const kiem = (ten, ok, them = "") => { ok ? dat++ : truot++; console.log(`${ok ? "✔" : "✖"} ${ten}${ok ? "" : "  " + JSON.stringify(them)}`); };

// 1) node: chủ + nhân viên thị trường
async function goi(duong, than, cookie) {
  const r = await fetch(GOC + "/api/" + duong, { method: than === undefined ? "GET" : "POST",
    headers: { "x-cc": "1", "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: than === undefined ? undefined : JSON.stringify(than) });
  const sc = r.headers.get("set-cookie");
  return { s: r.status, d: await r.json().catch(() => ({})), cookie: sc ? sc.split(";")[0] : null };
}
const EM = `lotrinh-${Date.now()}@thu.vn`, now = Date.now();
let r = await goi("dang-ky", { ten_dn: "Thử lộ trình NV", ten: "Chủ", email: EM, mk: "matkhau123", dong_y_dieu_khoan: true });
kiem("Đăng ký chủ", r.s === 200, r.d); const chu = r.cookie;
r = await goi("nv", { ten: "Nguyễn Văn Sơn", sdt: `09${String(now).slice(-8)}`, che_do: "thi_truong" }, chu);
kiem("Tạo nhân viên thị trường", r.s === 200, r.d);
const maMoi = r.d.ma_moi, nvId = r.d.id;

// 2) Chrome mobile + GPS giả
const hoSo = fs.mkdtempSync(path.join(os.tmpdir(), "cc-lt-"));
const cr = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9361", `--user-data-dir=${hoSo}`, "--lang=vi", "about:blank"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 40 && !ws; i++) { await cho(250); try { ws = (await (await fetch("http://127.0.0.1:9361/json")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} }
if (!ws) { console.log("✖ không mở Chrome"); cr.kill(); process.exit(1); }
const sock = new WebSocket(ws);
await new Promise((z) => sock.addEventListener("open", z, { once: true }));
let id = 0; const tl = new Map(); const loiJs = [];
sock.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && tl.has(m.id)) { tl.get(m.id)(m); tl.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") loiJs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
});
const cdp = (method, params = {}) => new Promise((z) => { const n = ++id; tl.set(n, z); sock.send(JSON.stringify({ id: n, method, params })); });
const js = async (b) => (await cdp("Runtime.evaluate", { expression: b, awaitPromise: true, returnByValue: true })).result?.result?.value;
const dien = (sel, v) => js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const bam = (sel) => js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
async function chup(ten) { const s = await cdp("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(new URL(ten + ".png", RA), Buffer.from(s.result.data, "base64")); console.log("  📸 anh-chup/" + ten + ".png"); }
const diaChi = (lat, lng) => cdp("Emulation.setGeolocationOverride", { latitude: lat, longitude: lng, accuracy: 10 });

await cdp("Runtime.enable"); await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp("Browser.grantPermissions", { origin: GOC, permissions: ["geolocation"] });
await diaChi(10.776, 106.700);

// Nhận lời mời
await cdp("Page.navigate", { url: `${GOC}/#moi=${maMoi}` }); await cho(1400);
await dien("input[name=mk]", "matkhau123"); await bam("input[name=dy]"); await bam("#f button[type=submit]"); await cho(1800);
kiem("Nhận lời mời xong (vào màn chấm)", (await js("location.hash")) === "#cham");

// Vào Lộ trình → đồng ý
await cdp("Page.navigate", { url: `${GOC}/#lo-trinh` }); await cho(1200);
kiem("Màn lộ trình hỏi đồng ý", await js(`!!document.getElementById('lt-dongy')`));
await chup("lt-01-dong-y");
await bam("#lt-ok"); await bam("#lt-dongy"); await cho(1200);
kiem("Sau đồng ý: hiện nút Bắt đầu ca", await js(`!!document.getElementById('lt-bat')`));

// Bắt đầu ca
await bam("#lt-bat"); await cho(2500);
const dangCa = await js(`!!document.getElementById('lt-ket')`);
kiem("Bắt đầu ca: hiện nút Kết thúc ca", dangCa);
// Di chuyển vài điểm để watchPosition bắn thêm
for (const [la, ln] of [[10.779, 106.703], [10.783, 106.707], [10.788, 106.710]]) { await diaChi(la, ln); await cho(900); }
await cho(1500);
const daGui = Number(await js(`(document.getElementById('lt-dagui')||{}).textContent||0`));
kiem("App đã gửi ≥1 điểm vị trí", daGui >= 1, { daGui });
await chup("lt-02-dang-ca");

// Đánh dấu điểm ghé
await dien("#g-ten", "Công ty Hoà Phát"); await bam("#lt-ghe"); await cho(2800);

// 3) Quản lý đọc bản đồ (node, cookie chủ)
r = await goi("ban-do", undefined, chu);
const thay = (r.d.ds || []).find((x) => x.nv_id === nvId);
kiem("Quản lý thấy nhân viên đang chạy trên bản đồ", !!thay, r.d);
if (thay) console.log(`   → ${thay.ten}: ${thay.lat},${thay.lng} · ${thay.phut} phút trước`);
r = await goi(`lo-trinh?nv=${nvId}`, undefined, chu);
kiem("Lộ trình có điểm + điểm ghé", (r.d.diem || []).length >= 1 && (r.d.ghe || []).length === 1, { diem: r.d.diem?.length, ghe: r.d.ghe?.length, km: r.d.km });

console.log(loiJs.length ? "✖ lỗi JS: " + JSON.stringify(loiJs.slice(0, 3)) : "✔ không lỗi JS");
console.log(`\n${truot ? "✖ " + truot + " trượt" : "✔ TẤT CẢ ĐẠT"} · ${dat} đạt`);
sock.close(); cr.kill(); process.exit(truot ? 1 : 0);
