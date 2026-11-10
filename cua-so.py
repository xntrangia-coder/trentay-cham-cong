"""TRENTAY Chấm Công — cửa sổ app riêng trên máy này (pywebview + WebView2), khung điện thoại.

    pythonw cua-so.py          # hoặc bấm đúp MO-CUA-SO.bat

Trỏ vào máy chủ thử ở cổng 8811 (MO-CUA-SO.bat tự bật nếu chưa chạy). Phiên đăng nhập được nhớ giữa các lần mở.
"""
import os
import webview

URL = os.environ.get("CC_URL", "http://127.0.0.1:8811/#dang-nhap")
KHO = os.path.join(os.environ.get("LOCALAPPDATA", "."), "trentay-cham-cong-cua-so", "webview")

if __name__ == "__main__":
    webview.create_window("TRENTAY Chấm Công", URL, width=460, height=920, min_size=(360, 600))
    webview.start(private_mode=False, storage_path=KHO)
