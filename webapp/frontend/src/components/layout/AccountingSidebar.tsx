import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  Pin,
  PinOff,
  Search,
  X,
} from "lucide-react";
import {
  ALL_NAV_ITEMS,
  NAV_GROUPS,
  NavModuleItem,
} from "../../config/accountingModules";
import { normalizeSearchText, parseSearchQuery } from "../../lib/searchMatch";
import { ModuleIcon } from "./ModuleIcon";

const PINNED_STORAGE_KEY = "accountingSidebar.pinnedIds";
const COLLAPSED_GROUPS_KEY = "accountingSidebar.collapsedGroups";
const DEFAULT_PINNED = ["C1", "C2", "C3", "C4", "cash-ledger", "X1"];

function loadStringArray(key: string, fallback: string[]): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : fallback;
  } catch {
    return fallback;
  }
}

const BADGE_CLASSES: Record<NonNullable<NavModuleItem["badgeTone"]>, string> = {
  emerald: "bg-emerald-900/60 text-emerald-300 border-emerald-700/60",
  rose: "bg-rose-900/60 text-rose-300 border-rose-700/60",
  sky: "bg-sky-900/60 text-sky-300 border-sky-700/60",
  amber: "bg-amber-900/60 text-amber-300 border-amber-700/60",
  primary: "bg-primary-800/80 text-primary-200 border-primary-600/60",
  neutral: "bg-neutral-800 text-neutral-400 border-neutral-700",
};

interface SidebarItemRowProps {
  item: NavModuleItem;
  isActive: boolean;
  isPinned: boolean;
  compact?: boolean;
  onNavigate: (item: NavModuleItem) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
}

