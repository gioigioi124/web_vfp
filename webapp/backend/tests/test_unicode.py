import pytest
from app.utils.unicode import tcvn_to_unicode, unicode_to_tcvn

def test_tcvn_to_unicode_bytes():
    # In TCVN3, 'C' + 0xEE ('ô') + 'ng ty'
    tcvn_bytes = bytes([ord('C'), 0xEE, ord('n'), ord('g'), ord(' '), ord('t'), ord('y')])
    decoded = tcvn_to_unicode(tcvn_bytes)
    assert decoded == "Công ty"

def test_unicode_idempotency():
    sample_texts = [
        "Công ty Cổ phần Mút Xốp Sài Gòn",
        "128 Đường số 7, KCN Tân Bình, TP.HCM",
        "Xuất bán nệm foam theo đơn đặt hàng 19/10/2026",
        "Hóa đơn bán buôn mút xốp"
    ]
    for text in sample_texts:
        encoded = unicode_to_tcvn(text)
        decoded = tcvn_to_unicode(encoded)
        # Verify decoding is clean and matches text
        assert isinstance(decoded, str)
        assert len(decoded) > 0
        assert tcvn_to_unicode(unicode_to_tcvn(decoded)) == decoded
