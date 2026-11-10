// Tự kiểm phần "công ty lớn": phòng ban + phạm vi quản lý, nhập Excel, thẻ ở cổng, lọc + chia trang.
//   node kiem-tra-cong-ty-lon.mjs [http://127.0.0.1:8811]
// Bài thẻ "VÀO rồi RA" cần ghi giờ tuỳ ý → chỉ chạy khi máy chủ thử bật CC_THU=1.
const GOC = process.argv[2] || "http://127.0.0.1:8811";
const LOCAL = GOC.includes("127.0.0.1") || GOC.includes("localhost");
let dat = 0, truot = 0;
const kiem = (ten, dk, them = "") => { dk ? dat++ : truot++; console.log(`${dk ? "✔" : "✖"} ${ten}${dk ? "" : "  " + (typeof them === "string" ? them : JSON.stringify(them).slice(0, 300))}`); };
class May {
  constructor() { this.cookie = ""; this.ma = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  async goi(duong, than) {
    const h = { cookie: this.cookie, "x-cc": "1" };
    if (than !== undefined) h["content-type"] = "application/json";
    const r = await fetch(GOC + "/api/" + duong, { method: than === undefined ? "GET" : "POST", headers: h, body: than === undefined ? undefined : JSON.stringify(than) });
    const sc = r.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0];
    const loai = r.headers.get("content-type") || "";
    const chu = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await r.arrayBuffer());
    return { s: r.status, d: loai.includes("json") ? JSON.parse(chu) : chu };
  }
}
const ngau = () => Math.random().toString(36).slice(2, 8);
const so = () => "09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const ANH = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const A = new May(), B = new May(), QL = new May();
let r = await A.goi("dang-ky", { ten_dn: "Nhà máy Thử A", ten: "Chủ A", email: `lon-a-${ngau()}@thu.vn`, mk: "matkhau123", dong_y_dieu_khoan: true });
kiem("Đăng ký công ty A", r.s === 200);
await B.goi("dang-ky", { ten_dn: "Nhà máy Thử B", ten: "Chủ B", email: `lon-b-${ngau()}@thu.vn`, mk: "matkhau123", dong_y_dieu_khoan: true });

// ---- Phòng ban ----
r = await A.goi("phong-ban", { ten: "Xưởng may" });
const pbMay = r.d.id;
kiem("Tạo phòng ban", r.s === 200 && /^[a-f0-9]{16}$/.test(pbMay));
r = await A.goi("phong-ban", { ten: "xưởng MAY" });
kiem("Tên phòng ban trùng (khác hoa thường) bị chặn", r.s === 409);
const pbKho = (await A.goi("phong-ban", { ten: "Kho" })).d.id;
r = await B.goi(`phong-ban/${pbMay}/sua`, { ten: "Hack" });
kiem("Công ty B không sửa được phòng ban của A", r.s === 404);

