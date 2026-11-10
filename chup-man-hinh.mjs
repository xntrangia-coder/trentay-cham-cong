/**
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
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RA = new URL("./anh-chup/", import.meta.url);
fs.mkdirSync(RA, { recursive: true });
const hoSo = fs.mkdtempSync(path.join(os.tmpdir(), "cc-cdp-"));
const cr = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9351", `--user-data-dir=${hoSo}`, "--lang=vi",
  "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "about:blank"], { stdio: "ignore" });
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) { await cho(250); try { wsUrl = (await (await fetch("http://127.0.0.1:9351/json")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} }
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

await di("");
await js(`localStorage.setItem('cc_ngon','vi')`);
await di("#dang-ky");
kiem("Màn đăng ký: ô đồng ý KHÔNG tick sẵn", await js(`!document.querySelector('input[name=dy]').checked`));
kiem("Không tràn ngang 390px (đăng ký)", await khongTran(390));
await chup("01-dang-ky");

// ---- Chủ đăng ký ----
const email = `chup-${Date.now()}@thu.vn`;
await dien("input[name=ten_dn]", "Xe Nâng Trần Gia (thử)"); await dien("input[name=ten]", "Trần Văn Thừa");
await dien("input[name=email]", email); await dien("input[name=mk]", "matkhau123");
await bam("input[name=dy]"); await bam("#f button[type=submit]"); await cho(1800);
kiem("Đăng ký xong vào trang Quản lý", (await js("location.hash")) === "#quan-ly" && (await chu()).includes("Nhân viên"));
await chup("02-quan-ly");

const dd = (await api("dia-diem")).ds[0];
await api(`dia-diem/${dd.id}/sua`, { ten: "Bãi xe Quận 12", lat: 10.762622, lng: 106.660172, ban_kinh: 150, ip_ds: "" });
await di("#dia-diem");
kiem("Màn địa điểm có link màn QR + nút lấy vị trí", await co("a[href*='kiosk.html']") && await co("[data-vt]"));
kiem("Không tràn ngang (địa điểm)", await khongTran(390));
await chup("03-dia-diem");

await di("#nhan-vien");
await bam("#them summary");
await dien("#them input[name=ten]", "Nguyễn Văn An"); await dien("#them input[name=sdt]", "09" + String(Date.now()).slice(-8));
await dien("#them input[name=ma_nv]", "NV01");
await bam("#them button[type=submit]"); await cho(1800);
kiem("Thêm nhân viên xong hiện link mời + mã QR", (await co(".moi img")) && (await chu()).includes("Chưa nhận lời mời"));
kiem("Không tràn ngang (nhân viên)", await khongTran(390));
await chup("04-nhan-vien-moi");
const linkMoi = await js(`document.querySelector('.moi .link').textContent`);

await di("#ca-lam");
kiem("Màn ca làm có 7 ô ngày trong tuần", (await js(`document.querySelectorAll('.fca')[0].querySelectorAll('input[name=thu]').length`)) === 7);
await chup("05-ca-lam");

// Màn QR ở quầy, khổ máy tính bảng
await goi("Emulation.setDeviceMetricsOverride", { width: 820, height: 1180, deviceScaleFactor: 1, mobile: true });
await goi("Page.navigate", { url: `${GOC}/kiosk.html?d=${dd.id}&k=${dd.ma_kiosk}` }); await cho(2000);
for (let i = 0; i < 16 && !/\d/.test(await js(`document.getElementById("giay")?.textContent || ""`)); i++) await cho(250);
kiem("Màn QR ở quầy hiện mã + đếm ngược", await co(".k-qr img") && /\d/.test(await js(`document.getElementById('giay').textContent`)));
await chup("06-man-qr-quay");
await goi("Page.navigate", { url: `${GOC}/kiosk.html?d=${dd.id}&k=sai` }); await cho(1500);
kiem("Màn QR với link sai báo lỗi", (await chu()).includes("không đúng"));
await goi("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

// ---- Nhân viên nhận lời mời ----
await di(""); await api("dang-xuat", {});
await goi("Page.navigate", { url: linkMoi }); await cho(1500);
kiem("Link mời hiện tên công ty", (await chu()).includes("Xe Nâng Trần Gia"));
await chup("07-nhan-loi-moi");
await dien("input[name=mk]", "nhanvien123"); await bam("input[name=dy]"); await bam("#f button[type=submit]"); await cho(1800);
kiem("Nhận lời mời xong vào màn chấm công", (await js("location.hash")) === "#cham" && await co("#cham.vao"));
kiem("Không tràn ngang (chấm công)", await khongTran(390));
await chup("08-cham-cong");

// Quét QR = mở link #q=<mã> (đúng thứ camera điện thoại làm khi quét màn ở quầy)
const ma = await js(`fetch('/api/kiosk/${dd.id}?k=${dd.ma_kiosk}').then(r=>r.json()).then(d=>d.ma)`);
await di("#q=" + ma, 1500);
kiem("Đi link QR -> tự sang bước chụp ảnh", await co(".khung-cam.tron video"));
await cho(1200); await chup("09-chup-anh");
await cho(4500);
kiem("Chấm vào thành công, không cảnh báo", (await chu()).includes("Đã chấm vào") && !(await co(".dau-tick.canh")), await chu());
await chup("10-da-cham");
await bam("#xong"); await cho(1500);
kiem("Sau khi chấm, nút đổi thành CHẤM RA", await co("#cham.ra"));

// Thử đứng xa khi chưa quét QR: phải mở camera quét, huỷ được
await bam("#cham"); await cho(1500);
kiem("Bấm CHẤM RA mà chưa có QR -> mở khung quét", await co(".khung-cam video") && !(await co(".khung-cam.tron")));
await chup("11-khung-quet");
await bam("#huy"); await cho(500);
kiem("Huỷ quét đóng lớp phủ", !(await co("#lop")));

await di("#lich-su");
kiem("Lịch sử tháng có ô tổng + danh sách ngày", await co(".luoi .so") && await co("#thang"));
await chup("12-lich-su");
await di("#don");
await dien("textarea[name=ly_do]", "Quên chấm ra hôm qua vì điện thoại hết pin");
await js(`(()=>{const f=document.getElementById('fd');f.gio_ra.value='17:30';const d=new Date(Date.now()+7*3600e3-86400e3).toISOString().slice(0,10);f.ngay.value=d})()`);
await bam("#fd button[type=submit]"); await cho(1500);
kiem("Gửi đơn quên chấm, đơn hiện 'Chờ duyệt'", (await chu()).includes("Chờ duyệt"));
kiem("Không tràn ngang (đơn)", await khongTran(390));
await chup("13-don");

// ---- Chủ xem lại ----
await api("dang-xuat", {});
await di("#dang-nhap");
await dien("input[name=dang_nhap]", email); await dien("input[name=mk]", "matkhau123");
await bam("#f button[type=submit]"); await cho(1800);
await di("#hom-nay", 1800);
kiem("Hôm nay: thấy nhân viên đã vào + banner đơn chờ", (await chu()).includes("Nguyễn Văn An") && await co(".banner"));
kiem("Không tràn ngang (hôm nay)", await khongTran(390));
await chup("14-hom-nay");
await bam("li[data-nv]"); await cho(1800);
kiem("Chi tiết ngày có ảnh chấm công + link bản đồ", await co(".ban-ghi img") && await co("a[href*='google.com/maps']"));
await chup("15-chi-tiet-ngay");
await di("#don", 1500);
await bam("[data-xet=duyet]"); await cho(1500);
kiem("Chủ duyệt đơn: hết đơn chờ", (await chu()).includes("Không có đơn nào"));
await di("#bang-cong", 1800);
kiem("Bảng công có bảng + 2 nút xuất Excel", await co("table.bang") && (await js(`document.querySelectorAll("a[href*='bang-cong.csv']").length`)) === 2);
await chup("16-bang-cong");

// ---- Công ty lớn: phòng ban, nhập Excel, lọc, in thẻ, máy quét thẻ ----
await di("#phong-ban", 1500);
await dien("#fpb input[name=ten]", "Xưởng may"); await bam("#fpb button[type=submit]"); await cho(1500);
kiem("Tạo phòng ban qua giao diện", (await js(`document.querySelector(".sua-pb input")?.value`)) === "Xưởng may");
kiem("Không tràn ngang (phòng ban)", await khongTran(390));
await chup("18-phong-ban");
await di("#nhap-nv", 1200);
const tepXlsx = path.join(hoSo, "thu-nhap.xlsx");
const duoi = String(Date.now()).slice(-6);
spawnSync("python", [fileURLToPath(new URL("./scripts/tao-tep-thu.py", import.meta.url)), tepXlsx, duoi]);
const tl = (await goi("DOM.getDocument", { depth: -1 })).result.root.nodeId;
const nutTep = (await goi("DOM.querySelector", { nodeId: tl, selector: "#tep" })).result.nodeId;
await goi("DOM.setFileInputFiles", { nodeId: nutTep, files: [tepXlsx] }); await cho(1500);
kiem("Đọc tệp .xlsx: 3 dòng (bỏ dòng trống), nhận cột viết hoa", (await chu()).includes("Đọc được 3 dòng") && (await chu()).includes("HỌ TÊN"), await chu());
await chup("19-nhap-excel");
await bam("#nhap"); await cho(3000);
kiem("Nhập xong: thêm 3 người, có nút tải link mời", (await chu()).includes("Đã thêm 3 người") && await co("#link"), await chu());
await chup("20-nhap-ket-qua");
await di("#nhan-vien", 1800);
const pbMay = await js(`[...document.querySelectorAll('#loc-pb option')].find(o=>o.textContent.trim()==='Xưởng may')?.value`);
await js(`(()=>{const s=document.getElementById('loc-pb');s.value=${JSON.stringify(pbMay)};s.dispatchEvent(new Event('change'))})()`); await cho(1500);
kiem("Lọc nhân viên theo phòng ban: đúng 2 người xưởng may", (await js(`document.querySelectorAll('li[data-nv]').length`)) === 2 && (await chu()).includes("Nguyễn Thị Hoa"));
kiem("SĐT Excel rụng số 0 được sửa (0912…)", (await chu()).includes("0912" + duoi));
await bam(".mo-nv"); await cho(500);
kiem("Mở một người: người quẹt thẻ không có link mời, có nút Cấp lại thẻ", (await chu()).includes("không cần cài app") && await co("[data-viec=cap-the]"));
await chup("21-nhan-vien-loc");
await di("#in-the", 2000);
kiem("Trang in thẻ: mỗi người một thẻ QR", (await js(`document.querySelectorAll('.the-in img').length`)) >= 2);
await chup("22-in-the");
await di("#hom-nay", 1800);
await bam("[data-loc=chua_vao]"); await cho(1500);
kiem("Bấm ô 'chưa vào' thì lọc danh sách", await co("[data-loc=chua_vao].chon") && (await chu()).includes("Bỏ lọc"));
await chup("23-hom-nay-loc");
await goi("Emulation.setDeviceMetricsOverride", { width: 820, height: 1180, deviceScaleFactor: 1, mobile: true });
await goi("Page.navigate", { url: `${GOC}/kiosk.html?d=${dd.id}&k=${dd.ma_kiosk}&che=the` }); await cho(1800);
kiem("Máy quét thẻ: màn bắt đầu có nút", await co("#bd"));
await bam("#bd"); await cho(2000);
kiem("Bấm Bắt đầu: bật camera + hướng dẫn đưa thẻ", await co(".k-quet video") && (await chu()).includes("Đưa thẻ"));
await chup("24-may-quet-the");
await goi("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await di("#bang-cong", 1800);

// EN
await bam(".ngon button[data-n=en]"); await cho(1200);
kiem("Đổi sang tiếng Anh", (await chu()).includes("Timesheet"));
await chup("17-tieng-anh");

kiem("Không có lỗi JS / CSP", loiJs.length === 0, loiJs);
console.log(`\n${dat} đạt · ${truot} trượt`);
ws.close(); cr.kill();
try { fs.rmSync(hoSo, { recursive: true, force: true }); } catch {}
process.exit(truot ? 1 : 0);
