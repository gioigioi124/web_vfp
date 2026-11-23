import { TruckDimensions, TruckSizeClass } from "../../../types/vehicleOrders";
import { normalizeSearchText } from "../../../lib/searchMatch";

export interface TruckSpec {
  sizeClass: TruckSizeClass;
  dimensions: TruckDimensions;
}

export const TRUCK_CLASS_META: Record<TruckSizeClass, TruckDimensions> = {
  mini: {
    length: 2.55,
    width: 1.28,
    height: 1.5,
    cabLength: 0.8,
    axleCount: 2,
    accentHex: "#0d9488", // teal-600
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    sizeRank: 1,
    sizeLabel: "Xe nhỏ (5 tạ / CPN)",
    capacityCm: 120,
  },
  light: {
    length: 3.55,
    width: 1.52,
    height: 1.82,
    cabLength: 1.0,
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
    length: 6.65,
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
    length: 8.35,
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
 * Uses strict regex boundaries so "1.25t", "3.5t", and "5 ta" never collide with "5t".
 */
export function resolveTruckSpec(weightRaw?: string): TruckSpec {
  const norm = normalizeSearchText(weightRaw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  // 1. Container (Cont 40 / Cont 20 / HN ngoài)
  if (/\bcont\s*40\b/.test(norm)) {
    return {
      sizeClass: "container",
      dimensions: {
        ...TRUCK_CLASS_META.container,
        length: 9.25,
        axleCount: 5,
      },
    };
  }
  if (/\bcont\b|\bcont\s*20\b|dau keo|hn ngoai/.test(norm)) {
    return {
      sizeClass: "container",
      dimensions: { ...TRUCK_CLASS_META.container },
    };
  }

  // 2. Heavy (10T, 7T, 8T, 9T, 15T, Xe SG, Xe khách)
  if (/\b(7|8|9|10|15)\s*t\b|xe sg|xe khach/.test(norm)) {
    const isExtraLong = /\b(10|15)\s*t\b|xe sg/.test(norm);
    return {
      sizeClass: "heavy",
      dimensions: {
        ...TRUCK_CLASS_META.heavy,
        length: isExtraLong ? 6.85 : 6.15,
      },
    };
  }

  // 3. Mini (5 tạ, 0.5T, CPN) — checked BEFORE medium so "5 ta" never matches "5t"
  if (/\b5\s*ta\b|\b0[.,]5\s*t\b|\bcpn\b/.test(norm)) {
    return {
      sizeClass: "mini",
      dimensions: { ...TRUCK_CLASS_META.mini },
    };
  }

  // 4. Light (1.25T, 1.25T Livax, 1.5T) — checked BEFORE medium so "1.25t" never matches "5t"
  if (/\b1[.,](25|5)\s*t\b|livax/.test(norm)) {
    return {
      sizeClass: "light",
      dimensions: { ...TRUCK_CLASS_META.light },
    };
  }

  // 5. Medium (3.5T, 2.5T, 5T)
  if (/\b3[.,]5\s*t\b|\b2[.,]5\s*t\b/.test(norm)) {
    return {
      sizeClass: "medium",
      dimensions: {
        ...TRUCK_CLASS_META.medium,
        length: 4.5,
        height: 2.1,
      },
    };
  }
  if (/\b5\s*t\b/.test(norm)) {
    return {
      sizeClass: "medium",
      dimensions: {
        ...TRUCK_CLASS_META.medium,
        length: 5.4,
        height: 2.34,
      },
    };
  }

  return {
    sizeClass: "medium",
    dimensions: { ...TRUCK_CLASS_META.medium },
  };
}
