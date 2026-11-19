import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VoucherDetail } from "../../types/voucher";
import {
  buildVoucherSnapshot,
  DRAFT_MAX_AGE_MS,
  VoucherDraftPayload,
} from "./types";

interface UseVoucherDraftParams {
  voucherMode: "sales" | "warehouse";
  isCreate: boolean;
  isEditable: boolean;
  voucherStt: string;
  saving: boolean;
  ngayCt: string;
  soCt: string;
  maDt: string;
  tenDt: string;
  dienGiai0: string;
  maXe: string;
  items: VoucherDetail[];
  userEditedSoCtRef: React.MutableRefObject<boolean>;
  tenDtEditedRef: React.MutableRefObject<boolean>;
}

export function useVoucherDraft({
  voucherMode,
  isCreate,
  isEditable,
  voucherStt,
  saving,
  ngayCt,
  soCt,
  maDt,
  tenDt,
  dienGiai0,
  maXe,
  items,
  userEditedSoCtRef,
  tenDtEditedRef,
}: UseVoucherDraftParams) {
  const draftStorageKey = `draft:${voucherMode}:${isCreate ? "new" : voucherStt || "edit"}`;
  const [pendingDraft, setPendingDraft] = useState<VoucherDraftPayload | null>(
    null,
  );

  const effectiveSoCtForDirty =
    isCreate && !userEditedSoCtRef.current ? "" : soCt;
  const currentSnapshot = useMemo(
    () =>
      buildVoucherSnapshot({
        ngayCt,
        effectiveSoCt: effectiveSoCtForDirty,
        maDt,
        tenDt,
        includeTenDt: tenDtEditedRef.current,
        dienGiai0,
        maXe,
        items,
      }),
    [
      ngayCt,
      effectiveSoCtForDirty,
      maDt,
      tenDt,
      dienGiai0,
      maXe,
      items,
      tenDtEditedRef,
    ],
  );
  const savedSnapshotRef = useRef<string>(currentSnapshot);
  const isDirty = isEditable && currentSnapshot !== savedSnapshotRef.current;
  const isDirtyRef = useRef<boolean>(false);
  isDirtyRef.current = isDirty;

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore storage errors
    }
  }, [draftStorageKey]);

  // Kiểm tra bản nháp cũ trong localStorage khi mở form (còn hạn < 24h)
  const draftCheckedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!isEditable) return;
    if (draftCheckedKeyRef.current === draftStorageKey) return;
    draftCheckedKeyRef.current = draftStorageKey;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as VoucherDraftPayload;
      if (
        !parsed ||
        typeof parsed.savedAt !== "number" ||
        Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS ||
        !Array.isArray(parsed.items)
      ) {
        window.localStorage.removeItem(draftStorageKey);
        return;
      }
      const draftSnap = buildVoucherSnapshot({
        ngayCt: parsed.ngayCt || "",
        effectiveSoCt: isCreate ? "" : parsed.soCt || "",
        maDt: parsed.maDt || "",
        tenDt: parsed.tenDt || "",
        includeTenDt: false,
        dienGiai0: parsed.dienGiai0 || "",
        maXe: parsed.maXe || "",
        items: parsed.items,
      });
      if (draftSnap !== savedSnapshotRef.current) {
        setPendingDraft(parsed);
      }
    } catch {
      // Ignore corrupt draft
    }
  }, [isEditable, draftStorageKey, isCreate]);

  // Tự động lưu nháp (debounce 2s) khi có thay đổi chưa lưu
  useEffect(() => {
    if (!isEditable || !isDirty || saving) return;
    const timer = window.setTimeout(() => {
      try {
        const draftPayload: VoucherDraftPayload = {
          savedAt: Date.now(),
          ngayCt,
          soCt,
          maDt,
          tenDt,
          dienGiai0,
          maXe,
          items,
        };
        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify(draftPayload),
        );
      } catch {
        // Ignore quota/storage errors
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [
    isEditable,
    isDirty,
    saving,
    draftStorageKey,
    ngayCt,
    soCt,
    maDt,
    tenDt,
    dienGiai0,
    maXe,
    items,
  ]);

  // Cảnh báo trình duyệt nếu đóng tab/tải lại trang khi còn dữ liệu chưa lưu
  useEffect(() => {
    if (!isEditable || !isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isEditable, isDirty]);

  return {
    pendingDraft,
    setPendingDraft,
    clearDraft,
    currentSnapshot,
    savedSnapshotRef,
    isDirty,
    isDirtyRef,
  };
}