const SidebarItemRow: React.FC<SidebarItemRowProps> = React.memo(
  ({ item, isActive, isPinned, compact = false, onNavigate, onTogglePin }) => {
    const badgeClass =
      BADGE_CLASSES[item.badgeTone || (item.implemented ? "primary" : "neutral")];

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onNavigate(item);
          }
        }}
        title={item.label}
        className={`group relative flex items-center justify-between px-2.5 rounded transition-colors cursor-pointer select-none ${
          compact ? "min-h-[44px] py-2 text-[13px]" : "py-1.5 text-xs"
        } ${
          isActive
            ? "bg-primary-700 text-white font-semibold shadow-sm"
            : item.implemented
              ? "text-neutral-300 hover:bg-neutral-800/90 hover:text-white active:bg-neutral-800"
              : "text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-sky-400" />
        )}
        <div className="flex items-center gap-2.5 min-w-0">
          <ModuleIcon
            name={item.iconName}
            className={`w-4 h-4 shrink-0 ${
              isActive
                ? "text-sky-300"
                : item.implemented
                  ? "text-neutral-400 group-hover:text-neutral-200"
                  : "text-neutral-600"
            }`}
          />
          <span className="truncate leading-snug">{item.label}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {item.implemented && (
            <button
              type="button"
              onClick={(e) => onTogglePin(item.id, e)}
              title={isPinned ? "Bỏ ghim khỏi mục Hay dùng" : "Ghim lên mục Hay dùng"}
              className={`rounded transition-opacity cursor-pointer ${
                compact ? "p-2 -my-1" : "p-0.5"
              } ${
                isPinned
                  ? "opacity-85 hover:opacity-100 text-amber-300"
                  : compact
                    ? "opacity-65 text-neutral-400 hover:text-amber-300"
                    : "opacity-0 group-hover:opacity-80 hover:opacity-100 text-neutral-400 hover:text-amber-300"
              }`}
            >
              {isPinned ? (
                <PinOff className={compact ? "w-3.5 h-3.5" : "w-3 h-3"} />
              ) : (
                <Pin className={compact ? "w-3.5 h-3.5" : "w-3 h-3"} />
              )}
            </button>
          )}
          {!item.implemented ? (
            <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-500 border border-neutral-700/80">
              Sắp có
            </span>
          ) : (
            <span
              className={`font-mono text-[10px] px-1.5 py-0 rounded border font-bold ${
                isActive
                  ? "bg-white/15 text-white border-white/25"
                  : badgeClass
              }`}
            >
              {item.shortCode}
            </span>
          )}
        </div>
      </div>
    );
  },
);
SidebarItemRow.displayName = "SidebarItemRow";

interface AccountingSidebarProps {
  width: number;
  innerWidth: number;
  isDragging: boolean;
  isOverlay?: boolean;
  onCollapse: () => void;
  onOpenQuickJump: () => void;
  onStartResizeFromRightEdge: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export const AccountingSidebar: React.FC<AccountingSidebarProps> = ({
  width,
  innerWidth,
  isDragging,
  isOverlay = false,
  onCollapse,
  onOpenQuickJump,
  onStartResizeFromRightEdge,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>(() =>
    loadStringArray(PINNED_STORAGE_KEY, DEFAULT_PINNED),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() =>
    loadStringArray(COLLAPSED_GROUPS_KEY, [
      "purchases-ap",
      "inventory",
      "general-ledger",
      "catalogs",
    ]),
  );

  const isFullyClosed = !isOverlay && width <= 0;

  const isItemActive = (item: NavModuleItem) =>
    location.pathname === item.route ||
    location.pathname.startsWith(`${item.route}/`);

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(groupId)
        ? prev.filter((x) => x !== groupId)
        : [...prev, groupId];
      try {
        window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const pinnedItems = useMemo(
    () =>
      pinnedIds
        .map((id) => ALL_NAV_ITEMS.find((it) => it.id === id))
        .filter((it): it is NavModuleItem => Boolean(it)),
    [pinnedIds],
  );

  const filteredGroups = useMemo(() => {
    const { words } = parseSearchQuery(searchQuery);
    if (!words.length) return NAV_GROUPS;
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const hay = normalizeSearchText(
          `${item.label} ${item.shortCode} ${item.id} ${item.keywords || ""}`,
        );
        return words.every((w) => hay.includes(w));
      }),
    })).filter((g) => g.items.length > 0);
  }, [searchQuery]);

  const handleNavigate = (item: NavModuleItem) => {
    navigate(item.route);
  };

  return (
    <aside
      aria-label="Thanh điều hướng phần hành kế toán"
      aria-hidden={isFullyClosed}
      style={isOverlay ? { width: "100%" } : { width: `${width}px` }}
      className={`relative shrink-0 h-full overflow-hidden select-none z-30 bg-neutral-950 text-neutral-200 ${
        isFullyClosed ? "border-r-0 pointer-events-none" : "border-r border-neutral-800"
      } ${isDragging || isOverlay ? "" : "transition-[width] duration-200 ease-out"}`}
    >
      {/* Inner fixed-width drawer so dragging from 0px reveals smoothly without text reflow */}
      <div
        style={isOverlay ? { width: "100%" } : { width: `${innerWidth}px` }}
        className={`h-full flex flex-col ${isFullyClosed ? "invisible" : "visible"}`}
      >
        {/* Brand + Collapse toggle */}
        <div className="h-12 lg:h-11 border-b border-neutral-800 flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-primary-700 border border-primary-500/60 flex items-center justify-center font-mono font-bold text-xs text-white shrink-0 shadow">
              1S
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white tracking-tight truncate">
                Kế toán Doanh nghiệp
              </div>
              <div className="text-[10px] font-mono text-neutral-400 truncate">
                VP_2014 · ĐVCS S1
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCollapse}
            title={isOverlay ? "Đóng menu" : "Thu gọn hoàn toàn Sidebar (Ctrl+B hoặc kéo mép sang trái)"}
            className={`${
              isOverlay ? "w-10 h-10 -mr-1.5" : "p-1.5"
            } rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer`}
          >
            {isOverlay ? <X className="w-5 h-5" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Jump / Search */}
        <div className="p-2 border-b border-neutral-800/80 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc phần hành..."
              className={`w-full bg-neutral-900 text-neutral-100 placeholder-neutral-500 border border-neutral-800 focus:border-primary-500 rounded pl-8 ${
                isOverlay ? "pr-9 py-2 text-sm" : "pr-14 py-1 text-xs"
              } outline-none`}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer p-1"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : !isOverlay ? (
              <button
                type="button"
                onClick={onOpenQuickJump}
                title="Mở hộp thoại nhảy nhanh (Ctrl+K)"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white cursor-pointer"
              >
                Ctrl+K
              </button>
            ) : null}
          </div>
        </div>

        {/* Scrollable Navigation Tree */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {/* Pinned / Hay dùng */}
          {!searchQuery && pinnedItems.length > 0 && (
            <div>
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                <Pin className="w-3 h-3" />
                <span>Hay dùng</span>
              </div>
              <div className="space-y-0.5">
                {pinnedItems.map((item) => (
                  <SidebarItemRow
                    key={`pin-${item.id}`}
                    item={item}
                    isActive={isItemActive(item)}
                    isPinned
                    compact={isOverlay}
                    onNavigate={handleNavigate}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Accounting Groups */}
          {filteredGroups.map((group) => {
            const isGroupCollapsed =
              !searchQuery && collapsedGroups.includes(group.id);
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-2 ${
                    isOverlay ? "py-2 text-[11px]" : "py-1 text-[10px]"
                  } font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-200 cursor-pointer`}
                >
                  <span className="truncate">{group.title}</span>
                  {isGroupCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>

                {!isGroupCollapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => (
                      <SidebarItemRow
                        key={item.id}
                        item={item}
                        isActive={isItemActive(item)}
                        isPinned={pinnedIds.includes(item.id)}
                        compact={isOverlay}
                        onNavigate={handleNavigate}
                        onTogglePin={handleTogglePin}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom footer hint (desktop only) */}
        {!isOverlay && (
          <div className="px-3 py-2 border-t border-neutral-800 text-[10px] text-neutral-500 flex items-center justify-between shrink-0">
            <span>Ẩn/Hiện: Ctrl+B</span>
            <span>Nhảy nhanh: Ctrl+K</span>
          </div>
        )}
      </div>

      {/* Right-edge resize / drag-left-to-collapse handle (desktop only) */}
      {!isOverlay && !isFullyClosed && (
        <div
          onPointerDown={onStartResizeFromRightEdge}
          title="Kéo để chỉnh độ rộng hoặc kéo sát mép trái để thu gọn hoàn toàn"
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary-500/70 active:bg-primary-400 transition-colors z-40 touch-none"
        />
      )}
    </aside>
  );
};

