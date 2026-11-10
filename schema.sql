-- TRENTAY Chấm Công — cấu trúc D1. Nhiều doanh nghiệp dùng chung một CSDL:
-- mọi bảng nghiệp vụ có dn_id, và máy chủ chỉ lấy dn_id từ PHIÊN (hoặc từ mã kiosk), không từ thân yêu cầu.

CREATE TABLE IF NOT EXISTS doanh_nghiep (
  id TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  ngon_ngu TEXT NOT NULL DEFAULT 'vi',
  khoa_qr TEXT NOT NULL,                -- bí mật ký mã QR động, không bao giờ trả ra ngoài
  bat_qr INTEGER NOT NULL DEFAULT 1,    -- nhân viên văn phòng phải quét QR ở quầy
  bat_gps INTEGER NOT NULL DEFAULT 1,   -- phải gửi vị trí lúc bấm
  bat_selfie INTEGER NOT NULL DEFAULT 1,
  giu_anh_ngay INTEGER NOT NULL DEFAULT 60,
  cong_chuan INTEGER NOT NULL DEFAULT 26,
  tao_luc INTEGER NOT NULL,
  lark_app_id TEXT, lark_secret TEXT, lark_base TEXT, lark_lan_cuoi TEXT  -- nối bảng lương sang Lark Base của công ty
);

CREATE TABLE IF NOT EXISTS nguoi_dung (
  id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  ten TEXT NOT NULL,
  email TEXT UNIQUE,                    -- chủ / quản lý thường dùng email
  sdt TEXT UNIQUE,                      -- nhân viên thường dùng SĐT
  ma_nv TEXT,
  vai TEXT NOT NULL DEFAULT 'nhan_vien',  -- chu | quan_ly | nhan_vien
  che_do TEXT NOT NULL DEFAULT 'van_phong', -- van_phong | thi_truong
  ca_id TEXT,
  dia_diem_id TEXT,
  mk_bam TEXT, mk_muoi TEXT,            -- NULL khi chưa nhận lời mời
  ma_moi TEXT UNIQUE,                   -- mã trong link mời, xoá sau khi nhận
  may_bam TEXT,                         -- băm mã máy đã gắn; NULL = chưa gắn
  dong_y_luc INTEGER, dong_y_ban TEXT,  -- đồng ý xử lý vị trí + ảnh chấm công
  trang_thai TEXT NOT NULL DEFAULT 'hoat_dong', -- hoat_dong | nghi_viec
  tao_luc INTEGER NOT NULL,
  phong_ban_id TEXT,
  pham_vi TEXT NOT NULL DEFAULT 'cong_ty', -- quản lý: cong_ty | phong_ban (chỉ thấy người trong phòng ban của mình)
  ten_tim TEXT NOT NULL DEFAULT '',        -- tên bỏ dấu, chữ thường, để tìm
  ma_the TEXT,                             -- mã in trên thẻ chấm ở cổng; cấp lại là thẻ cũ hết dùng
  theo_doi_dong_y_luc INTEGER,             -- đồng ý theo dõi lộ trình (công khai, chỉ trong ca) — RIÊNG, nặng hơn đồng ý chấm công
  theo_doi_dong_y_ban TEXT,
  so_phu_thuoc INTEGER NOT NULL DEFAULT 0,   -- người phụ thuộc (giảm trừ gia cảnh)
  gpld_het TEXT                              -- hạn giấy phép lao động (giáo viên nước ngoài)
);
CREATE INDEX IF NOT EXISTS nd_dn ON nguoi_dung(dn_id);
CREATE INDEX IF NOT EXISTS nd_pb ON nguoi_dung(dn_id, phong_ban_id);
CREATE INDEX IF NOT EXISTS nd_tim ON nguoi_dung(dn_id, ten_tim);
CREATE UNIQUE INDEX IF NOT EXISTS nd_the ON nguoi_dung(ma_the);

