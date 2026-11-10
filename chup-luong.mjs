/**
 * [CHỤP PHẦN LƯƠNG] dựa trên khung của chup-man-hinh.mjs. Chạy sau scripts/gieo-trung-tam.mjs:
 *   node chup-luong.mjs http://127.0.0.1:8811 <email chủ> <SĐT Lan>
 * Đi trọn luồng bằng Chrome thật (khung điện thoại 390×844, camera giả, GPS giả), chụp từng màn, bắt lỗi JS/CSP.
 *   node chup-man-hinh.mjs [http://127.0.0.1:8811]
 * Camera giả của Chrome không chứa mã QR nên bước quét đi đường link #q=<mã> (y như quét bằng camera điện thoại).
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GOC = process.argv[2] || "http://127.0.0.1:8811";
const EMAIL = process.argv[3], SDT_LAN = process.argv[4], MK = "demo12345";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RA = new URL("./anh-chup/", import.meta.url);
fs.mkdirSync(RA, { recursive: true });
const hoSo = fs.mkdtempSync(path.join(os.tmpdir(), "cc-cdp-"));
const cr = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9352", `--user-data-dir=${hoSo}`, "--lang=vi",
  "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "about:blank"], { stdio: "ignore" });
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) { await cho(250); try { wsUrl = (await (await fetch("http://127.0.0.1:9352/json")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.log("✖ không mở được Chrome"); cr.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const choTl = new Map(); const loiJs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && choTl.has(m.id)) { choTl.get(m.id)(m); choTl.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") loiJs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/favicon|status of 40[0134]/.test(m.params.entry.text)) loiJs.push(m.params.entry.text + " @ " + (m.params.entry.url || ""));
});
const goi = (method, params = {}) => new Promise((r) => { const n = ++id; choTl.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (b) => (await goi("Runtime.evaluate", { expression: b, awaitPromise: true, returnByValue: true })).result?.result?.value;
let dat = 0, truot = 0;
const kiem = (ten, dk, them = "") => { dk ? dat++ : truot++; console.log(`${dk ? "✔" : "✖"} ${ten}${dk ? "" : "  " + JSON.stringify(them)}`); };
async function chup(ten) { const r = await goi("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(new URL(ten + ".png", RA), Buffer.from(r.result.data, "base64")); console.log("  📸 anh-chup/" + ten + ".png"); }
const dien = (sel, v) => js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const bam = (sel) => js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
const co = (sel) => js(`!!document.querySelector(${JSON.stringify(sel)})`);
const chu = () => js(`document.body.innerText`);
const khongTran = (w) => js(`document.documentElement.scrollWidth<=${w}`);
const di = async (hash, ms = 1300) => { await goi("Page.navigate", { url: GOC + "/" + hash }); await cho(ms); };
const api = (duong, than) => js(`fetch('/api/${duong}',${than === undefined ? "{}" : `{method:'POST',headers:{'content-type':'application/json','x-cc':'1'},body:JSON.stringify(${JSON.stringify(than)})}`}).then(r=>r.json())`);

await goi("Runtime.enable"); await goi("Log.enable"); await goi("Page.enable");
await goi("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await goi("Browser.grantPermissions", { origin: GOC, permissions: ["geolocation", "videoCapture"] });
await goi("Emulation.setGeolocationOverride", { latitude: 10.7631, longitude: 106.6605, accuracy: 20 });


const dangNhap = async (dn) => { await di("#dang-nhap"); await js(`localStorage.setItem('cc_ngon','vi')`); await di("#dang-nhap");
  await dien("input[name=dang_nhap]", dn); await dien("input[name=mk]", MK); await bam("#f button[type=submit]"); await cho(1800); };
await di(""); await dangNhap(EMAIL);
const thangTruoc = new Date(Date.now() + 7 * 3600e3); thangTruoc.setUTCDate(1); thangTruoc.setUTCMonth(thangTruoc.getUTCMonth() - 1);
const TT = thangTruoc.toISOString().slice(0, 7);

await di("#quan-ly");
kiem("Quản lý có 4 lối vào phần lương", await co("a[href='#bang-luong']") && await co("a[href='#buoi-day']") && await co("a[href='#lam-them']") && await co("a[href='#thiet-lap-luong']"));
await chup("L01-quan-ly");

await di("#bang-luong", 2200);
await js(`(()=>{const o=document.getElementById('thang-l');o.value='${TT}';o.dispatchEvent(new Event('change'))})()`); await cho(2200);
const bl = await chu();
kiem("Bảng lương tháng trước có 7 người", (await js(`document.querySelectorAll('tr[data-nv]').length`)) === 7, await js(`document.querySelectorAll('tr[data-nv]').length`));
kiem("Có ô Đợt 1 / Đợt 2 / chi phí công ty", bl.includes("Đợt 2") && bl.includes("Tổng chi phí công ty"));
kiem("Hiện cảnh báo tham số luật chưa xác nhận", bl.includes("chưa được kế toán xác nhận"));
kiem("Có nút xuất CSV đợt 1 + tổng hợp", await co("a[href*='kieu=dot1']") && await co("a[href*='kieu=tong']"));
kiem("Không tràn ngang (bảng lương)", await khongTran(390));
await chup("L02-bang-luong");

const idLan = await js(`[...document.querySelectorAll('tr[data-nv]')].find(r=>r.innerText.includes('Trần Thị Lan')).dataset.nv`);
await di(`#phieu/${idLan}/${TT}`, 2200);
const pl = await chu();
kiem("Phiếu lương Lan có 2 công việc (hành chính + dạy)", pl.includes("Hành chính – tuyển sinh") && pl.includes("Dạy giao tiếp buổi tối"));
kiem("Phiếu lương có THỰC LĨNH + đợt 2 + cảnh báo BH thấp", pl.includes("THỰC LĨNH") && pl.includes("Đợt 2") && pl.includes("thấp hơn lương HĐ"));
await chup("L03-phieu-luong");
await js(`document.querySelector('details summary')?.click()`); await cho(300);
await chup("L03b-phieu-buoi-day");

await di(`#luong-nv/${idLan}`, 2000);
kiem("Màn công việc & lương có 2 form công việc", (await js(`document.querySelectorAll('.fcv[data-id]:not([data-id=""])').length`)) === 2);
kiem("Form lương giờ ẩn ô lương tháng", await js(`(()=>{const f=[...document.querySelectorAll('.fcv')].find(f=>f.ten_vai.value.includes('Dạy'));return f.querySelector('.o-thang').hidden && !f.querySelector('.o-gio').hidden})()`));
await chup("L04-cong-viec-luong");

await di("#thiet-lap-luong", 2000);
const tl = await chu();
kiem("Thiết lập có 8 kiểu thuê mẫu", (await js(`document.querySelectorAll('.ftl[data-loai=kieu-thue][data-id]:not([data-id=""])').length`)) === 8);
kiem("Thiết lập có bậc GV + 3 nhóm hệ số", tl.includes("Bậc giáo viên") && tl.includes("Khung giờ") && tl.includes("Loại lớp"));
await chup("L05-thiet-lap");

await di("#noi-lark", 1500);
kiem("Màn nối Lark có ô App ID + App Secret + link Base", await co("#fl input[name=app_id]") && await co("#fl input[name=secret]") && await co("#fl input[name=base]"));
await chup("L05b-noi-lark");
await di("#buoi-day", 2200);
kiem("Buổi dạy tháng này có danh sách theo ngày", (await js(`document.querySelectorAll('li[data-b]').length`)) > 10);
kiem("Có buổi dạy thuê ở trường đối tác", (await chu()).includes("Trường TH Đối tác"));
await chup("L06-buoi-day");

await di("#lam-them", 2000);
await js(`(()=>{const o=document.getElementById('thang-l');o.value=new Date(Date.now()+7*3600e3).toISOString().slice(0,7);o.dispatchEvent(new Event('change'))})()`); await cho(1800);
kiem("Làm thêm: có đơn chờ duyệt với 4 nút hệ số", (await js(`document.querySelectorAll('[data-lt] [data-hs]').length`)) === 4);
kiem("Nút hệ số thấp hơn luật được tô cảnh báo", (await js(`document.querySelectorAll('[data-lt] [data-hs].canh-chu').length`)) === 1);
await chup("L07-lam-them");
await js(`document.querySelector('[data-lt] [data-hs="1.5"]').click()`); await cho(1500);
kiem("Duyệt hệ số 1,5 xong hết đơn chờ", (await js(`document.querySelectorAll('[data-lt] [data-hs]').length`)) === 0 && (await chu()).includes("hệ số 1.5"));

// ---- Giáo viên Lan: màn Dạy, bắt đầu buổi có GPS theo cơ sở của buổi ----
await api("dang-xuat", {});
await goi("Emulation.setGeolocationOverride", { latitude: 10.80167, longitude: 106.71114, accuracy: 15 }); // đứng ở Bình Thạnh
await dangNhap(SDT_LAN);
kiem("Giáo viên có tab Dạy", await co("a[href='#day']"));
await di("#day", 2000);
const hom = await js(`document.querySelectorAll('[data-v=bat-dau]').length`);
await chup("L08-gv-day");
if (hom) {
  await js(`window.alert = (m) => { window.__alert = m; }`);
  await bam("[data-v=bat-dau]"); await cho(2500);
  kiem("Đứng sai cơ sở thì không bắt đầu được buổi", String(await js("window.__alert || ''")).includes("cách"), await js("window.__alert"));
  await goi("Emulation.setGeolocationOverride", { latitude: 10.776889, longitude: 106.700806, accuracy: 15 });  // tới Quận 1
  await di("#day", 1800);
  await bam("[data-v=bat-dau]"); await cho(2500);
  kiem("Đứng đúng cơ sở thì bắt đầu được", await co("[data-v=ket-thuc]"));
  await chup("L09-gv-dang-day");
} else console.log("  (hôm nay Lan không có buổi — bỏ qua bài bắt đầu buổi)");
await di("#toi", 1500);
kiem("Màn Tôi có lối vào phiếu lương + làm thêm", await co("a[href='#phieu-luong']") && await co("a[href='#lam-them']"));

await goi("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await api("dang-xuat", {}); await dangNhap(EMAIL);
await di("#bang-luong", 2000);
await js(`(()=>{const o=document.getElementById('thang-l');o.value='${TT}';o.dispatchEvent(new Event('change'))})()`); await cho(2200);
await chup("L10-bang-luong-may-tinh");

kiem("Không lỗi JS", loiJs.length === 0, loiJs);
console.log(`\n${dat} đạt · ${truot} trượt`);
ws.close(); cr.kill(); try { fs.rmSync(hoSo, { recursive: true, force: true }); } catch {}
process.exit(truot ? 1 : 0);
