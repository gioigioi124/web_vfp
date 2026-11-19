import { VoucherDetail } from "../types/voucher";
import { round } from "./calc";

/**
 * Bộ lọc khớp hàng hóa theo nhiều tiêu chí kết hợp, phục vụ cấu hình
 * các chương trình khuyến mại hiện tại và tương lai mà không cần sửa engine.
 */
export interface ItemMatcher {
  /** Khớp theo đầu mã vật tư (không phân biệt hoa/thường), VD: ["80", "81"]. */
  codePrefixes?: string[];
  /** Loại trừ các đầu mã vật tư cụ thể, VD: ["9511"] khi khớp ["95"]. */
  excludeCodePrefixes?: string[];
  /** Khớp chính xác mã vật tư. */
  exactCodes?: string[];
  /**
   * Khớp mã màu / token trong tên hàng hóa (Ten_Vt).
   * Dùng khớp theo ranh giới token để tránh trùng một phần từ (VD: "ST"/"TE" trong "POLYESTER",
   * hoặc "TM" trong "TMD"), đồng thời hỗ trợ trường hợp viết liền trước số (VD: "cấpTD 5050", "vảiTM 573").
   */
  nameTokens?: string[];
  /** Khớp chuỗi con bất kỳ trong tên hàng hóa (không phân biệt hoa/thường). */
  nameContains?: string[];
  /** Loại trừ nếu tên hàng hóa chứa chuỗi con (không phân biệt hoa/thường). */
  excludeNameContains?: string[];
  /** Tất cả matcher con đều phải thỏa mãn. */
  allOf?: ItemMatcher[];
  /** Ít nhất một matcher con thỏa mãn. */
  anyOf?: ItemMatcher[];
  /** Hàm kiểm tra mở rộng cho các quy tắc đặc biệt trong tương lai. */
  customFilter?: (item: VoucherDetail) => boolean;
}

/** Một phương án trả thưởng của quy định khuyến mại (hỗ trợ quy định có lựa chọn "hoặc"). */
export interface GiftRewardOption {
  id: string;
  /** Nhãn ngắn hiển thị khi lựa chọn phương án (VD: "Mua 10 tặng 1 bộ thấp nhất"). */
  label: string;
  /** Định mức số lượng mua để đạt 1 bộ khuyến mại. */
  buyQty: number;
  /** Số lượng quà tặng trên mỗi bộ khuyến mại đạt được. */
  giftQtyPerSet: number;
  /** Mã hàng hóa quà tặng (nếu có mã cố định). */
  giftCode?: string;
  /** Tên quà tặng hiển thị. */
  giftName: string;
  /** Tên rút gọn hiển thị trên badge thanh công cụ. */
  giftShortName: string;
  /** Đơn vị tính của quà tặng ("cái", "bộ", ...). */
  giftUnit: string;
  /** Đánh dấu quà tặng là sản phẩm giá trị thấp nhất trong nhóm mua. */
  isLowestValueGift?: boolean;
}

/** Một quy định đếm bộ khuyến mại trong chương trình. */
export interface PromotionRule {
  id: string;
  order: number;
  name: string;
  shortName: string;
  buyUnit: string;
  conditionSummary: string;
  matcher: ItemMatcher;
  /** Danh sách phương án quà tặng (>= 2 phần tử nếu là quy định dạng "hoặc"). */
  options: GiftRewardOption[];
}

/** Quy tắc phân loại hàng mang ra khuyến mại (đơn giá 1–10₫) để hiển thị rõ loại quà. */
export interface GiftCategoryRule {
  id: string;
  label: string;
  matcher: ItemMatcher;
}