CREATE TABLE IF NOT EXISTS phong_ban (id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, ten TEXT NOT NULL, tao_luc INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pb_dn ON phong_ban(dn_id);

CREATE TABLE IF NOT EXISTS dia_diem (
  id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  ten TEXT NOT NULL,
  lat REAL, lng REAL,
  ban_kinh INTEGER NOT NULL DEFAULT 150,
  ip_ds TEXT NOT NULL DEFAULT '',       -- IP mạng văn phòng, cách nhau dấu phẩy; "1.2.3." = khớp đầu
  ma_kiosk TEXT NOT NULL,               -- mở được màn QR; đổi mã là màn cũ chết
  tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS dd_dn ON dia_diem(dn_id);

CREATE TABLE IF NOT EXISTS ca (
  id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  ten TEXT NOT NULL,
  gio_vao TEXT NOT NULL,                -- "08:00"
  gio_ra TEXT NOT NULL,                 -- "17:30"; nhỏ hơn giờ vào = ca qua đêm
  nghi_phut INTEGER NOT NULL DEFAULT 60,
  cho_muon_phut INTEGER NOT NULL DEFAULT 5,
  ngay_lam TEXT NOT NULL DEFAULT '1,2,3,4,5,6', -- thứ trong tuần, 0 = Chủ nhật
  tao_luc INTEGER NOT NULL
);

-- Bản ghi THÔ: chỉ thêm, không sửa. Sửa sai đi qua đơn được duyệt.
CREATE TABLE IF NOT EXISTS cham (
  id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  nv_id TEXT NOT NULL,
  loai TEXT NOT NULL,                   -- vao | ra
  luc INTEGER NOT NULL,                 -- giờ MÁY CHỦ
  dia_diem_id TEXT,
  lat REAL, lng REAL, sai_so INTEGER, cach_met INTEGER,
  ip TEXT,
  qua_qr INTEGER NOT NULL DEFAULT 0,
  co_anh INTEGER NOT NULL DEFAULT 0,
  canh_bao TEXT NOT NULL DEFAULT '',    -- danh sách mã, cách nhau dấu phẩy
  qua_the INTEGER NOT NULL DEFAULT 0    -- chấm bằng thẻ ở máy cổng
);
CREATE INDEX IF NOT EXISTS cham_nv ON cham(dn_id, nv_id, luc);
CREATE INDEX IF NOT EXISTS cham_dn ON cham(dn_id, luc);

-- Ảnh để riêng một bảng để tự xoá sau N ngày mà bản ghi giờ vẫn còn.
CREATE TABLE IF NOT EXISTS anh_cham (
  cham_id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  du_lieu TEXT NOT NULL,                -- data URL khi kho='d1'; rỗng khi ảnh nằm ở R2
  luc INTEGER NOT NULL,
  kho TEXT NOT NULL DEFAULT 'd1'        -- d1 | r2 (khoá R2 = <dn_id>/<cham_id>.jpg)
);
CREATE INDEX IF NOT EXISTS anh_luc ON anh_cham(luc);
CREATE INDEX IF NOT EXISTS anh_dn_luc ON anh_cham(dn_id, luc);

CREATE TABLE IF NOT EXISTS don (
  id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  nv_id TEXT NOT NULL,
  loai TEXT NOT NULL,                   -- quen_cham | nghi_phep | nghi_khong_luong
  ngay TEXT NOT NULL,                   -- YYYY-MM-DD (giờ VN)
  den_ngay TEXT NOT NULL,
  gio_vao TEXT, gio_ra TEXT,            -- đơn quên chấm
  ly_do TEXT NOT NULL DEFAULT '',
  trang_thai TEXT NOT NULL DEFAULT 'cho', -- cho | duyet | tu_choi | huy
  nguoi_duyet TEXT, duyet_luc INTEGER, ghi_chu_duyet TEXT,
  tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS don_dn ON don(dn_id, trang_thai);

CREATE TABLE IF NOT EXISTS phien (bam TEXT PRIMARY KEY, nguoi_id TEXT NOT NULL, het_han INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS thu_dang_nhap (khoa TEXT PRIMARY KEY, so INTEGER NOT NULL, dau INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS nhat_ky (id INTEGER PRIMARY KEY AUTOINCREMENT, dn_id TEXT, ai TEXT, viec TEXT, doi_tuong TEXT, luc INTEGER);
CREATE INDEX IF NOT EXISTS nk_dn ON nhat_ky(dn_id, luc);

-- ===== GĐ4 theo dõi lộ trình (công khai, chỉ trong ca) =====
CREATE TABLE IF NOT EXISTS ca_phien (
  id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, nv_id TEXT NOT NULL,
  bat_luc INTEGER NOT NULL, tat_luc INTEGER, dong_y_ban TEXT NOT NULL DEFAULT '', may TEXT, tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cp_mo ON ca_phien(dn_id, tat_luc);
CREATE INDEX IF NOT EXISTS cp_nv ON ca_phien(dn_id, nv_id, bat_luc);

CREATE TABLE IF NOT EXISTS vi_tri (
  id INTEGER PRIMARY KEY AUTOINCREMENT, dn_id TEXT NOT NULL, nv_id TEXT NOT NULL, phien_id TEXT NOT NULL,
  luc INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, do_cx INTEGER, pin INTEGER, toc_do REAL
);
CREATE INDEX IF NOT EXISTS vt_nv ON vi_tri(dn_id, nv_id, luc);
CREATE INDEX IF NOT EXISTS vt_dn ON vi_tri(dn_id, luc);
CREATE INDEX IF NOT EXISTS vt_phien ON vi_tri(phien_id, luc);

CREATE TABLE IF NOT EXISTS ghe_tham (
  id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, nv_id TEXT NOT NULL, phien_id TEXT,
  loai TEXT NOT NULL DEFAULT 'khach', ten TEXT NOT NULL DEFAULT '', lat REAL, lng REAL,
  luc_den INTEGER NOT NULL, luc_di INTEGER, ghi_chu TEXT NOT NULL DEFAULT '', co_anh INTEGER NOT NULL DEFAULT 0, tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gt_nv ON ghe_tham(dn_id, nv_id, luc_den);

-- ===== GĐ3 tính lương =====
CREATE TABLE IF NOT EXISTS kieu_thue (
  id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, ten TEXT NOT NULL,
  cach_tinh TEXT NOT NULL DEFAULT 'thang',   -- thang | gio | khoan
  dong_bh INTEGER NOT NULL DEFAULT 0,
  thue TEXT NOT NULL DEFAULT 'luy_tien',     -- luy_tien | khau_tru | khong_cu_tru | khong
  tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS kt_dn ON kieu_thue(dn_id);
CREATE TABLE IF NOT EXISTS bac_gv (id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, ten TEXT NOT NULL, don_gia INTEGER NOT NULL DEFAULT 0, tao_luc INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS bg_dn ON bac_gv(dn_id);
CREATE TABLE IF NOT EXISTS he_so (
  id TEXT PRIMARY KEY, dn_id TEXT NOT NULL,
  nhom TEXT NOT NULL,                        -- khung_gio | hinh_thuc | loai_lop
  ten TEXT NOT NULL, gia_tri REAL NOT NULL DEFAULT 1,
  ma TEXT, gio_tu TEXT, gio_den TEXT, thu TEXT, tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hs_dn ON he_so(dn_id);
-- Một người có NHIỀU dòng công việc (kiêm nhiệm): mỗi dòng một kiểu thuê, một cách tính tiền.
CREATE TABLE IF NOT EXISTS cong_viec (
  id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, nv_id TEXT NOT NULL, kieu_thue_id TEXT NOT NULL,
  ten_vai TEXT NOT NULL,
  luong_thang INTEGER NOT NULL DEFAULT 0,    -- lương tháng (cach_tinh=thang) hoặc tiền khoán (khoan)
  bac_gv_id TEXT, don_gia_rieng INTEGER,     -- lương giờ: theo bậc, hoặc đơn giá riêng người này
  luong_bh INTEGER,                          -- NULL = bằng lương tháng
  bh_cty_chiu_het INTEGER NOT NULL DEFAULT 0,
  pc_dt INTEGER NOT NULL DEFAULT 0, pc_xang INTEGER NOT NULL DEFAULT 0, pc_nha INTEGER NOT NULL DEFAULT 0, pc_khac INTEGER NOT NULL DEFAULT 0,
  pc_mien_thue INTEGER NOT NULL DEFAULT 0,   -- điện thoại/xăng là khoán chi theo quy chế
  con_hieu_luc INTEGER NOT NULL DEFAULT 1, tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cv_nv ON cong_viec(dn_id, nv_id);
-- Buổi dạy: GPS kiểm theo cơ sở CỦA BUỔI (giáo viên dạy ở cơ sở khác vẫn xác nhận đúng chỗ); online không đòi GPS.
CREATE TABLE IF NOT EXISTS buoi_day (
  id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, nv_id TEXT NOT NULL, cv_id TEXT NOT NULL,
  lop TEXT NOT NULL DEFAULT '', loai_lop_id TEXT,
  ngay TEXT NOT NULL, gio_bd TEXT NOT NULL, gio_kt TEXT NOT NULL,
  hinh_thuc TEXT NOT NULL DEFAULT 'offline', dia_diem_id TEXT,
  trang_thai TEXT NOT NULL DEFAULT 'ke_hoach', -- ke_hoach | dang_day | xong | duyet | huy
  bat_luc INTEGER, ket_luc INTEGER, lat REAL, lng REAL, cach_met INTEGER, co_anh INTEGER NOT NULL DEFAULT 0,
  canh_bao TEXT NOT NULL DEFAULT '', tao_boi TEXT, tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bd_dn ON buoi_day(dn_id, ngay);
CREATE INDEX IF NOT EXISTS bd_nv ON buoi_day(dn_id, nv_id, ngay);
CREATE TABLE IF NOT EXISTS lam_them (
  id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, nv_id TEXT NOT NULL, cv_id TEXT NOT NULL,
  ngay TEXT NOT NULL, so_gio REAL NOT NULL, loai_ngay TEXT NOT NULL DEFAULT 'thuong', he_so REAL,
  ly_do TEXT NOT NULL DEFAULT '', trang_thai TEXT NOT NULL DEFAULT 'cho', nguoi_duyet TEXT, duyet_luc INTEGER, tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lt_dn ON lam_them(dn_id, ngay);
-- Khoá kỳ: chụp nguyên kết quả, từ đó bảng lương tháng đó không đổi dù dữ liệu gốc đổi.
CREATE TABLE IF NOT EXISTS ky_luong (
  dn_id TEXT NOT NULL, thang TEXT NOT NULL, du_lieu TEXT NOT NULL, khoa_luc INTEGER NOT NULL, khoa_boi TEXT,
  PRIMARY KEY (dn_id, thang)
);
