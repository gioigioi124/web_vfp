/**
 * syncChannel.ts — Đồng bộ tức thì giữa nhiều tab trình duyệt cùng mở ứng dụng
 * qua BroadcastChannel API (fallback an toàn nếu trình duyệt không hỗ trợ).
 */

export type SyncEvent = {
  type: "voucher_mutated";
  action: "create" | "update" | "delete";
  mode: "sales" | "return" | "warehouse";
  stt: string;
  ma_dt?: string;
  ts: number;
};

const CHANNEL_NAME = "web_vfp_sync";
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
}

/** Phát tín hiệu cho các tab khác biết chứng từ vừa được thêm/sửa/xóa. */
export function broadcastVoucherMutation(
  event: Omit<SyncEvent, "type" | "ts">,
): void {
  const ch = getChannel();
  if (!ch) return;
  try {
    const payload: SyncEvent = {
      type: "voucher_mutated",
      ...event,
      ts: Date.now(),
    };
    ch.postMessage(payload);
  } catch {
    /* ignore */
  }
}

/** Lắng nghe sự kiện từ các tab khác. Trả về hàm hủy đăng ký. */
export function subscribeVoucherMutations(
  handler: (event: SyncEvent) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (ev: MessageEvent<SyncEvent>) => {
    if (ev.data && ev.data.type === "voucher_mutated") {
      handler(ev.data);
    }
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
