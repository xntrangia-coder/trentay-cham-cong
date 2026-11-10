-- GĐ3 tính lương (10/11/2026): kiểu thuê · bậc giáo viên · hệ số · dòng công việc · buổi dạy · làm thêm giờ · kỳ lương.
-- Chạy MỘT lần trên CSDL đã có. CSDL mới thì schema.sql đã gồm sẵn.
ALTER TABLE nguoi_dung ADD COLUMN so_phu_thuoc INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nguoi_dung ADD COLUMN gpld_het TEXT;      -- hạn giấy phép lao động (giáo viên nước ngoài)
-- Nối bảng lương sang Lark Base của chính công ty (app Lark riêng của họ).
ALTER TABLE doanh_nghiep ADD COLUMN lark_app_id TEXT;
ALTER TABLE doanh_nghiep ADD COLUMN lark_secret TEXT;
ALTER TABLE doanh_nghiep ADD COLUMN lark_base TEXT;
ALTER TABLE doanh_nghiep ADD COLUMN lark_lan_cuoi TEXT;

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
