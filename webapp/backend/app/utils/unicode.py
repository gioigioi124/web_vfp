import unicodedata
from typing import Any, Dict, List, Optional, Union

# Full TCVN3 (ABC 1-byte) -> Unicode (NFC) mapping table
TCVN3_TO_UNICODE: Dict[int, str] = {
    0xB8: 'á', 0xB5: 'à', 0xB6: 'ả', 0xB7: 'ã', 0xB9: 'ạ',
    0xCA: 'ă', 0xBE: 'ắ', 0xBB: 'ằ', 0xBC: 'ẳ', 0xBD: 'ẵ', 0xC6: 'ặ',
    0xD0: 'â', 0xC7: 'ấ', 0xC8: 'ầ', 0xC9: 'ẩ', 0xCB: 'ẫ', 0xCC: 'ậ',
    0xD1: 'é', 0xCE: 'è', 0xCF: 'ẻ', 0xD2: 'ẽ', 0xD3: 'ẹ',
    0xD8: 'ê', 0xD4: 'ế', 0xD5: 'ề', 0xD6: 'ể', 0xD7: 'ễ', 0xD9: 'ệ',
    0xDD: 'í', 0xDA: 'ì', 0xDB: 'ỉ', 0xDC: 'ĩ', 0xDE: 'ị',
    0xDF: 'ó', 0xE1: 'ò', 0xE2: 'ỏ', 0xE3: 'õ', 0xE4: 'ọ',
    0xEE: 'ô', 0xE5: 'ố', 0xE6: 'ồ', 0xE7: 'ổ', 0xE8: 'ỗ', 0xED: 'ộ',
    0xF3: 'ơ', 0xEF: 'ớ', 0xF1: 'ờ', 0xF2: 'ở', 0xF4: 'ỡ', 0xF5: 'ợ',
    0xF8: 'ú', 0xF6: 'ù', 0xF7: 'ủ', 0xFA: 'ũ', 0xFB: 'ụ',
    0xFC: 'ư', 0xFD: 'ứ', 0xFE: 'ừ', 0x80: 'ử', 0x81: 'ữ', 0x82: 'ự',
    0x87: 'ý', 0x83: 'ỳ', 0x84: 'ỷ', 0x85: 'ỹ', 0x86: 'ỵ',
    0xAE: 'đ', 0xA7: 'đ',
    # Uppercase base representations in TCVN3
    0xC1: 'Ă', 0xC2: 'Â', 0xC3: 'Ê', 0xC4: 'Ô', 0xC5: 'Ơ', 0xA2: 'Ư', 0xA1: 'Đ'
}

# Reverse mapping for Unicode -> TCVN3
UNICODE_TO_TCVN3: Dict[str, int] = {v: k for k, v in TCVN3_TO_UNICODE.items()}

def tcvn_to_unicode(text: Optional[Union[str, bytes]]) -> str:
    """
    Convert a TCVN3 string or byte sequence to normalized Unicode NFC.
    Safe against None, non-string, or already-unicode inputs.
    """
    if text is None:
        return ""
    if isinstance(text, bytes):
        try:
            # Decode using cp1252/latin-1 to preserve exact 0x80-0xFF byte values
            text = text.decode("latin-1")
        except Exception:
            return ""
    elif not isinstance(text, str):
        text = str(text)

    res = []
    for char in text:
        code = ord(char)
        if code in TCVN3_TO_UNICODE:
            res.append(TCVN3_TO_UNICODE[code])
        else:
            res.append(char)
    return unicodedata.normalize("NFC", "".join(res)).strip()

def unicode_to_tcvn(text: Optional[str]) -> str:
    """
    Convert a normalized Unicode string to TCVN3 format.
    Safely fallback to original character if no single-byte representation exists.
    """
    if not text:
        return ""
    uni_norm = unicodedata.normalize("NFC", str(text))
    res = []
    for char in uni_norm:
        if char in UNICODE_TO_TCVN3:
            res.append(chr(UNICODE_TO_TCVN3[char]))
        else:
            res.append(char)
    return "".join(res)

def decode_row_strings(row_dict: Dict[str, Any], text_keys: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Helper to apply tcvn_to_unicode to specific keys in a row dictionary,
    or to all string values if text_keys is not provided.
    """
    cleaned: Dict[str, Any] = {}
    for k, v in row_dict.items():
        if isinstance(v, str):
            v_stripped = v.strip()
            if text_keys is None or k.lower() in [tk.lower() for tk in text_keys]:
                cleaned[k] = tcvn_to_unicode(v_stripped)
            else:
                cleaned[k] = v_stripped
        else:
            cleaned[k] = v
    return cleaned
