import { TruckDimensions, TruckSizeClass } from "../../../types/vehicleOrders";
import { normalizeSearchText } from "../../../lib/searchMatch";

export interface TruckSpec {
  sizeClass: TruckSizeClass;
  dimensions: TruckDimensions;
}

export const TRUCK_CLASS_META: Record<TruckSizeClass, TruckDimensions> = {
  mini: {
    length: 2.7,
    width: 1.32,
    height: 1.55,
    cabLength: 0.85,
    axleCount: 2,
    accentHex: "#0d9488", // teal-600
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    sizeRank: 1,
    sizeLabel: "Xe nhỏ (5 tạ / CPN)",
    capacityCm: 120,
  },
  light: {
    length: 3.6,
    width: 1.55,
    height: 1.85,
    cabLength: 1.05,
    axleCount: 2,
    accentHex: "#0284c7", // sky-600
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    sizeRank: 2,
    sizeLabel: "Xe nhẹ (1.25T)",
    capacityCm: 220,
  },
  medium: {
    length: 4.85,
    width: 1.82,
    height: 2.2,
    cabLength: 1.25,
    axleCount: 2,
    accentHex: "#2563eb", // blue-600
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    sizeRank: 3,
    sizeLabel: "Xe trung (3.5T – 5T)",
    capacityCm: 420,
  },
  heavy: {
    length: 6.45,
    width: 2.02,
    height: 2.55,
    cabLength: 1.45,
    axleCount: 3,
    accentHex: "#4f46e5", // indigo-600
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    sizeRank: 4,
    sizeLabel: "Xe lớn (7T / 10T / Xe SG)",
    capacityCm: 720,
  },
  container: {
    length: 8.2,
    width: 2.15,
    height: 2.78,
    cabLength: 1.75,
    axleCount: 4,
    accentHex: "#7c3aed", // violet-600
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    sizeRank: 5,
    sizeLabel: "Container (Cont 20 / 40)",
    capacityCm: 1100,
  },
};

export const TRUCK_CLASS_ORDER: TruckSizeClass[] = [
  "mini",
  "light",
  "medium",
  "heavy",
  "container",
];

/**
 * Resolve 3D physical proportions and styling class from vehicle weight string.
 */
export function resolveTruckSpec(weightRaw?: string): TruckSpec {
  const norm = normalizeSearchText(weightRaw || "");

  if (norm.includes("cont 40") || norm.includes("cont40")) {
    return {
      sizeClass: "container",
      dimensions: {
        ...TRUCK_CLASS_META.container,
        length: 9.2,
        axleCount: 5,
      },
    };
  }
  if (
    norm.includes("cont") ||
    norm.includes("dau keo") ||
    norm.includes("hn ngoai")
  ) {
    return {
      sizeClass: "container",
      dimensions: { ...TRUCK_CLASS_META.container },
    };
  }

  if (
    norm.includes("10t") ||
    norm.includes("7t") ||
    norm.includes("xe sg") ||
    norm.includes("xe khach") ||
    norm.includes("8t") ||
    norm.includes("9t") ||
    norm.includes("15t")
  ) {
    const isExtraLong = norm.includes("10t") || norm.includes("xe sg");
    return {
      sizeClass: "heavy",
      dimensions: {
        ...TRUCK_CLASS_META.heavy,
        length: isExtraLong ? 6.7 : 6.1,
      },
    };
  }

  if (norm.includes("5t") || norm.includes("3.5t") || norm.includes("3,5t") || norm.includes("2.5t")) {
    const is5T = norm.includes("5t");
    return {
      sizeClass: "medium",
      dimensions: {
        ...TRUCK_CLASS_META.medium,
        length: is5T ? 5.25 : 4.55,
        height: is5T ? 2.32 : 2.12,
      },
    };
  }

  if (norm.includes("1.25") || norm.includes("1,25") || norm.includes("1.5t") || norm.includes("livax")) {
    return {
      sizeClass: "light",
      dimensions: { ...TRUCK_CLASS_META.light },
    };
  }

  if (norm.includes("5 ta") || norm.includes("5ta") || norm.includes("cpn") || norm.includes("0.5")) {
    return {
      sizeClass: "mini",
      dimensions: { ...TRUCK_CLASS_META.mini },
    };
  }

  return {
    sizeClass: "medium",
    dimensions: { ...TRUCK_CLASS_META.medium },
  };
}
