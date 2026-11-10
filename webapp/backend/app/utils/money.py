from decimal import Decimal, ROUND_HALF_UP
from typing import Union

def round_amount(amount: Union[float, int, Decimal, None], decimals: int = 2) -> float:
    if amount is None:
        return 0.0
    d = Decimal(str(amount))
    q = Decimal("10") ** -decimals
    return float(d.quantize(q, rounding=ROUND_HALF_UP))

def round_vnd(amount: Union[float, int, Decimal, None]) -> int:
    if amount is None:
        return 0
    d = Decimal(str(amount))
    return int(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

# Vietnamese number to words converter
DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]

def _read_triple(n: int, show_zero_hundred: bool = False) -> str:
    tram = n // 100
    chuc = (n % 100) // 10
    donvi = n % 10

    res = []
    if tram > 0 or show_zero_hundred:
        res.append(DIGITS[tram] + " trăm")

    if chuc > 1:
        res.append(DIGITS[chuc] + " mươi")
        if donvi == 1:
            res.append("mốt")
        elif donvi == 5:
            res.append("lăm")
        elif donvi > 0:
            res.append(DIGITS[donvi])
    elif chuc == 1:
        res.append("mười")
        if donvi == 1:
            res.append("một")
        elif donvi == 5:
            res.append("lăm")
        elif donvi > 0:
            res.append(DIGITS[donvi])
    elif chuc == 0:
        if (tram > 0 or show_zero_hundred) and donvi > 0:
            res.append("lẻ")
        if donvi > 0:
            res.append(DIGITS[donvi])

    return " ".join(res)

def number_to_words_vietnamese(number: Union[int, float, Decimal], currency_suffix: str = "đồng") -> str:
    """
    Convert a numeric amount into standard Vietnamese capitalized words.
    e.g. 1500000 -> "Một triệu năm trăm ngàn đồng chẵn."
    """
    try:
        n = int(round(float(number)))
    except Exception:
        return ""

    if n == 0:
        return f"Không {currency_suffix}."

    is_negative = n < 0
    n = abs(n)

    scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"]
    groups = []
    while n > 0:
        groups.append(n % 1000)
        n //= 1000

    words = []
    for i in range(len(groups) - 1, -1, -1):
        g = groups[i]
        if g > 0:
            # Show zero hundred if it's not the highest group
            show_zero_hundred = (i < len(groups) - 1)
            t_words = _read_triple(g, show_zero_hundred)
            if t_words:
                scale = scales[i]
                if scale:
                    words.append(f"{t_words} {scale}")
                else:
                    words.append(t_words)

    result_str = " ".join(words).strip()
    # Normalize spaces
    result_str = " ".join(result_str.split())
    if result_str:
        result_str = result_str[0].upper() + result_str[1:]
    if is_negative:
        result_str = "Âm " + result_str

    if currency_suffix:
        return f"{result_str} {currency_suffix} chẵn."
    return f"{result_str}."
