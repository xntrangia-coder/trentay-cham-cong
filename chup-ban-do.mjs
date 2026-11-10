// Gieo dữ liệu lộ trình rồi CHỤP màn Bản đồ (trực tiếp + lộ trình) bằng Chrome thật.
//   node chup-ban-do.mjs [http://127.0.0.1:8811]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GOC = process.argv[2] || "http://127.0.0.1:8811";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RA = new URL("./anh-chup/", import.meta.url);
fs.mkdirSync(RA, { recursive: true });
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const may = () => crypto.randomUUID().replace(/-/g, "");

// ---- 1) Gieo dữ liệu qua API (node, cookie thủ công) ----
async function goi(duong, than, cookie) {
  const r = await fetch(GOC + "/api/" + duong, { method: than === undefined ? "GET" : "POST",
    headers: { "x-cc": "1", "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: than === undefined ? undefined : JSON.stringify(than) });
  const sc = r.headers.get("set-cookie");
  return { s: r.status, d: await r.json().catch(() => ({})), cookie: sc ? sc.split(";")[0] : null };
}
const EM = `chup-bando-${Date.now()}@thu.vn`;
let r = await goi("dang-ky", { ten_dn: "Xe Nâng Trần Gia (thử lộ trình)", ten: "Quản lý", email: EM, mk: "matkhau123", dong_y_dieu_khoan: true });
if (r.s !== 200) { console.log("✖ đăng ký", r.d); process.exit(1); }
const chu = r.cookie, now = Date.now();
for (let i = 0; i < 2; i++) {
  r = await goi("nv", { ten: ["Nguyễn Văn Sơn", "Trần Thị Mai"][i], sdt: `09${String(now).slice(-7)}${i}`, che_do: "thi_truong" }, chu);
  const dm = may(), nm = await goi(`moi/${r.d.ma_moi}`, { mk: "matkhau123", dong_y: true, may: dm });
  await goi("vi-tri/dong-y", {}, nm.cookie);
  const bc = await goi("vi-tri/bat-ca", { may: dm }, nm.cookie);
  const lat0 = 10.772 + i * 0.015, lng0 = 106.698 - i * 0.02, N = 45;
  const diem = Array.from({ length: N }, (_, k) => ({ luc: now - (N - k) * 70000,
    lat: lat0 + k * 0.0011 * Math.cos(k / 6), lng: lng0 + k * 0.0013 * Math.sin(k / 5),
    do_cx: 7 + (k % 4), pin: 100 - k, toc_do: 7 }));
  await goi("vi-tri/nap", { phien_id: bc.d.phien.id, diem }, nm.cookie);
  for (const [j, g] of [["khach", "Công ty Hoà Phát"], ["giao", "Kho Sóng Thần"], ["sua", "Xưởng Bình Dương"]].entries()) {
    if (j > i + 1) break;
    const gt = await goi("ghe-tham", { phien_id: bc.d.phien.id, loai: g[0], ten: g[1],
      lat: lat0 + 0.01 * (j + 1), lng: lng0 + 0.008 * (j + 1), ghi_chu: "Đã xong" }, nm.cookie);
    if (j === 0) await goi(`ghe-tham/${gt.d.id}/roi`, {}, nm.cookie);
  }
}
console.log("✔ Đã gieo 2 nhân viên đang trong ca");

// ---- 2) Chrome: đăng nhập rồi chụp ----
const hoSo = fs.mkdtempSync(path.join(os.tmpdir(), "cc-bando-"));
const cr = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9357", `--user-data-dir=${hoSo}`, "--lang=vi", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) { await cho(250); try { wsUrl = (await (await fetch("http://127.0.0.1:9357/json")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log("✖ không mở Chrome"); cr.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl);
await new Promise((rz) => ws.addEventListener("open", rz, { once: true }));
let id = 0; const tl = new Map(); const loiJs = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && tl.has(m.id)) { tl.get(m.id)(m); tl.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") loiJs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
});
const cdp = (method, params = {}) => new Promise((rz) => { const n = ++id; tl.set(n, rz); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (b) => (await cdp("Runtime.evaluate", { expression: b, awaitPromise: true, returnByValue: true })).result?.result?.value;
async function chup(ten) { const s = await cdp("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(new URL(ten + ".png", RA), Buffer.from(s.result.data, "base64")); console.log("  📸 anh-chup/" + ten + ".png"); }

await cdp("Runtime.enable"); await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: GOC + "/" }); await cho(900);
const dn = await js(`fetch('/api/dang-nhap',{method:'POST',headers:{'content-type':'application/json','x-cc':'1'},body:JSON.stringify({dang_nhap:${JSON.stringify(EM)},mk:'matkhau123'})}).then(r=>r.status)`);
console.log(dn === 200 ? "✔ Đăng nhập trong trình duyệt" : "✖ đăng nhập " + dn);
await cdp("Page.navigate", { url: GOC + "/ban-do.html" }); await cho(3500);
const n = await js(`document.querySelectorAll('.nguoi').length`);
console.log((n >= 2 ? "✔" : "✖") + ` Bản đồ trực tiếp: ${n} người trong danh sách`);
await chup("bando-01-truc-tiep");
await js(`document.getElementById('t-trinh').click()`); await cho(1200);
await js(`document.getElementById('xem')&&document.getElementById('xem').click()`); await cho(2500);
const km = await js(`(document.querySelector('.tt-dong b')||{}).textContent||''`);
console.log("✔ Lộ trình: " + km);
await chup("bando-02-lo-trinh");
console.log(loiJs.length ? "✖ lỗi JS: " + JSON.stringify(loiJs.slice(0, 3)) : "✔ không lỗi JS");
ws.close(); cr.kill(); process.exit(0);