/** Định nghĩa một chương trình khuyến mại. */
export interface PromotionProgram {
  id: string;
  name: string;
  shortName: string;
  /** Ngày bắt đầu hiệu lực (YYYY-MM-DD), bỏ trống nếu không giới hạn đầu. */
  startDate?: string;
  /** Ngày kết thúc hiệu lực (YYYY-MM-DD), bỏ trống nếu không giới hạn cuối. */
  endDate?: string;
  /** Trường số lượng dùng để đếm trên dòng hàng (mặc định "so_luong9"). */
  quantityField?: "so_luong9" | "so_tam" | "so_luong";
  /** Bỏ qua dòng hàng tặng có đơn giá tượng trưng 1–10 VND trong phiếu bán. */
  excludeNominalGiftRowsByDefault?: boolean;
  rules: PromotionRule[];
  /** Bộ phân loại hàng tặng 1–10₫ (ưu tiên theo thứ tự từ trên xuống). */
  giftCategories?: GiftCategoryRule[];
}

export interface MatchedVoucherRow {
  rowIndex: number;
  ma_vt: string;
  ten_vt: string;
  qty: number;
  gia_nt9: number;
}

export interface EvaluatedRuleOption {
  option: GiftRewardOption;
  /** Số bộ khuyến mại đạt được = floor(matchedQty / buyQty). */
  sets: number;
  /** Tổng số lượng quà tặng = sets * giftQtyPerSet. */
  giftQty: number;
  /** Phần dư chưa đủ 1 bộ tiếp theo. */
  remainder: number;
  /** Số lượng cần thêm để đạt bộ tiếp theo (chỉ có ý nghĩa khi remainder > 0 hoặc sets === 0). */
  neededForNextSet: number;
}

export interface EvaluatedRule {
  rule: PromotionRule;
  matchedRows: MatchedVoucherRow[];
  matchedQty: number;
  selectedOptionIndex: number;
  optionResults: EvaluatedRuleOption[];
  activeResult: EvaluatedRuleOption;
  lowestUnitPriceItem: {
    ma_vt: string;
    ten_vt: string;
    gia_nt9: number;
  } | null;
}

export interface GiftSummaryItem {
  key: string;
  giftCode?: string;
  giftName: string;
  giftShortName: string;
  giftUnit: string;
  totalGiftQty: number;
}

export interface NominalGiftRow {
  rowIndex: number;
  ma_vt: string;
  ten_vt: string;
  dvt: string;
  qty: number;
  gia_nt9: number;
  categoryId: string;
  categoryLabel: string;
}

export interface NominalGiftSummaryItem {
  ma_vt: string;
  ten_vt: string;
  dvt: string;
  totalQty: number;
  rowCount: number;
  categoryId: string;
  categoryLabel: string;
}

export interface NominalGiftGroup {
  categoryId: string;
  label: string;
  totalQty: number;
  items: NominalGiftSummaryItem[];
}

export interface PromotionEvaluation {
  program: PromotionProgram;
  isDateInRange: boolean;
  evaluatedRules: EvaluatedRule[];
  matchedRules: EvaluatedRule[];
  totalMatchedQty: number;
  totalSets: number;
  giftSummary: GiftSummaryItem[];
  ignoredGiftRowCount: number;
  /** Các dòng hàng mang ra khuyến mại (đơn giá từ 1–10 đồng VND). */
  nominalGiftRows: NominalGiftRow[];
  nominalGiftItems: NominalGiftSummaryItem[];
  nominalGiftGroups: NominalGiftGroup[];
  nominalGiftTotalQty: number;
}

export interface EvaluatePromotionOptions {
  ngayCt?: string;
  maTte?: string;
  /** Bỏ qua dòng quà tặng giá 1..10 VND. Mặc định kế thừa từ cấu hình chương trình. */
  excludeNominalGiftRows?: boolean;
  /** Map `rule.id -> optionIndex` do người dùng chọn cho quy định có nhiều phương án. */
  selectedOptions?: Record<string, number>;
}

const QTY_EPSILON = 1e-9;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDateIso(dateStr?: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("T")[0].trim();
}

/** Kiểm tra ngày chứng từ có nằm trong khoảng hiệu lực của chương trình không. */
export function isProgramActiveOnDate(
  program: PromotionProgram,
  ngayCt?: string,
): boolean {
  const d = normalizeDateIso(ngayCt);
  if (!d) return true;
  if (program.startDate && d < program.startDate) return false;
  if (program.endDate && d > program.endDate) return false;
  return true;
}

