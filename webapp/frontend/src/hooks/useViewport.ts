import { useEffect, useState } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

/** Mobile phone layout: < 768px (md) */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** Compact navigation layout (Mobile + Tablet): < 1024px (lg) */
export function useIsCompactLayout(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}

/** Coarse pointer / touch screen detection */
export function useIsTouchDevice(): boolean {
  return useMediaQuery("(hover: none) and (pointer: coarse)");
}
