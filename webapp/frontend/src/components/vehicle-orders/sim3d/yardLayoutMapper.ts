import {
  TruckSizeClass,
  VehicleOrderVehicle,
  VehicleYardPlacement,
  YardZone,
} from "../../../types/vehicleOrders";
import { resolveTruckSpec } from "./truckSpecs";

export interface YardSlotBounds {
  slotNumber: number;
  x: number;
  z: number;
  slotWidth: number;
  slotDepth: number;
}

export interface YardZoneLayout {
  zone: YardZone;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  slots: YardSlotBounds[];
}

export interface YardSceneLayout {
  placements: VehicleYardPlacement[];
  waitingZone: YardZoneLayout;
  completedZone: YardZoneLayout;
  warehouseCenter: [number, number, number];
  warehouseWidth: number;
  groundWidth: number;
  groundDepth: number;
  countsByClass: Record<TruckSizeClass, number>;
  waitingCount: number;
  completedCount: number;
}

const SLOTS_PER_ROW = 4;
const SLOT_WIDTH = 3.6;
const SLOT_DEPTH = 10.6;
const ROW_GAP = 3.2;
const ZONE_PAD_X = 1.6;
const ZONE_PAD_Z = 2.0;
const CENTER_AISLE_GAP = 4.2;

function buildZoneSlots(
  count: number,
  minSlots: number,
  side: "left" | "right",
  zoneWidth: number,
  startZ: number,
): { slots: YardSlotBounds[]; rows: number; depth: number; centerX: number } {
  const totalSlots = Math.max(minSlots, Math.ceil(Math.max(1, count) / SLOTS_PER_ROW) * SLOTS_PER_ROW);
  const rows = Math.max(1, Math.ceil(totalSlots / SLOTS_PER_ROW));

  const centerX =
    side === "left"
      ? -(CENTER_AISLE_GAP / 2 + zoneWidth / 2)
      : CENTER_AISLE_GAP / 2 + zoneWidth / 2;

  const slots: YardSlotBounds[] = [];
  const innerStartX = centerX - ((SLOTS_PER_ROW - 1) * SLOT_WIDTH) / 2;

  for (let i = 0; i < totalSlots; i++) {
    const row = Math.floor(i / SLOTS_PER_ROW);
    const col = i % SLOTS_PER_ROW;
    const x = innerStartX + col * SLOT_WIDTH;
    const z = startZ + ZONE_PAD_Z + SLOT_DEPTH / 2 + row * (SLOT_DEPTH + ROW_GAP);
    slots.push({
      slotNumber: i + 1,
      x,
      z,
      slotWidth: SLOT_WIDTH - 0.45,
      slotDepth: SLOT_DEPTH - 0.5,
    });
  }

  const depth =
    ZONE_PAD_Z * 2 + rows * SLOT_DEPTH + Math.max(0, rows - 1) * ROW_GAP;

  return { slots, rows, depth, centerX };
}

/**
 * Compute minimalist 2-yard + 1-warehouse layout from vehicle records.
 * Vehicles are parked nose-forward (aligned cleanly along the front line)
 * so length/height differences across truck sizes are immediately comparable.
 */
export function buildYardLayout(
  vehicles: VehicleOrderVehicle[],
  sortBySize = true,
): YardSceneLayout {
  const countsByClass: Record<TruckSizeClass, number> = {
    mini: 0,
    light: 0,
    medium: 0,
    heavy: 0,
    container: 0,
  };

  const enriched = vehicles.map((vehicle) => {
    const spec = resolveTruckSpec(vehicle.weight);
    countsByClass[spec.sizeClass] += 1;
    return { vehicle, ...spec };
  });

  const waiting = enriched.filter((e) => !e.vehicle.isCompleted);
  const completed = enriched.filter((e) => e.vehicle.isCompleted);

  if (sortBySize) {
    const cmp = (
      a: (typeof enriched)[number],
      b: (typeof enriched)[number],
    ) => {
      if (b.dimensions.length !== a.dimensions.length) {
        return b.dimensions.length - a.dimensions.length;
      }
      return (a.vehicle.time || "").localeCompare(b.vehicle.time || "");
    };
    waiting.sort(cmp);
    completed.sort(cmp);
  }

  const zoneWidth = SLOTS_PER_ROW * SLOT_WIDTH + ZONE_PAD_X * 2;
  const yardStartZ = -1.5;

  const minRows = Math.max(
    1,
    Math.ceil(Math.max(waiting.length, completed.length, 4) / SLOTS_PER_ROW),
  );
  const minSlots = minRows * SLOTS_PER_ROW;

  const leftBuild = buildZoneSlots(
    waiting.length,
    minSlots,
    "left",
    zoneWidth,
    yardStartZ,
  );
  const rightBuild = buildZoneSlots(
    completed.length,
    minSlots,
    "right",
    zoneWidth,
    yardStartZ,
  );

  const sharedDepth = Math.max(leftBuild.depth, rightBuild.depth);
  const sharedCenterZ = yardStartZ + sharedDepth / 2;

  const placements: VehicleYardPlacement[] = [];

  // Align rear bumper of every truck near the warehouse dock line (back-in parking)
  // so truck length differences protrude forward clearly like a real ruler chart!
  const placeGroup = (
    items: typeof enriched,
    zone: YardZone,
    slots: YardSlotBounds[],
  ) => {
    items.forEach((entry, idx) => {
      const slot = slots[idx];
      if (!slot) return;
      const rearLineZ = slot.z - slot.slotDepth / 2 + 0.55;
      const centerZ = rearLineZ + entry.dimensions.length / 2;

      placements.push({
        vehicle: entry.vehicle,
        zone,
        slotIndex: idx,
        slotNumber: slot.slotNumber,
        position: [slot.x, 0, centerZ],
        rotationY: 0, // Nose facing +Z (toward viewer), rear facing warehouse (-Z)
        sizeClass: entry.sizeClass,
        dimensions: entry.dimensions,
      });
    });
  };

  placeGroup(waiting, "waiting", leftBuild.slots);
  placeGroup(completed, "completed", rightBuild.slots);

  const totalYardWidth = zoneWidth * 2 + CENTER_AISLE_GAP;
  const warehouseWidth = Math.min(totalYardWidth - 2, 28);
  const warehouseCenter: [number, number, number] = [0, 0, -9.2];

  return {
    placements,
    waitingZone: {
      zone: "waiting",
      centerX: leftBuild.centerX,
      centerZ: sharedCenterZ,
      width: zoneWidth,
      depth: sharedDepth,
      slots: leftBuild.slots,
    },
    completedZone: {
      zone: "completed",
      centerX: rightBuild.centerX,
      centerZ: sharedCenterZ,
      width: zoneWidth,
      depth: sharedDepth,
      slots: rightBuild.slots,
    },
    warehouseCenter,
    warehouseWidth,
    groundWidth: totalYardWidth + 24,
    groundDepth: sharedDepth + 28,
    countsByClass,
    waitingCount: waiting.length,
    completedCount: completed.length,
  };
}