/**
 * Kiểm tra tên hàng hóa có chứa một trong các token (VD: mã màu TM, TMD, TP, ST, TL, SD, TD, TE).
 * - Khớp đứng độc lập không liền chữ cái ASCII (VD: "ST5193", "TM 574", "TMD 5901").
 * - Hoặc viết dính sau từ tiếng Việt và đứng ngay trước chữ số (VD: "cấpTD 5050", "vảiTM 573", "ômTD5056").
 */
interface CompiledMatcher {
  excludeCodePrefixes: string[] | null;
  exactCodes: Set<string> | null;
  codePrefixes: string[] | null;
  excludeNameContains: string[] | null;
  nameContains: string[] | null;
  nameTokenRegex: RegExp | null;
  allOf: CompiledMatcher[] | null;
  anyOf: CompiledMatcher[] | null;
  customFilter?: (item: VoucherDetail) => boolean;
}

const compiledMatcherCache = new WeakMap<ItemMatcher, CompiledMatcher>();

function compileNameTokensRegex(tokens: string[]): RegExp | null {
  const parts: string[] = [];
  for (const rawToken of tokens) {
    const token = rawToken.trim().toUpperCase();
    if (!token) continue;
    const escaped = escapeRegExp(token);
    parts.push(`(?:(?<![A-Z])${escaped}(?![A-Z])|${escaped}(?=\\s*[-/]?\\s*\\d))`);
  }
  if (parts.length === 0) return null;
  return new RegExp(parts.join("|"));
}

