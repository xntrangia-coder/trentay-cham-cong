-- Xoá công ty thử (chủ có email @thu.vn) và mọi dữ liệu của chúng. Giữ nguyên công ty thật.
CREATE TABLE IF NOT EXISTS _xoa AS SELECT DISTINCT dn_id AS id FROM nguoi_dung WHERE email LIKE '%@thu.vn';
DELETE FROM phien WHERE nguoi_id IN (SELECT id FROM nguoi_dung WHERE dn_id IN (SELECT id FROM _xoa));
DELETE FROM anh_cham WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM cham WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM don WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM ca WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM dia_diem WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM phong_ban WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM nhat_ky WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM ca_phien WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM vi_tri WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM ghe_tham WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM nguoi_dung WHERE dn_id IN (SELECT id FROM _xoa);
DELETE FROM doanh_nghiep WHERE id IN (SELECT id FROM _xoa);
DROP TABLE _xoa;
DELETE FROM thu_dang_nhap;
