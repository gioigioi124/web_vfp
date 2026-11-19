import React from "react";

const SPEC_TOKEN_REGEX =
  /(\(\s*\d{2,4}\s*[xX*]\s*\d{2,4}(?:\s*[xX*]\s*\d{1,4})?\s*\)|\b\d{2,4}\s*[xX*]\s*\d{2,4}(?:\s*[xX*]\s*\d{1,4})?\b|\b\d{1,3}(?:[.,]\d+)?\s*(?:F|cm|mm|ly|li)(?=\b|\()|\b(?:Alias|Vimatt?)\b|(?:[Vv]ỏ|[Vv]ải)\s+gấm\s+in\b|\b(?:Fly|See)\b|\b(?:Rexi?|Mix|Nova|Ale)\b|\b(?:TMD|TM|TP|TD|TE|ST|SD|TL|TB)(?:\s*\d{2,5})?\b|\b(?:CI|PI)\s*\d{2,5}\b|(?<![\p{L}\p{N}])(?:nano\s+foam\s+massage|foam\s+tổng\s+hợp|bông\s+mút\s+massage|massage\s+ELAN|đa\s+tầng(?:\s+II)?|thoáng\s+khí|ELAN\s+K(?:24|35)|thêu)(?![\p{L}\p{N}]))/giu;

const GROUP1_CHECK = /^(?:Alias|Vimatt?|(?:Vỏ|Vải)\s+gấm\s+in)$/iu;
const GROUP2_CHECK = /^(?:Fly|See)$/i;
const GROUP3_CHECK = /^(?:Rexi?|Mix|Nova|Ale)$/i;
const FABRIC_CHECK =
  /^(?:(?:TMD|TM|TP|TD|TE|ST|SD|TL|TB)(?:\s*\d{2,5})?|(?:CI|PI)\s*\d{2,5})$/i;
const FOAM_CHECK =
  /^(?:nano\s+foam\s+massage|foam\s+tổng\s+hợp|bông\s+mút\s+massage|massage\s+ELAN|đa\s+tầng(?:\s+II)?|thoáng\s+khí|ELAN\s+K(?:24|35))$/iu;

function getTokenHighlightClass(token: string): string {
  if (GROUP1_CHECK.test(token)) return "font-bold text-blue-700";
  if (GROUP2_CHECK.test(token)) return "font-bold text-emerald-700";
  if (GROUP3_CHECK.test(token)) return "font-bold text-orange-600";
  if (FABRIC_CHECK.test(token)) return "font-bold text-fuchsia-700";
  if (FOAM_CHECK.test(token)) return "font-bold text-amber-800";
  return "font-extrabold text-neutral-950";
}

const MAX_SPEC_CACHE = 400;
const specHighlightCache = new Map<string, React.ReactNode>();

export function renderHighlightedSpecs(text: string): React.ReactNode {
  if (!text) return text;
  const cached = specHighlightCache.get(text);
  if (cached !== undefined) return cached;
  const parts = text.split(SPEC_TOKEN_REGEX);
  const rendered: React.ReactNode =
    parts.length <= 1
      ? text
      : parts.map((part, idx) =>
          idx % 2 === 1 ? (
            <span key={idx} className={getTokenHighlightClass(part)}>
              {part}
            </span>
          ) : (
            <React.Fragment key={idx}>{part}</React.Fragment>
          ),
        );
  if (specHighlightCache.size >= MAX_SPEC_CACHE) {
    const oldestKey = specHighlightCache.keys().next().value;
    if (oldestKey !== undefined) specHighlightCache.delete(oldestKey);
  }
  specHighlightCache.set(text, rendered);
  return rendered;
}
