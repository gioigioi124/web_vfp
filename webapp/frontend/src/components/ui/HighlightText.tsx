import React from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

interface CompiledQuery {
  termSet: Set<string>;
  pattern: RegExp;
}

const MAX_QUERY_CACHE = 100;
const queryCache = new Map<string, CompiledQuery | null>();

function getCompiledQuery(rawQuery: string): CompiledQuery | null {
  const key = (rawQuery || "").trim().toLowerCase();
  if (!key) return null;
  if (queryCache.has(key)) {
    return queryCache.get(key) ?? null;
  }
  const terms = Array.from(
    new Set(key.normalize("NFC").split(/\s+/).filter(Boolean)),
  ).sort((a, b) => b.length - a.length);
  const compiled: CompiledQuery | null =
    terms.length > 0
      ? {
          termSet: new Set(terms),
          pattern: new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi"),
        }
      : null;

  if (queryCache.size >= MAX_QUERY_CACHE) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(key, compiled);
  return compiled;
}

/**
 * Tô nổi (mặc định chữ đỏ) mọi từ khóa khớp trong chuỗi kết quả tìm kiếm.
 * Tách từ theo khoảng trắng, chuẩn hóa NFC và so khớp không phân biệt hoa/thường.
 */
export const HighlightText: React.FC<HighlightTextProps> = React.memo(
  ({ text, query, className = "text-red-600 font-semibold" }) => {
    const compiled = getCompiledQuery(query);
    if (!text || !compiled) {
      return <>{text}</>;
    }
    const normalizedText = text.normalize("NFC");
    const parts = normalizedText.split(compiled.pattern);

    return (
      <>
        {parts.map((part, idx) => {
          if (!part) return null;
          return compiled.termSet.has(part.toLowerCase()) ? (
            <span key={idx} className={className}>
              {part}
            </span>
          ) : (
            <React.Fragment key={idx}>{part}</React.Fragment>
          );
        })}
      </>
    );
  },
);
HighlightText.displayName = "HighlightText";
