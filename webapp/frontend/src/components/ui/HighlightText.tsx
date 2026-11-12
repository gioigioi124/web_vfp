import React from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

/**
 * Tô nổi (mặc định chữ đỏ) mọi từ khóa khớp trong chuỗi kết quả tìm kiếm.
 * Tách từ theo khoảng trắng, chuẩn hóa NFC và so khớp không phân biệt hoa/thường.
 */
export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  query,
  className = "text-red-600 font-semibold",
}) => {
  const normalizedText = (text || "").normalize("NFC");
  const terms = Array.from(
    new Set(
      (query || "")
        .normalize("NFC")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    ),
  ).sort((a, b) => b.length - a.length);

  if (!normalizedText || terms.length === 0) {
    return <>{text}</>;
  }

  const termSet = new Set(terms);
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = normalizedText.split(pattern);

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        return termSet.has(part.toLowerCase()) ? (
          <span key={idx} className={className}>
            {part}
          </span>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        );
      })}
    </>
  );
};
