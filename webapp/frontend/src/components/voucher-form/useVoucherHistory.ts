import React, { useCallback, useRef, useState } from "react";
import { VoucherDetail } from "../../types/voucher";
import { MAX_UNDO_STEPS } from "./types";

interface UseVoucherHistoryParams {
  itemsLatestRef: React.MutableRefObject<VoucherDetail[]>;
  setItems: React.Dispatch<React.SetStateAction<VoucherDetail[]>>;
  setActiveRowIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useVoucherHistory({
  itemsLatestRef,
  setItems,
  setActiveRowIndex,
}: UseVoucherHistoryParams) {
  // Undo/Redo history stacks (tối đa 20 bước cho lưới chi tiết hàng hóa)
  const undoStackRef = useRef<VoucherDetail[][]>([]);
  const redoStackRef = useRef<VoucherDetail[][]>([]);
  const [historyCounts, setHistoryCounts] = useState<{
    undo: number;
    redo: number;
  }>({ undo: 0, redo: 0 });

  const pushUndoSnapshot = useCallback((prevItems: VoucherDetail[]) => {
    const cloned = prevItems.map((row) => ({ ...row }));
    const nextUndo = [...undoStackRef.current, cloned];
    if (nextUndo.length > MAX_UNDO_STEPS) {
      nextUndo.splice(0, nextUndo.length - MAX_UNDO_STEPS);
    }
    undoStackRef.current = nextUndo;
    redoStackRef.current = [];
    setHistoryCounts({ undo: nextUndo.length, redo: 0 });
  }, []);

  const resetHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryCounts({ undo: 0, redo: 0 });
  }, []);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    const nextUndo = stack.slice(0, -1);
    const currentClone = itemsLatestRef.current.map((row) => ({ ...row }));
    const nextRedo = [...redoStackRef.current, currentClone].slice(
      -MAX_UNDO_STEPS,
    );
    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setHistoryCounts({ undo: nextUndo.length, redo: nextRedo.length });
    itemsLatestRef.current = previous;
    setItems(previous);
    setActiveRowIndex((prevIdx) =>
      Math.max(0, Math.min(prevIdx, Math.max(0, previous.length - 1))),
    );
  }, [itemsLatestRef, setItems, setActiveRowIndex]);

  const handleRedo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const nextState = stack[stack.length - 1];
    const nextRedo = stack.slice(0, -1);
    const currentClone = itemsLatestRef.current.map((row) => ({ ...row }));
    const nextUndo = [...undoStackRef.current, currentClone].slice(
      -MAX_UNDO_STEPS,
    );
    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setHistoryCounts({ undo: nextUndo.length, redo: nextRedo.length });
    itemsLatestRef.current = nextState;
    setItems(nextState);
    setActiveRowIndex((prevIdx) =>
      Math.max(0, Math.min(prevIdx, Math.max(0, nextState.length - 1))),
    );
  }, [itemsLatestRef, setItems, setActiveRowIndex]);

  return {
    historyCounts,
    pushUndoSnapshot,
    resetHistory,
    handleUndo,
    handleRedo,
  };
}