function compileMatcher(matcher: ItemMatcher): CompiledMatcher {
  const cached = compiledMatcherCache.get(matcher);
  if (cached) return cached;

  const normalizeList = (arr?: string[]) => {
    if (!arr || arr.length === 0) return null;
    const cleaned = arr.map((s) => s.trim().toUpperCase()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : null;
  };

  const exactList = normalizeList(matcher.exactCodes);
  const compiled: CompiledMatcher = {
    excludeCodePrefixes: normalizeList(matcher.excludeCodePrefixes),
    exactCodes: exactList ? new Set(exactList) : null,
    codePrefixes: normalizeList(matcher.codePrefixes),
    excludeNameContains: normalizeList(matcher.excludeNameContains),
    nameContains: normalizeList(matcher.nameContains),
    nameTokenRegex: matcher.nameTokens?.length
      ? compileNameTokensRegex(matcher.nameTokens)
      : null,
    allOf: matcher.allOf?.length
      ? matcher.allOf.map((sub) => compileMatcher(sub))
      : null,
    anyOf: matcher.anyOf?.length
      ? matcher.anyOf.map((sub) => compileMatcher(sub))
      : null,
    customFilter: matcher.customFilter,
  };

  compiledMatcherCache.set(matcher, compiled);
  return compiled;
}

function matchesCompiled(
  item: VoucherDetail,
  maVt: string,
  tenUpper: string,
  c: CompiledMatcher,
): boolean {
  if (c.excludeCodePrefixes) {
    for (let i = 0; i < c.excludeCodePrefixes.length; i++) {
      if (maVt.startsWith(c.excludeCodePrefixes[i])) return false;
    }
  }

  if (c.exactCodes && !c.exactCodes.has(maVt)) {
    return false;
  }

  if (c.codePrefixes) {
    let hit = false;
    for (let i = 0; i < c.codePrefixes.length; i++) {
      if (maVt.startsWith(c.codePrefixes[i])) {
        hit = true;
        break;
      }
    }
    if (!hit) return false;
  }

  if (c.excludeNameContains) {
    for (let i = 0; i < c.excludeNameContains.length; i++) {
      if (tenUpper.includes(c.excludeNameContains[i])) return false;
    }
  }

  if (c.nameContains) {
    let hit = false;
    for (let i = 0; i < c.nameContains.length; i++) {
      if (tenUpper.includes(c.nameContains[i])) {
        hit = true;
        break;
      }
    }
    if (!hit) return false;
  }

  if (c.nameTokenRegex && !c.nameTokenRegex.test(tenUpper)) {
    return false;
  }

  if (c.allOf) {
    for (let i = 0; i < c.allOf.length; i++) {
      if (!matchesCompiled(item, maVt, tenUpper, c.allOf[i])) return false;
    }
  }

  if (c.anyOf) {
    let hit = false;
    for (let i = 0; i < c.anyOf.length; i++) {
      if (matchesCompiled(item, maVt, tenUpper, c.anyOf[i])) {
        hit = true;
        break;
      }
    }
    if (!hit) return false;
  }

  if (c.customFilter && !c.customFilter(item)) {
    return false;
  }

  return true;
}

export function hasNameToken(tenVt: string, tokens: string[]): boolean {
  if (!tenVt || tokens.length === 0) return false;
  const regex = compileNameTokensRegex(tokens);
  if (!regex) return false;
  return regex.test(tenVt.toUpperCase());
}

/** Kiểm tra một dòng vật tư có thỏa mãn ItemMatcher hay không. */
export function matchesItem(
  item: VoucherDetail,
  matcher: ItemMatcher,
): boolean {
  const maVt = (item.ma_vt || "").trim().toUpperCase();
  if (!maVt) return false;
  const tenUpper = (item.ten_vt || "").trim().toUpperCase();
  return matchesCompiled(item, maVt, tenUpper, compileMatcher(matcher));
}

function getItemQty(
  item: VoucherDetail,
  field: "so_luong9" | "so_tam" | "so_luong",
): number {
  const raw =
    field === "so_tam"
      ? item.so_tam
      : field === "so_luong"
        ? item.so_luong
        : item.so_luong9;
  const num = Number(raw ?? 0);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function evaluateOption(
  matchedQty: number,
  option: GiftRewardOption,
): EvaluatedRuleOption {
  const safeBuyQty = option.buyQty > 0 ? option.buyQty : 1;
  const sets =
    matchedQty > 0
      ? Math.floor((matchedQty + QTY_EPSILON) / safeBuyQty)
      : 0;
  const giftQty = round(sets * option.giftQtyPerSet, 2);
  const remainder = round(Math.max(0, matchedQty - sets * safeBuyQty), 2);
  const neededForNextSet =
    matchedQty === 0
      ? safeBuyQty
      : remainder > QTY_EPSILON
        ? round(safeBuyQty - remainder, 2)
        : safeBuyQty;

  return {
    option,
    sets,
    giftQty,
    remainder,
    neededForNextSet,
  };
}

/**
 * Bộ phân loại mặc định cho hàng mang ra khuyến mại (1–10₫) theo quy chuẩn đầu mã sản phẩm,
 * giúp luôn phân tách rõ ruột gối, ga bộ, ruột chăn, vỏ gối... thay vì cộng gộp chung.
 */
export const DEFAULT_GIFT_CATEGORIES: GiftCategoryRule[] = [
  {
    id: "rg-alias-45x65",
    label: "RG Alias 45x65",
    matcher: { exactCodes: ["92020604506512"] },
  },
  {
    id: "rg-vimatt-45x65",
    label: "RG Vimatt 45x65",
    matcher: { exactCodes: ["920206045065", "9202060450651"] },
  },
  {
    id: "ruot-goi",
    label: "Ruột gối",
    matcher: { codePrefixes: ["920206"] },
  },
  {
    id: "ga-bo-5-mon",
    label: "Ga bộ 5 món",
    matcher: { codePrefixes: ["91"] },
  },
  {
    id: "bo-ga-2-vo-goi",
    label: "Bộ ga + 2 vỏ gối",
    matcher: { codePrefixes: ["88", "87"] },
  },
  {
    id: "tam-bao-ve-dem",
    label: "Tấm bảo vệ đệm",
    matcher: { codePrefixes: ["9511"] },
  },
  {
    id: "ga-chun-phu",
    label: "Ga chun/phủ",
    matcher: { codePrefixes: ["95"], excludeCodePrefixes: ["9511"] },
  },
  {
    id: "vo-goi",
    label: "Vỏ gối",
    matcher: { codePrefixes: ["96"] },
  },
  {
    id: "vo-chan",
    label: "Vỏ chăn",
    matcher: { codePrefixes: ["93"] },
  },
  {
    id: "chan-he-4-mua",
    label: "Chăn hè/4 mùa",
    matcher: { codePrefixes: ["97"] },
  },
  {
    id: "ruot-chan",
    label: "Ruột chăn",
    matcher: { codePrefixes: ["9801"] },
  },
  {
    id: "dem",
    label: "Đệm",
    matcher: {
      codePrefixes: [
        "80",
        "81",
        "60",
        "61",
        "65",
        "66",
        "67",
        "68",
        "69",
        "77",
        "78",
        "79",
        "13",
      ],
    },
  },
];

function resolveGiftCategory(
  item: VoucherDetail,
  categories: GiftCategoryRule[],
): { categoryId: string; categoryLabel: string } {
  const matched = categories.find((cat) => matchesItem(item, cat.matcher));
  if (matched) {
    return { categoryId: matched.id, categoryLabel: matched.label };
  }
  const code = (item.ma_vt || "").trim().toUpperCase();
  const ten = (item.ten_vt || "").trim();
  return {
    categoryId: `item:${code}`,
    categoryLabel: ten || code,
  };
}

/**
 * Đánh giá toàn bộ các quy định khuyến mại của một chương trình trên danh sách hàng hóa.
 */
export function evaluatePromotionProgram(
  program: PromotionProgram,
  items: VoucherDetail[],
  options: EvaluatePromotionOptions = {},
): PromotionEvaluation {
  const qtyField = program.quantityField ?? "so_luong9";
  const isVnd = (options.maTte || "VND").trim().toUpperCase() === "VND";
  const shouldExcludeNominal =
    options.excludeNominalGiftRows ??
    Boolean(program.excludeNominalGiftRowsByDefault);
  const giftCategories = program.giftCategories ?? DEFAULT_GIFT_CATEGORIES;

  let ignoredGiftRowCount = 0;
  let nominalGiftTotalQty = 0;
  const nominalGiftRows: NominalGiftRow[] = [];
  const nominalGiftMap = new Map<string, NominalGiftSummaryItem>();
  const eligibleRows: Array<{
    rowIndex: number;
    item: VoucherDetail;
    qty: number;
    gia_nt9: number;
  }> = [];

  items.forEach((item, rowIndex) => {
    const maVt = (item.ma_vt || "").trim();
    if (!maVt) return;
    const qty = getItemQty(item, qtyField);
    if (qty <= 0) return;

    const giaNt9 = Number(item.gia_nt9 ?? 0);
    const isNominalGift = isVnd && giaNt9 >= 1 && giaNt9 <= 10;

    if (isNominalGift) {
      const upperCode = maVt.toUpperCase();
      const tenVt = (item.ten_vt || "").trim();
      const dvt = (item.dvt || "").trim();
      const { categoryId, categoryLabel } = resolveGiftCategory(
        item,
        giftCategories,
      );

      nominalGiftRows.push({
        rowIndex,
        ma_vt: upperCode,
        ten_vt: tenVt,
        dvt,
        qty,
        gia_nt9: giaNt9,
        categoryId,
        categoryLabel,
      });
      nominalGiftTotalQty = round(nominalGiftTotalQty + qty, 2);

      const existingGift = nominalGiftMap.get(upperCode);
      if (existingGift) {
        existingGift.totalQty = round(existingGift.totalQty + qty, 2);
        existingGift.rowCount += 1;
        if (!existingGift.ten_vt && tenVt) existingGift.ten_vt = tenVt;
      } else {
        nominalGiftMap.set(upperCode, {
          ma_vt: upperCode,
          ten_vt: tenVt,
          dvt,
          totalQty: qty,
          rowCount: 1,
          categoryId,
          categoryLabel,
        });
      }

      if (shouldExcludeNominal) {
        ignoredGiftRowCount += 1;
        return;
      }
    }

    eligibleRows.push({ rowIndex, item, qty, gia_nt9: giaNt9 });
  });

  const nominalGiftItems = Array.from(nominalGiftMap.values());
  const nominalGiftGroupMap = new Map<string, NominalGiftGroup>();
  for (const gItem of nominalGiftItems) {
    const existingGroup = nominalGiftGroupMap.get(gItem.categoryId);
    if (existingGroup) {
      existingGroup.totalQty = round(
        existingGroup.totalQty + gItem.totalQty,
        2,
      );
      existingGroup.items.push(gItem);
    } else {
      nominalGiftGroupMap.set(gItem.categoryId, {
        categoryId: gItem.categoryId,
        label: gItem.categoryLabel,
        totalQty: gItem.totalQty,
        items: [gItem],
      });
    }
  }

  const evaluatedRules: EvaluatedRule[] = program.rules.map((rule) => {
    const matchedRows: MatchedVoucherRow[] = [];
    let matchedQty = 0;
    let lowestUnitPriceItem: EvaluatedRule["lowestUnitPriceItem"] = null;

    for (const entry of eligibleRows) {
      if (!matchesItem(entry.item, rule.matcher)) continue;

      matchedRows.push({
        rowIndex: entry.rowIndex,
        ma_vt: (entry.item.ma_vt || "").trim().toUpperCase(),
        ten_vt: (entry.item.ten_vt || "").trim(),
        qty: entry.qty,
        gia_nt9: entry.gia_nt9,
      });
      matchedQty = round(matchedQty + entry.qty, 2);

      if (entry.gia_nt9 > 0) {
        if (
          !lowestUnitPriceItem ||
          entry.gia_nt9 < lowestUnitPriceItem.gia_nt9
        ) {
          lowestUnitPriceItem = {
            ma_vt: (entry.item.ma_vt || "").trim().toUpperCase(),
            ten_vt: (entry.item.ten_vt || "").trim(),
            gia_nt9: entry.gia_nt9,
          };
        }
      }
    }

    const optionResults = rule.options.map((opt) =>
      evaluateOption(matchedQty, opt),
    );
    const requestedIdx = options.selectedOptions?.[rule.id] ?? 0;
    const selectedOptionIndex =
      requestedIdx >= 0 && requestedIdx < optionResults.length
        ? requestedIdx
        : 0;
    const activeResult = optionResults[selectedOptionIndex];

    return {
      rule,
      matchedRows,
      matchedQty,
      selectedOptionIndex,
      optionResults,
      activeResult,
      lowestUnitPriceItem,
    };
  });

  const matchedRules = evaluatedRules.filter((r) => r.matchedQty > 0);
  const totalMatchedQty = round(
    matchedRules.reduce((sum, r) => sum + r.matchedQty, 0),
    2,
  );
  const totalSets = matchedRules.reduce(
    (sum, r) => sum + r.activeResult.sets,
    0,
  );

  // Tổng hợp quà tặng theo mã/tên quà để tiện kiểm tra tổng xuất tặng.
  const giftMap = new Map<string, GiftSummaryItem>();
  for (const r of matchedRules) {
    const { giftQty, option } = r.activeResult;
    if (giftQty <= 0) continue;
    const key = option.giftCode || option.giftName;
    const existing = giftMap.get(key);
    if (existing) {
      existing.totalGiftQty = round(existing.totalGiftQty + giftQty, 2);
    } else {
      giftMap.set(key, {
        key,
        giftCode: option.giftCode,
        giftName: option.giftName,
        giftShortName: option.giftShortName,
        giftUnit: option.giftUnit,
        totalGiftQty: giftQty,
      });
    }
  }

  return {
    program,
    isDateInRange: isProgramActiveOnDate(program, options.ngayCt),
    evaluatedRules,
    matchedRules,
    totalMatchedQty,
    totalSets,
    giftSummary: Array.from(giftMap.values()),
    ignoredGiftRowCount,
    nominalGiftRows,
    nominalGiftItems,
    nominalGiftGroups: Array.from(nominalGiftGroupMap.values()),
    nominalGiftTotalQty,
  };
}
