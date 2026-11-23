import React from "react";
import { Html } from "@react-three/drei";
import { YardSceneLayout, YardZoneLayout } from "./yardLayoutMapper";

interface WarehouseAndYards3DProps {
  layout: YardSceneLayout;
}

const WAREHOUSE_BAYS = ["K01", "K02", "K03", "K04"];

const YardPad3D: React.FC<{
  zoneLayout: YardZoneLayout;
  title: string;
  count: number;
  accentHex: string;
  padHex: string;
  badgeClass: string;
}> = ({ zoneLayout, title, count, accentHex, padHex, badgeClass }) => {
  const { centerX, centerZ, width, depth, slots } = zoneLayout;

  return (
    <group>
      {/* Nền sân bãi bê tông phẳng */}
      <mesh
        position={[centerX, 0.02, centerZ]}
        receiveShadow
      >
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color={padHex} roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Viền nhận diện khu vực (phía trước & phía sau bãi) */}
      <mesh position={[centerX, 0.055, centerZ - depth / 2 + 0.14]}>
        <boxGeometry args={[width, 0.03, 0.28]} />
        <meshStandardMaterial color={accentHex} roughness={0.6} />
      </mesh>
      <mesh position={[centerX, 0.055, centerZ + depth / 2 - 0.14]}>
        <boxGeometry args={[width, 0.03, 0.28]} />
        <meshStandardMaterial color={accentHex} roughness={0.6} />
      </mesh>
      <mesh position={[centerX - width / 2 + 0.12, 0.055, centerZ]}>
        <boxGeometry args={[0.24, 0.03, depth]} />
        <meshStandardMaterial color={accentHex} roughness={0.6} />
      </mesh>
      <mesh position={[centerX + width / 2 - 0.12, 0.055, centerZ]}>
        <boxGeometry args={[0.24, 0.03, depth]} />
        <meshStandardMaterial color={accentHex} roughness={0.6} />
      </mesh>

      {/* Vạch kẻ từng ô đỗ xe */}
      {slots.map((slot) => (
        <group key={slot.slotNumber} position={[slot.x, 0.05, slot.z]}>
          {/* Vạch trái */}
          <mesh position={[-slot.slotWidth / 2, 0, 0]}>
            <boxGeometry args={[0.07, 0.01, slot.slotDepth]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
          {/* Vạch phải */}
          <mesh position={[slot.slotWidth / 2, 0, 0]}>
            <boxGeometry args={[0.07, 0.01, slot.slotDepth]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
          {/* Vạch chặn đuôi xe (căn thẳng hàng để so sánh chiều dài xe trực quan) */}
          <mesh position={[0, 0.04, -slot.slotDepth / 2 + 0.25]}>
            <boxGeometry args={[slot.slotWidth - 0.5, 0.12, 0.22]} />
            <meshStandardMaterial color={accentHex} roughness={0.5} />
          </mesh>
          {/* Vạch mốc 5m giữa ô (thước đo trực quan kích thước xe) */}
          <mesh position={[0, 0.005, -slot.slotDepth / 2 + 5.2]}>
            <boxGeometry args={[slot.slotWidth - 0.6, 0.005, 0.05]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
        </group>
      ))}

      {/* Biển tiêu đề bãi xe + số lượng xe */}
      <Html
        position={[centerX, 0.6, centerZ + depth / 2 + 1.15]}
        center
        zIndexRange={[10, 0]}
      >
        <div
          className={`pointer-events-none select-none whitespace-nowrap px-3 py-1 rounded-full border shadow-sm text-xs font-bold flex items-center gap-2 backdrop-blur-sm ${badgeClass}`}
        >
          <span>{title}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/90 text-gray-900 font-mono text-[11px] leading-none">
            {count} xe
          </span>
        </div>
      </Html>
    </group>
  );
};

export const WarehouseAndYards3D: React.FC<WarehouseAndYards3DProps> = ({
  layout,
}) => {
  const [whX, , whZ] = layout.warehouseCenter;
  const whWidth = layout.warehouseWidth;
  const whDepth = 7.4;
  const whHeight = 4.6;

  return (
    <group>
      {/* Địa hình phẳng tối giản */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, layout.waitingZone.centerZ - 1]}
        receiveShadow
      >
        <planeGeometry args={[layout.groundWidth + 40, layout.groundDepth + 40]} />
        <meshStandardMaterial color="#e9eff6" roughness={0.95} metalness={0} />
      </mesh>

      {/* Đường nối phẳng phía trước nhà kho */}
      <mesh
        position={[0, 0.015, -3.5]}
        receiveShadow
      >
        <boxGeometry
          args={[
            layout.waitingZone.width + layout.completedZone.width + 4.2,
            0.03,
            3.8,
          ]}
        />
        <meshStandardMaterial color="#dde5ef" roughness={0.9} />
      </mesh>

      {/* Lối đi giữa ngăn cách 2 bãi xe */}
      <mesh
        position={[0, 0.015, layout.waitingZone.centerZ]}
        receiveShadow
      >
        <boxGeometry args={[3.6, 0.03, layout.waitingZone.depth]} />
        <meshStandardMaterial color="#dfe6ef" roughness={0.9} />
      </mesh>
      {/* Vạch đứt chia đôi giữa 2 bãi */}
      <mesh position={[0, 0.04, layout.waitingZone.centerZ]}>
        <boxGeometry args={[0.1, 0.01, layout.waitingZone.depth - 1.2]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      {/* 1 NHÀ KHO TRUNG TÂM */}
      <group position={[whX, 0, whZ]}>
        {/* Nền móng bê tông kho */}
        <mesh position={[0, 0.18, 0.4]} receiveShadow castShadow>
          <boxGeometry args={[whWidth + 1.2, 0.36, whDepth + 1.4]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
        </mesh>

        {/* Thân nhà kho chính */}
        <mesh position={[0, whHeight / 2 + 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[whWidth, whHeight, whDepth]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.75} metalness={0.05} />
        </mesh>

        {/* Dải viền xanh thương hiệu phía trên mặt tiền */}
        <mesh position={[0, whHeight + 0.1, whDepth / 2 + 0.05]}>
          <boxGeometry args={[whWidth + 0.1, 0.72, 0.12]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.45} metalness={0.1} />
        </mesh>

        {/* Mái hiên che mưa cửa xuất hàng */}
        <mesh position={[0, whHeight - 0.7, whDepth / 2 + 0.85]} castShadow>
          <boxGeometry args={[whWidth - 0.6, 0.16, 1.7]} />
          <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.2} />
        </mesh>

        {/* Mái nhà kho 2 mái tối giản */}
        <mesh
          position={[0, whHeight + 0.56, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[whWidth + 0.5, 0.24, whDepth + 0.6]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.65} metalness={0.15} />
        </mesh>
        <mesh position={[0, whHeight + 0.82, 0]} castShadow>
          <boxGeometry args={[whWidth - 1.5, 0.34, whDepth * 0.52]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.6} metalness={0.12} />
        </mesh>

        {/* 4 cửa cuốn kho K01 - K04 */}
        {WAREHOUSE_BAYS.map((bayCode, idx) => {
          const span = whWidth - 5;
          const step = span / (WAREHOUSE_BAYS.length - 1);
          const doorX = -span / 2 + idx * step;
          return (
            <group key={bayCode} position={[doorX, 1.65, whDepth / 2 + 0.04]}>
              {/* Khung cửa */}
              <mesh>
                <boxGeometry args={[3.1, 2.75, 0.08]} />
                <meshStandardMaterial color="#334155" roughness={0.6} />
              </mesh>
              {/* Lá cửa cuốn */}
              <mesh position={[0, -0.05, 0.03]}>
                <boxGeometry args={[2.75, 2.45, 0.06]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.5} metalness={0.25} />
              </mesh>
              {/* Biển số cửa kho */}
              <Html position={[0, 1.68, 0.15]} center zIndexRange={[10, 0]}>
                <div className="pointer-events-none select-none px-1.5 py-0.5 rounded bg-slate-900/90 text-white font-mono text-[10px] font-bold tracking-wider shadow">
                  {bayCode}
                </div>
              </Html>
            </group>
          );
        })}

        {/* Biển tên Nhà kho trung tâm */}
        <Html position={[0, whHeight + 1.55, whDepth / 2]} center zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap px-3 py-1 rounded-md bg-primary-800/95 text-white text-xs font-bold tracking-wide shadow-md border border-primary-500/40">
            NHÀ KHO TRUNG TÂM (K01 – K04)
          </div>
        </Html>
      </group>

      {/* BÃI 1 (TRÁI): BÃI XE CHỜ XẾP */}
      <YardPad3D
        zoneLayout={layout.waitingZone}
        title="BÃI XE CHỜ XẾP"
        count={layout.waitingCount}
        accentHex="#f59e0b"
        padHex="#f8fafc"
        badgeClass="bg-amber-50/95 text-amber-800 border-amber-300"
      />

      {/* BÃI 2 (PHẢI): BÃI XE ĐÃ XẾP XONG */}
      <YardPad3D
        zoneLayout={layout.completedZone}
        title="BÃI XE ĐÃ XẾP XONG"
        count={layout.completedCount}
        accentHex="#10b981"
        padHex="#f2fbf7"
        badgeClass="bg-emerald-50/95 text-emerald-800 border-emerald-300"
      />
    </group>
  );
};
