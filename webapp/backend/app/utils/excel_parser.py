"""Shared stdlib Excel (.xlsx/.xlsm) and CSV/TSV parser helpers (no external dependencies)."""

import csv
from datetime import date, datetime, timedelta
import io
import math
import re
from typing import Any, Dict, List, Optional
import xml.etree.ElementTree as ET
import zipfile


def excel_col_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha()).upper()
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return max(0, idx - 1)


def parse_excel_date(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, datetime):
        return raw.strftime("%Y-%m-%d")
    if isinstance(raw, date):
        return raw.strftime("%Y-%m-%d")
    s = str(raw).strip()
    if not s:
        return ""
    # Excel serial number (e.g. 46345 or 46345.0)
    try:
        num = float(s)
        if 20000 <= num <= 80000:
            base = date(1899, 12, 30)
            return (base + timedelta(days=int(num))).strftime("%Y-%m-%d")
    except ValueError:
        pass

    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%y"):
        try:
            return datetime.strptime(s[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def parse_amount(raw: Any) -> Optional[float]:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        if math.isnan(float(raw)):
            return None
        return float(raw)
    s = str(raw).strip()
    if not s:
        return None
    s = s.replace(" ", "").replace("₫", "").replace("VND", "")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        if len(parts[-1]) == 3 and all(p.isdigit() for p in parts if p):
            s = "".join(parts)
        else:
            s = s.replace(",", ".")
    elif "." in s:
        parts = s.split(".")
        if len(parts) > 2 or (
            len(parts) == 2
            and len(parts[-1]) == 3
            and parts[0].lstrip("-").isdigit()
        ):
            s = "".join(parts)
    try:
        return float(s)
    except ValueError:
        return None


def clean_cell_text(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    s = str(val).strip()
    if s.upper() == "NAN":
        return ""
    # Fix pandas-style float strings like "9715571.0"
    if re.match(r"^\d+\.0$", s):
        return s[:-2]
    return s


def clean_upper_code(val: Any) -> str:
    return clean_cell_text(val).upper()


def parse_xlsx_rows(content: bytes) -> List[List[str]]:
    """Parse first worksheet of an .xlsx/.xlsm file using Python stdlib zipfile + xml."""
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.iter():
                if si.tag.endswith("}si") or si.tag == "si":
                    texts = [
                        t.text or ""
                        for t in si.iter()
                        if t.tag.endswith("}t") or t.tag == "t"
                    ]
                    shared_strings.append("".join(texts))

        sheet_names = sorted(
            n
            for n in zf.namelist()
            if re.match(r"^xl/worksheets/sheet\d+\.xml$", n)
        )
        if not sheet_names:
            raise ValueError("Không tìm thấy worksheet nào trong file Excel.")

        sheet_root = ET.fromstring(zf.read(sheet_names[0]))
        rows_out: List[List[str]] = []
        for row_el in sheet_root.iter():
            if not (row_el.tag.endswith("}row") or row_el.tag == "row"):
                continue
            row_map: Dict[int, str] = {}
            max_col = -1
            for c_el in row_el:
                if not (c_el.tag.endswith("}c") or c_el.tag == "c"):
                    continue
                ref = c_el.attrib.get("r", "")
                col_idx = excel_col_index(ref) if ref else (max_col + 1)
                max_col = max(max_col, col_idx)
                cell_type = c_el.attrib.get("t", "")

                val_str = ""
                if cell_type == "inlineStr":
                    val_str = "".join(
                        t.text or ""
                        for t in c_el.iter()
                        if t.tag.endswith("}t") or t.tag == "t"
                    )
                else:
                    v_el = next(
                        (ch for ch in c_el if ch.tag.endswith("}v") or ch.tag == "v"),
                        None,
                    )
                    if v_el is not None and v_el.text is not None:
                        if cell_type == "s":
                            idx = int(v_el.text)
                            val_str = (
                                shared_strings[idx]
                                if 0 <= idx < len(shared_strings)
                                else ""
                            )
                        else:
                            val_str = v_el.text
                row_map[col_idx] = val_str.strip()

            if row_map:
                width = max(row_map.keys()) + 1
                rows_out.append([row_map.get(i, "") for i in range(width)])
        return rows_out


def parse_tabular_upload(filename: str, content: bytes) -> List[List[str]]:
    lower_name = (filename or "").lower()
    if lower_name.endswith(".xlsx") or lower_name.endswith(".xlsm"):
        return parse_xlsx_rows(content)
    if (
        lower_name.endswith(".csv")
        or lower_name.endswith(".tsv")
        or lower_name.endswith(".txt")
    ):
        text = None
        for enc in ("utf-8-sig", "utf-8", "cp1258", "latin-1"):
            try:
                text = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            raise ValueError("Không thể giải mã nội dung file CSV/TSV.")
        lines = text.splitlines()
        delim = "\t" if (lines and "\t" in lines[0]) else ","
        return [
            [c.strip() for c in row]
            for row in csv.reader(io.StringIO(text), delimiter=delim)
        ]
    try:
        return parse_xlsx_rows(content)
    except Exception:
        raise ValueError(
            "Định dạng file chưa hỗ trợ. Vui lòng chọn file .xlsx, .xlsm hoặc .csv."
        )