// ---- Nhập Excel ----
const sdtCu = so();
await A.goi("nv", { ten: "Đã Có Sẵn", sdt: sdtCu });
const sdtTrung = so();
const dong = [
  { ten: "Nguyễn Văn An", sdt: sdtTrung.slice(1), ma_nv: "M001", phong_ban: "Xưởng may", che_do: "thẻ" },   // SĐT rụng số 0
  { ten: "Trần Thị Bình", sdt: sdtTrung, phong_ban: "Xưởng may" },                                        // trùng dòng trên
  { ten: "Lê Văn Cường", sdt: sdtCu, phong_ban: "Kho" },                                                   // trùng người đã có
  { ten: "Phạm Thị Dung", sdt: "0912 345", phong_ban: "Kho" },                                             // SĐT sai
  { ten: "Hoàng Văn Em", sdt: so(), ca: "Ca không tồn tại" },                                              // ca lạ
  { ten: "Vũ Thị Phương", phong_ban: "Bảo vệ", che_do: "the cong", ma_nv: "BV01" },                        // phòng ban mới, thẻ, không SĐT
  { ten: "Đỗ Văn Giang", email: `giang-${ngau()}@thu.vn`, phong_ban: "Kho", che_do: "văn phòng" },
  { ten: "X" },                                                                                            // tên ngắn
];
r = await A.goi("nv/nhap", { dong });
const ket = r.d.ket || [];
const kq = (i) => ket.find((k) => k.i === i) || {};
kiem("Nhập: SĐT rụng số 0 được sửa, chế độ thẻ không có lời mời", kq(0).ok && kq(0).sdt === sdtTrung && kq(0).ma_moi === null, kq(0));
kiem("Nhập: SĐT trùng ngay trong tệp bị loại", kq(1).loi === "sdt-da-co", kq(1));
kiem("Nhập: SĐT đã có trong công ty bị loại", kq(2).loi === "sdt-da-co", kq(2));
kiem("Nhập: SĐT sai bị loại", kq(3).loi === "sai-sdt", kq(3));
kiem("Nhập: ca không tồn tại bị loại", kq(4).loi === "ca-la", kq(4));
kiem("Nhập: người quẹt thẻ không cần SĐT/email", kq(5).ok === true, kq(5));
kiem("Nhập: nhân viên văn phòng có link mời", kq(6).ok && /^[a-f0-9]{24}$/.test(kq(6).ma_moi), kq(6));
kiem("Nhập: tên quá ngắn bị loại", kq(7).loi === "thieu-ten", kq(7));
r = await A.goi("phong-ban");
const pbBv = r.d.ds.find((p) => p.ten === "Bảo vệ");
kiem("Nhập: phòng ban mới được tự tạo", !!pbBv && pbBv.so_nv === 1, r.d.ds);
r = await A.goi("nv/nhap", { dong: Array.from({ length: 41 }, (_, i) => ({ ten: "Lô " + i, che_do: "the" })) });
kiem("Một lượt nhập chỉ nhận tối đa 40 dòng", r.d.ket.length === 40);
r = await B.goi("nv/nhap", { dong: [{ ten: "Người của B", phong_ban: "Xưởng may", che_do: "the" }] });
const pbsB = (await B.goi("phong-ban")).d.ds;
kiem("Phòng ban của A không lọt sang B khi B nhập trùng tên", r.d.ket[0].ok && pbsB.length === 1 && pbsB[0].id !== pbMay);

// ---- Lọc + chia trang ----
const lo = Array.from({ length: 80 }, (_, i) => ({ ten: `Công Nhân ${String(i).padStart(2, "0")}`, phong_ban: "Xưởng may", che_do: "the", ma_nv: "CN" + i }));
await A.goi("nv/nhap", { dong: lo.slice(0, 40) }); await A.goi("nv/nhap", { dong: lo.slice(40) });
r = await A.goi(`nv?pb=${pbMay}`);
kiem("Lọc theo phòng ban: 81 người, trang 1 có 50", r.d.tong === 81 && r.d.ds.length === 50 && r.d.so_trang === 2, { tong: r.d.tong, n: r.d.ds.length });
r = await A.goi(`nv?pb=${pbMay}&trang=2`);
kiem("Trang 2 có 31 người", r.d.ds.length === 31);
r = await A.goi(`nv?q=${encodeURIComponent("cong nhan 07")}`);
kiem("Tìm không dấu ra đúng người", r.d.ds.length === 1 && r.d.ds[0].ten === "Công Nhân 07", r.d.ds.map((x) => x.ten));
r = await A.goi(`nv?q=CN12`);
kiem("Tìm theo mã nhân viên", r.d.ds.length === 1 && r.d.ds[0].ma_nv === "CN12");
r = await A.goi("nv?pb=khong");
kiem("Lọc 'chưa có phòng ban'", r.d.ds.every((x) => !x.phong_ban_id) && r.d.ds.some((x) => x.ten === "Đã Có Sẵn"));
r = await A.goi(`hom-nay?pb=${pbMay}`);
kiem("Hôm nay theo phòng ban: đếm đủ 81, danh sách chia trang", r.d.tong.nv === 81 && r.d.ds.length === 50 && r.d.so_trang === 2, r.d.tong);
r = await A.goi(`hom-nay?pb=${pbMay}&loc=chua_vao`);
kiem("Hôm nay lọc theo ô 'chưa vào'", r.d.ds.every((x) => ["chua_vao", "vang", "chua_den", "nghi", "ngoai_ca"].includes(x.ngay.trang_thai) || !x.ngay.vao));
r = await A.goi(`bang-cong?pb=${pbMay}&trang=2`);
kiem("Bảng công chia trang theo phòng ban", r.d.tong_nv === 81 && r.d.ds.length === 31 && r.d.ds[0].nv.phong_ban === "Xưởng may", { tong: r.d.tong_nv, n: r.d.ds?.length });
r = await A.goi(`bang-cong.csv?pb=${pbKho}`);
kiem("CSV theo phòng ban chỉ có người phòng đó", typeof r.d === "string" && r.d.includes("Đỗ Văn Giang") && !r.d.includes("Công Nhân 01") && r.d.includes("Phòng ban"));

