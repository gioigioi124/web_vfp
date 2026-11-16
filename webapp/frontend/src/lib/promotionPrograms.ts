import {
  PromotionProgram,
  isProgramActiveOnDate,
} from "./promotions";

export const GIFT_CODES = {
  RUOT_GOI_VIMATT_45X65: "920206045065",
  RUOT_GOI_ALIAS_45X65: "92020604506512",
} as const;

/**
 * Danh sách các chương trình khuyến mại.
 * Để bổ sung chương trình mới trong tương lai, chỉ cần thêm một cấu hình `PromotionProgram` vào mảng này.
 */
export const PROMOTION_PROGRAMS: PromotionProgram[] = [
  {
    id: "km-2026-08-11",
    name: "Chương trình Khuyến Mại 13/08/2026 – 30/11/2026",
    shortName: "CTKM 08–11/2026",
    startDate: "2026-08-13",
    endDate: "2026-11-30",
    quantityField: "so_luong9",
    excludeNominalGiftRowsByDefault: true,
    rules: [
      {
        id: "stt1-dem-lo-xo",
        order: 1,
        name: "Đệm lò xo",
        shortName: "Đệm lò xo",
        buyUnit: "đệm",
        conditionSummary: "Đầu mã: 80, 81",
        matcher: {
          codePrefixes: ["80", "81"],
        },
        options: [
          {
            id: "opt-1",
            label: "Mua 1 đệm tặng 2 ruột gối Vimatt 45x65",
            buyQty: 1,
            giftQtyPerSet: 2,
            giftCode: GIFT_CODES.RUOT_GOI_VIMATT_45X65,
            giftName: "Ruột gối Vimatt 45x65",
            giftShortName: "RG Vimatt",
            giftUnit: "cái",
          },
        ],
      },
      {
        id: "stt2-dem-1-tang-1",
        order: 2,
        name: "Đệm bông ép (Vimatt, Alias, Vỏ chần...) & Đệm Foam",
        shortName: "Đệm bông/foam",
        buyUnit: "đệm",
        conditionSummary:
          "Đầu mã: 6010, 6704, 6104, 6001, 6701, 6101, 6901, 7808, 7810, 13105, 13101, 13001, 7800, 13104, 13004, 13035–13335, 13024–13324, 7700, 7900, 6501–6811, 6504, 6604, 6503, 6603, 6506, 6606, 6508, 6608",
        matcher: {
          codePrefixes: [
            "6010",
            "6704",
            "6104",
            "6001",
            "6701",
            "6101",
            "6901",
            "7808",
            "7810",
            "13105",
            "13101",
            "13001",
            "7800",
            "13104",
            "13004",
            "13035",
            "13135",
            "13235",
            "13335",
            "13024",
            "13124",
            "13224",
            "13324",
            "7700",
            "7900",
            "6501",
            "6601",
            "6801",
            "6811",
            "6504",
            "6604",
            "6503",
            "6603",
            "6506",
            "6606",
            "6508",
            "6608",
          ],
        },
        options: [
          {
            id: "opt-1",
            label: "Mua 1 đệm tặng 1 ruột gối Vimatt 45x65",
            buyQty: 1,
            giftQtyPerSet: 1,
            giftCode: GIFT_CODES.RUOT_GOI_VIMATT_45X65,
            giftName: "Ruột gối Vimatt 45x65",
            giftShortName: "RG Vimatt",
            giftUnit: "cái",
          },
        ],
      },
      {
        id: "stt3-dem-fly-see",
        order: 3,
        name: "Đệm bông ép gấp ba Fly, See (vỏ không chần)",
        shortName: "Fly, See",
        buyUnit: "đệm",
        conditionSummary: "Đầu mã: 6008, 6706, 6106, 6003, 6703, 6103",
        matcher: {
          codePrefixes: ["6008", "6706", "6106", "6003", "6703", "6103"],
        },
        options: [
          {
            id: "opt-1",
            label: "Mua 2 đệm tặng 1 ruột gối Vimatt 45x65",
            buyQty: 2,
            giftQtyPerSet: 1,
            giftCode: GIFT_CODES.RUOT_GOI_VIMATT_45X65,
            giftName: "Ruột gối Vimatt 45x65",
            giftShortName: "RG Vimatt",
            giftUnit: "cái",
          },
        ],
      },
      {
        id: "stt4-ga-bo-5-mon-sd-td-te",
        order: 4,
        name: "Ga bộ 5 món: SD, TD, TE",
        shortName: "Ga bộ SD, TD, TE",
        buyUnit: "bộ",
        conditionSummary: "Đầu mã 91 và tên có chứa SD, TD, TE",
        matcher: {
          codePrefixes: ["91"],
          nameTokens: ["SD", "TD", "TE"],
        },
        options: [
          {
            id: "opt-10-1",
            label: "Mua 10 bộ tặng 1 bộ giá trị thấp nhất",
            buyQty: 10,
            giftQtyPerSet: 1,
            giftName: "Ga bộ 5 món (SD/TD/TE) giá trị thấp nhất",
            giftShortName: "Bộ thấp nhất",
            giftUnit: "bộ",
            isLowestValueGift: true,
          },
          {
            id: "opt-1-1",
            label: "Hoặc: Mua 1 bộ tặng 1 ruột gối Alias 45x65",
            buyQty: 1,
            giftQtyPerSet: 1,
            giftCode: GIFT_CODES.RUOT_GOI_ALIAS_45X65,
            giftName: "Ruột gối Alias 45x65",
            giftShortName: "RG Alias",
            giftUnit: "cái",
          },
        ],
      },
      {
        id: "stt5-ga-bo-5-mon-tm-tmd-tp-st",
        order: 5,
        name: "Ga bộ 5 món: TM, TMD, TP, ST",
        shortName: "Ga bộ TM, TMD, TP, ST",
        buyUnit: "bộ",
        conditionSummary: "Đầu mã 91 và tên có chứa TM, TMD, TP, ST",
        matcher: {
          codePrefixes: ["91"],
          nameTokens: ["TM", "TMD", "TP", "ST"],
        },
        options: [
          {
            id: "opt-10-1",
            label: "Mua 10 bộ tặng 1 bộ giá trị thấp nhất",
            buyQty: 10,
            giftQtyPerSet: 1,
            giftName: "Ga bộ 5 món (TM/TMD/TP/ST) giá trị thấp nhất",
            giftShortName: "Bộ thấp nhất",
            giftUnit: "bộ",
            isLowestValueGift: true,
          },
          {
            id: "opt-1-1",
            label: "Hoặc: Mua 1 bộ tặng 1 ruột gối Vimatt 45x65",
            buyQty: 1,
            giftQtyPerSet: 1,
            giftCode: GIFT_CODES.RUOT_GOI_VIMATT_45X65,
            giftName: "Ruột gối Vimatt 45x65",
            giftShortName: "RG Vimatt",
            giftUnit: "cái",
          },
        ],
      },
      {
        id: "stt6-cac-loai-ga-chan-goi-mau",
        order: 6,
        name: "Các loại ga, vỏ gối, vỏ chăn, chăn hè/4 mùa (màu quy định)",
        shortName: "Ga, chăn, gối màu",
        buyUnit: "bộ",
        conditionSummary:
          "Đầu mã 88, 87, 95 (trừ 9511), 96, 93, 9714, 9715 và tên chứa TM, TMD, TP, ST, TL, SD, TD, TE",
        matcher: {
          codePrefixes: ["88", "87", "95", "96", "93", "9714", "9715"],
          excludeCodePrefixes: ["9511"],
          nameTokens: ["TM", "TMD", "TP", "ST", "TL", "SD", "TD", "TE"],
        },
        options: [
          {
            id: "opt-1",
            label: "Mua 10 bộ tặng 1 bộ giá trị thấp nhất",
            buyQty: 10,
            giftQtyPerSet: 1,
            giftName: "Sản phẩm giá trị thấp nhất (nhóm ga/chăn/gối)",
            giftShortName: "Bộ thấp nhất",
            giftUnit: "bộ",
            isLowestValueGift: true,
          },
        ],
      },
      {
        id: "stt7-ruot-goi",
        order: 7,
        name: "Các loại ruột gối",
        shortName: "Ruột gối",
        buyUnit: "cái",
        conditionSummary: "Đầu mã: 920206",
        matcher: {
          codePrefixes: ["920206"],
        },
        options: [
          {
            id: "opt-1",
            label: "Mua 200 cái tặng 20 cái",
            buyQty: 200,
            giftQtyPerSet: 20,
            giftCode: "920206",
            giftName: "Ruột gối",
            giftShortName: "RG",
            giftUnit: "cái",
          },
        ],
      },
      {
        id: "stt8-ruot-chan-dong-thu",
        order: 8,
        name: "Ruột chăn đông + Thu",
        shortName: "Ruột chăn Đ/T",
        buyUnit: "cái",
        conditionSummary: "Đầu mã: 980106, 980108 (loại trừ 980107 ruột chăn hè)",
        matcher: {
          codePrefixes: ["980106", "980108"],
        },
        options: [
          {
            id: "opt-1",
            label: "Mua 100 cái tặng 10 cái",
            buyQty: 100,
            giftQtyPerSet: 10,
            giftName: "Ruột chăn đông/thu",
            giftShortName: "Ruột chăn",
            giftUnit: "cái",
          },
        ],
      },
    ],
  },
];

/**
 * Chọn chương trình khuyến mại phù hợp:
 * - Nếu người dùng chọn thủ công (`overrideProgramId !== "AUTO"`), trả về chương trình đó.
 * - Ở chế độ tự động (`"AUTO"`), ưu tiên chương trình có hiệu lực theo `ngayCt`;
 *   nếu không có chương trình nào khớp ngày, trả về chương trình gần nhất (mặc định phần tử đầu)
 *   kèm trạng thái `isDateInRange = false` để giao diện hiển thị rõ.
 */
export function resolvePromotionProgram(
  ngayCt?: string,
  overrideProgramId: string = "AUTO",
  programs: PromotionProgram[] = PROMOTION_PROGRAMS,
): PromotionProgram | null {
  if (programs.length === 0) return null;
  if (overrideProgramId !== "AUTO") {
    const found = programs.find((p) => p.id === overrideProgramId);
    if (found) return found;
  }
  const active = programs.find((p) => isProgramActiveOnDate(p, ngayCt));
  return active ?? programs[0];
}