// ---- Quản lý theo phòng ban ----
const sdtQl = so();
r = await A.goi("nv", { ten: "Trưởng Kho", sdt: sdtQl, vai: "quan_ly", pham_vi: "phong_ban" });
kiem("Quản lý theo phòng ban mà thiếu phòng ban bị chặn", r.d.loi === "can-phong-ban");
r = await A.goi("nv", { ten: "Trưởng Kho", sdt: sdtQl, vai: "quan_ly", pham_vi: "phong_ban", phong_ban_id: pbKho });
const idQl = r.d.id;
await QL.goi("moi/" + r.d.ma_moi, { mk: "quanly1234", dong_y: true, may: QL.ma });
r = await QL.goi("toi");
kiem("Quản lý phòng ban đăng nhập, biết mình bị giới hạn", r.d.gioi_han_pb === pbKho && r.d.phong_ban === "Kho", r.d);
r = await QL.goi("nv");
kiem("Quản lý chỉ thấy người phòng Kho", r.d.ds.length >= 2 && r.d.ds.every((x) => x.phong_ban_id === pbKho), r.d.ds.map((x) => x.ten));
r = await QL.goi(`nv?pb=${pbMay}`);
kiem("Gõ ?pb= phòng khác cũng không xem được", r.d.ds.every((x) => x.phong_ban_id === pbKho));
const idTheoMa = async (ma) => (await A.goi(`nv?q=${ma}`)).d.ds.find((x) => x.ma_nv === ma).id;
const idCn = await idTheoMa("CN5");
r = await QL.goi(`nv/${idCn}/thang`);
kiem("Không xem được bảng công người phòng khác", r.s === 404);
r = await QL.goi(`nv/${idCn}/sua`, { ten: "Đổi tên" });
kiem("Không sửa được người phòng khác", r.s === 404);
r = await QL.goi("hom-nay");
kiem("Hôm nay của quản lý chỉ đếm phòng Kho", r.d.tong.nv === (await A.goi(`hom-nay?pb=${pbKho}`)).d.tong.nv);
r = await QL.goi(`bang-cong.csv`);
kiem("CSV của quản lý không có người phòng khác", !r.d.includes("Công Nhân") && r.d.includes("Đỗ Văn Giang"));
r = await QL.goi("nv", { ten: "Nhân Viên Mới Kho", che_do: "the", phong_ban_id: pbMay });
const moiKho = (await A.goi(`nv?q=${encodeURIComponent("nhan vien moi kho")}`)).d.ds[0];
kiem("Quản lý thêm người: bị ép vào phòng ban của mình", r.s === 200 && moiKho?.phong_ban_id === pbKho);
r = await QL.goi(`nv/${moiKho.id}/sua`, { ten: "Nhân Viên Mới Kho", che_do: "the", vai: "quan_ly" });
kiem("Quản lý không tự phong quản lý được", r.s === 403);
r = await QL.goi("ca", { ten: "Ca đêm", gio_vao: "22:00", gio_ra: "06:00", ngay_lam: "1,2" });
kiem("Quản lý phòng ban không sửa được ca", r.s === 403);
r = await QL.goi("phong-ban", { ten: "Phòng riêng" });
kiem("Quản lý phòng ban không tạo được phòng ban", r.s === 403);
r = await QL.goi("dia-diem");
kiem("Quản lý phòng ban không thấy mã mở máy quầy", r.s === 200 && r.d.ds.every((x) => !("ma_kiosk" in x)));
// Đơn từ: người phòng May gửi đơn, quản lý Kho không duyệt được.
const nvMay = new May();
const sdtNvMay = so();
r = await A.goi("nv", { ten: "Thợ May Có App", sdt: sdtNvMay, phong_ban_id: pbMay });
await nvMay.goi("moi/" + r.d.ma_moi, { mk: "thomay1234", dong_y: true, may: nvMay.ma });
r = await nvMay.goi("don", { loai: "nghi_phep", ngay: "2026-12-01", ly_do: "Về quê" });
const donMay = r.d.id;
r = await QL.goi("don?tat_ca=1&trang_thai=cho");
kiem("Quản lý Kho không thấy đơn của phòng May", !r.d.ds.some((x) => x.id === donMay));
r = await QL.goi(`don/${donMay}/duyet`, {});
kiem("Quản lý Kho không duyệt được đơn phòng May", r.s === 404);
r = await A.goi(`don/${donMay}/duyet`, {});
kiem("Chủ duyệt được", r.s === 200);

// ---- Thẻ ở cổng ----
const ddA = (await A.goi("dia-diem")).d.ds[0], ddB = (await B.goi("dia-diem")).d.ds[0];
const cong = (dd, than) => new May().goi(`kiosk/${dd.id}/cham`, than);
r = await A.goi(`nv/the?pb=${pbBv.id}`);
const theVu = r.d.ds?.[0];
kiem("Danh sách in thẻ có mã thẻ", theVu && /^TTCC:[a-f0-9]{16}\.[a-f0-9]{12}$/.test(theVu.the) && theVu.phong_ban === "Bảo vệ", r.d);
r = await cong(ddA, { k: "sai", the: theVu.the, anh: ANH });
kiem("Máy cổng sai mã kiosk bị từ chối", r.s === 404);
r = await cong(ddA, { k: ddA.ma_kiosk, the: "TTCC:" + "0".repeat(16) + "." + "0".repeat(12), anh: ANH });
kiem("Thẻ giả bị từ chối", r.d.loi === "the-sai");
r = await cong(ddA, { k: ddA.ma_kiosk, the: theVu.the });
kiem("Thiếu ảnh (công ty bật ảnh) bị từ chối", r.d.loi === "thieu-anh");
r = await cong(ddB, { k: ddB.ma_kiosk, the: theVu.the, anh: ANH });
kiem("Thẻ công ty A quẹt ở máy công ty B bị từ chối", r.d.loi === "the-sai");
r = await cong(ddA, { k: ddA.ma_kiosk, the: theVu.the, anh: ANH });
kiem("Quẹt thẻ lần đầu = VÀO, trả tên", r.s === 200 && r.d.cham.loai === "vao" && r.d.ten === "Vũ Thị Phương", r.d);
r = await cong(ddA, { k: ddA.ma_kiosk, the: theVu.the, anh: ANH });
kiem("Quẹt lại ngay: không ghi thêm, không đảo thành RA", r.d.vua_cham === true && r.d.cham.loai === "vao");
r = await A.goi(`nv/${theVu.id}/ngay?ngay=${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)}`);
kiem("Bản ghi thẻ có cờ thẻ + ảnh", r.d.ban.length === 1 && r.d.ban[0].qua_the && r.d.ban[0].con_anh, r.d.ban);
const anhId = r.d.ban[0].id;
r = await A.goi(`anh/${anhId}`);
kiem("Chủ xem được ảnh chụp ở cổng", r.s === 200);
r = await QL.goi(`anh/${anhId}`);
kiem("Quản lý Kho không xem được ảnh người phòng Bảo vệ", r.s === 404);
if (LOCAL) {
  const idCnThe = await idTheoMa("CN3");
  await A.goi("thu/cham-lo", { ds: [{ nv_id: idCnThe, loai: "vao", luc: Date.now() - 3 * 3600e3 }] });
  const theCn = (await A.goi(`nv/the?pb=${pbMay}`)).d.ds.find((x) => x.id === idCnThe).the;
  r = await cong(ddA, { k: ddA.ma_kiosk, the: theCn, anh: ANH });
  kiem("VÀO 3 giờ trước → lần quẹt này là RA", r.d.cham?.loai === "ra", r.d);
  await A.goi("thu/cham-lo", { ds: [{ nv_id: idCnThe, loai: "vao", luc: Date.now() - 20 * 3600e3 + 1 }] });
} else console.log("(bỏ qua bài VÀO→RA: cần máy chủ thử CC_THU=1)");
r = await A.goi(`nv/${theVu.id}/cap-the`, {});
r = await cong(ddA, { k: ddA.ma_kiosk, the: theVu.the, anh: ANH });
kiem("Cấp lại thẻ: thẻ cũ hết dùng", r.d.loi === "the-sai");
const theMoi = (await A.goi(`nv/the?pb=${pbBv.id}`)).d.ds[0].the;
kiem("Thẻ mới khác thẻ cũ", theMoi !== theVu.the);
await A.goi(`nv/${theVu.id}/nghi-viec`, {});
r = await cong(ddA, { k: ddA.ma_kiosk, the: theMoi, anh: ANH });
kiem("Người nghỉ việc quẹt thẻ bị từ chối", r.d.loi === "the-nghi-viec");
r = await A.goi("hom-nay");
kiem("Hôm nay vẫn đúng sau khi có lượt quẹt thẻ", r.s === 200 && r.d.tong.da_vao >= 0);

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
