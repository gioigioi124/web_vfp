import React, { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { YardSceneLayout, YardZoneLayout } from "./yardLayoutMapper";
import {
  createCanvasSignTexture,
  createHazardStripeTexture,
} from "./canvasTextTexture";

interface WarehouseAndYards3DProps {
  layout: YardSceneLayout;
}

const WAREHOUSE_BAYS = ["K01", "K02", "K03", "K04"];

/**
 * Stylized low-poly architectural tree for human-scale reference around perimeter.
 */
const ArchitecturalTree: React.FC<{
  position: [number, number, number];
  scale?: number;
}> = ({ position, scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0.55, 0]} castShadow>
      <cylinderGeometry args={[0.11, 0.15, 1.1, 8]} />
      <meshStandardMaterial color="#78716c" roughness={0.9} />
    </mesh>
    <mesh position={[0, 1.65, 0]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.85, 0]} />
      <meshStandardMaterial color="#52796f" roughness={0.85} />
    </mesh>
    <mesh position={[0.35, 1.35, 0.25]} castShadow>
      <dodecahedronGeometry args={[0.52, 0]} />
      <meshStandardMaterial color="#6b9080" roughness={0.85} />
    </mesh>
  </group>
);

/**
 * Slim modern yard lamp post (architectural scale detail).
 */
const YardLampPost: React.FC<{ position: [number, number, number] }> = ({
  position,
}) => (
  <group position={position}>
    <mesh position={[0, 0.2, 0]} castShadow>
      <cylinderGeometry args={[0.14, 0.18, 0.4, 10]} />
      <meshStandardMaterial color="#94a3b8" roughness={0.7} />
    </mesh>
    <mesh position={[0, 2.7, 0]} castShadow>
      <cylinderGeometry args={[0.05, 0.08, 4.8, 10]} />
      <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.6} />
    </mesh>
    <mesh position={[0, 5.15, 0.28]} castShadow>
      <boxGeometry args={[0.36, 0.09, 0.72]} />
      <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.5} />
    </mesh>
    <mesh position={[0, 5.09, 0.44]}>
      <boxGeometry args={[0.26, 0.03, 0.36]} />
      <meshStandardMaterial color="#f8fafc" emissive="#fef9c3" emissiveIntensity={0.35} />
    </mesh>
  </group>
);

/**
 * Standing architectural sign board on twin steel posts (replaces messy floating HTML).
 */
const YardEntranceSign: React.FC<{
  position: [number, number, number];
  title: string;
  count: number;
  accentHex: string;
}> = ({ position, title, count, accentHex }) => {
  const signTexture = useMemo(
    () =>
      createCanvasSignTexture({
        text: title,
        subText: `${count} XE`,
        width: 512,
        height: 180,
        bgColor: "#0f172a",
        textColor: "#f8fafc",
        subTextColor: "#ffffff",
        accentBarColor: accentHex,
        borderColor: "#334155",
        borderWidth: 6,
        borderRadius: 16,
        fontSize: 42,
        subFontSize: 48,
      }),
    [title, count, accentHex],
  );

  useEffect(() => () => signTexture.dispose(), [signTexture]);

  return (
    <group position={position}>
      {/* Twin steel legs */}
      <mesh position={[-1.4, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.4, 10]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[1.4, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.4, 10]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Sign housing */}
      <RoundedBox args={[4.4, 1.45, 0.16]} radius={0.08} position={[0, 1.65, 0]} castShadow>
        <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.35} />
      </RoundedBox>
      {/* Front & back painted sign faces */}
      <mesh position={[0, 1.65, 0.09]}>
        <planeGeometry args={[4.2, 1.32]} />
        <meshStandardMaterial map={signTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.65, -0.09]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4.2, 1.32]} />
        <meshStandardMaterial map={signTexture} roughness={0.4} />
      </mesh>
    </group>
  );
};

const YardPad3D: React.FC<{
  zoneLayout: YardZoneLayout;
  title: string;
  floorStencil: string;
  count: number;
  accentHex: string;
  padHex: string;
  hazardTexture: THREE.CanvasTexture;
}> = ({
  zoneLayout,
  title,
  floorStencil,
  count,
  accentHex,
  padHex,
  hazardTexture,
}) => {
  const { centerX, centerZ, width, depth, slots } = zoneLayout;

  const stencilTexture = useMemo(
    () =>
      createCanvasSignTexture({
        text: floorStencil,
        width: 768,
        height: 160,
        transparentBg: true,
        textColor: accentHex,
        fontSize: 78,
      }),
    [floorStencil, accentHex],
  );

  const slotNumberTextures = useMemo(
    () =>
      slots.map((slot) =>
        createCanvasSignTexture({
          text: String(slot.slotNumber).padStart(2, "0"),
          width: 128,
          height: 128,
          transparentBg: true,
          textColor: "#64748b",
          fontSize: 64,
        }),
      ),
    [slots],
  );

  useEffect(() => {
    return () => {
      stencilTexture.dispose();
      slotNumberTextures.forEach((t) => t.dispose());
    };
  }, [stencilTexture, slotNumberTextures]);

  return (
    <group>
      {/* Concrete parking pad slab */}
      <RoundedBox
        args={[width, 0.08, depth]}
        radius={0.03}
        position={[centerX, 0.02, centerZ]}
        receiveShadow
      >
        <meshStandardMaterial color={padHex} roughness={0.9} metalness={0.02} />
      </RoundedBox>

      {/* Architectural raised perimeter concrete curb */}
      <mesh position={[centerX - width / 2 + 0.14, 0.09, centerZ]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.12, depth]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </mesh>
      <mesh position={[centerX + width / 2 - 0.14, 0.09, centerZ]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.12, depth]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </mesh>
      {/* Colored accent curb stripe along front & rear edges */}
      <mesh position={[centerX, 0.09, centerZ - depth / 2 + 0.14]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, 0.28]} />
        <meshStandardMaterial color={accentHex} roughness={0.55} />
      </mesh>
      <mesh position={[centerX, 0.09, centerZ + depth / 2 - 0.14]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, 0.28]} />
        <meshStandardMaterial color={accentHex} roughness={0.55} />
      </mesh>

      {/* Painted parking stalls, wheel stops, 5m scale line, and floor numbers */}
      {slots.map((slot, idx) => (
        <group key={slot.slotNumber} position={[slot.x, 0.065, slot.z]}>
          {/* Crisp white thermoplastic stall dividers */}
          <mesh position={[-slot.slotWidth / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.08, slot.slotDepth]} />
            <meshStandardMaterial color="#ffffff" roughness={0.7} />
          </mesh>
          <mesh position={[slot.slotWidth / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.08, slot.slotDepth]} />
            <meshStandardMaterial color="#ffffff" roughness={0.7} />
          </mesh>

          {/* Striped rubber/concrete rear wheel stop (aligns every truck's rear bumper!) */}
          <mesh position={[0, 0.06, -slot.slotDepth / 2 + 0.25]} castShadow receiveShadow>
            <boxGeometry args={[slot.slotWidth - 0.65, 0.14, 0.22]} />
            <meshStandardMaterial map={hazardTexture} roughness={0.75} />
          </mesh>

          {/* Subtle 5m visual length ruler tick across all bays */}
          <mesh position={[0, 0.002, -slot.slotDepth / 2 + 5.25]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[slot.slotWidth - 0.5, 0.05]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
          </mesh>

          {/* Painted floor slot number at front entrance of stall */}
          <mesh position={[0, 0.004, slot.slotDepth / 2 - 0.65]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.1, 1.1]} />
            <meshStandardMaterial
              map={slotNumberTextures[idx]}
              transparent
              opacity={0.78}
              roughness={0.85}
            />
          </mesh>
        </group>
      ))}

      {/* Painted floor zone stencil on the apron directly in front of the yard */}
      <mesh
        position={[centerX, 0.055, centerZ + depth / 2 + 1.05]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[7.2, 1.4]} />
        <meshStandardMaterial map={stencilTexture} transparent opacity={0.88} roughness={0.85} />
      </mesh>

      {/* Standing architectural yard sign with live vehicle count */}
      <YardEntranceSign
        position={[
          zoneLayout.zone === "waiting"
            ? centerX - width / 2 + 2.5
            : centerX + width / 2 - 2.5,
          0.04,
          centerZ + depth / 2 + 1.35,
        ]}
        title={title}
        count={count}
        accentHex={accentHex}
      />
    </group>
  );
};

export const WarehouseAndYards3D: React.FC<WarehouseAndYards3DProps> = ({
  layout,
}) => {
  const [whX, , whZ] = layout.warehouseCenter;
  const whWidth = layout.warehouseWidth;
  const whDepth = 7.8;
  const whHeight = 5.0;

  const hazardTexture = useMemo(() => createHazardStripeTexture(), []);

  const warehouseSignTexture = useMemo(
    () =>
      createCanvasSignTexture({
        text: "NHÀ KHO TRUNG TÂM",
        width: 1024,
        height: 180,
        transparentBg: true,
        textColor: "#ffffff",
        fontSize: 78,
      }),
    [],
  );

  const bayPlaqueTextures = useMemo(
    () =>
      WAREHOUSE_BAYS.map((code) =>
        createCanvasSignTexture({
          text: code,
          width: 192,
          height: 96,
          bgColor: "#0f172a",
          textColor: "#f8fafc",
          borderColor: "#38bdf8",
          borderWidth: 5,
          borderRadius: 12,
          fontSize: 54,
        }),
      ),
    [],
  );

  useEffect(() => {
    return () => {
      hazardTexture.dispose();
      warehouseSignTexture.dispose();
      bayPlaqueTextures.forEach((t) => t.dispose());
    };
  }, [hazardTexture, warehouseSignTexture, bayPlaqueTextures]);

  const totalComplexW =
    layout.waitingZone.width + layout.completedZone.width + 6.4;
  const complexCenterZ = (whZ - whDepth / 2 + layout.waitingZone.centerZ + layout.waitingZone.depth / 2 + 2.8) / 2;
  const totalComplexD =
    layout.waitingZone.centerZ +
    layout.waitingZone.depth / 2 +
    3.6 -
    (whZ - whDepth / 2 - 2.4);

  const dashedCenterLines = useMemo(() => {
    const arr: number[] = [];
    const start = layout.waitingZone.centerZ - layout.waitingZone.depth / 2 + 0.8;
    const end = layout.waitingZone.centerZ + layout.waitingZone.depth / 2 - 0.8;
    for (let z = start; z <= end; z += 1.65) {
      arr.push(z);
    }
    return arr;
  }, [layout.waitingZone.centerZ, layout.waitingZone.depth]);

  const facadeColumnsX = useMemo(() => {
    const count = 6;
    const arr: number[] = [];
    for (let i = 0; i < count; i++) {
      arr.push(-whWidth / 2 + (i * whWidth) / (count - 1));
    }
    return arr;
  }, [whWidth]);

  return (
    <group>
      {/* Seamless soft architectural surrounding ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.14, complexCenterZ]}
        receiveShadow
      >
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#d8e3ef" roughness={0.96} metalness={0} />
      </mesh>

      {/* Architectural Diorama Base Plinth (clean raised site frame) */}
      <RoundedBox
        args={[totalComplexW + 3.2, 0.24, totalComplexD + 3.2]}
        radius={0.08}
        position={[0, -0.12, complexCenterZ]}
        receiveShadow
      >
        <meshStandardMaterial color="#cbd5e1" roughness={0.88} />
      </RoundedBox>

      {/* Deep Charcoal Asphalt Driving Apron & Center Road (strong contrast!) */}
      <mesh
        position={[0, 0.01, complexCenterZ + 0.2]}
        receiveShadow
      >
        <boxGeometry args={[totalComplexW + 1.4, 0.04, totalComplexD + 1.2]} />
        <meshStandardMaterial color="#334155" roughness={0.86} metalness={0.04} />
      </mesh>

      {/* Crisp white dashed center road line separating the 2 yards */}
      {dashedCenterLines.map((dz, idx) => (
        <mesh key={idx} position={[0, 0.036, dz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.14, 0.85]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
        </mesh>
      ))}

      {/* Subtle crosswalk strip across front apron */}
      {[-1.2, -0.6, 0, 0.6, 1.2].map((cx, i) => (
        <mesh key={i} position={[cx, 0.036, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 1.5]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.75} />
        </mesh>
      ))}

      {/* ====== 1 NHÀ KHO TRUNG TÂM (ARCHITECTURAL LOGISTICS HUB) ====== */}
      <group position={[whX, 0, whZ]}>
        {/* Elevated concrete loading dock platform */}
        <RoundedBox
          args={[whWidth + 1.8, 0.64, whDepth + 2.4]}
          radius={0.04}
          position={[0, 0.32, 0.45]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
        </RoundedBox>

        {/* Main insulated steel building volume */}
        <RoundedBox
          args={[whWidth, whHeight, whDepth]}
          radius={0.06}
          position={[0, whHeight / 2 + 0.62, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#f1f5f9" roughness={0.68} metalness={0.08} />
        </RoundedBox>

        {/* Architectural vertical steel H-columns along front wall */}
        {facadeColumnsX.map((cx, i) => (
          <mesh key={i} position={[cx, whHeight / 2 + 0.62, whDepth / 2 + 0.04]} castShadow>
            <boxGeometry args={[0.24, whHeight, 0.14]} />
            <meshStandardMaterial color="#475569" roughness={0.45} metalness={0.45} />
          </mesh>
        ))}

        {/* Deep corporate navy roof fascia band with mounted 3D signage */}
        <mesh position={[0, whHeight + 0.12, whDepth / 2 + 0.06]} castShadow>
          <boxGeometry args={[whWidth + 0.2, 1.0, 0.18]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.38} metalness={0.22} />
        </mesh>
        {/* Crisp mounted building sign (zero floating HTML!) */}
        <mesh position={[0, whHeight + 0.12, whDepth / 2 + 0.165]}>
          <planeGeometry args={[8.4, 1.35]} />
          <meshStandardMaterial map={warehouseSignTexture} transparent roughness={0.4} />
        </mesh>

        {/* Ribbed standing-seam roof + skylight strips */}
        <mesh position={[0, whHeight + 0.72, 0]} castShadow receiveShadow>
          <boxGeometry args={[whWidth + 0.6, 0.24, whDepth + 0.6]} />
          <meshStandardMaterial color="#64748b" roughness={0.58} metalness={0.28} />
        </mesh>
        <mesh position={[0, whHeight + 0.96, 0]} castShadow>
          <boxGeometry args={[whWidth - 0.8, 0.28, whDepth * 0.62]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.55} metalness={0.22} />
        </mesh>
        {/* 4 Skylight strips on roof */}
        {[-0.36, -0.12, 0.12, 0.36].map((frac, idx) => (
          <mesh
            key={idx}
            position={[whWidth * frac, whHeight + 1.12, 0]}
          >
            <boxGeometry args={[whWidth * 0.16, 0.08, whDepth * 0.42]} />
            <meshStandardMaterial
              color="#bae6fd"
              roughness={0.12}
              metalness={0.6}
            />
          </mesh>
        ))}

        {/* Cantilevered steel loading canopy over dock doors */}
        <mesh position={[0, whHeight - 0.62, whDepth / 2 + 1.15]} castShadow>
          <boxGeometry args={[whWidth - 0.4, 0.16, 2.3]} />
          <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.45} />
        </mesh>
        {/* Angled canopy tension rods */}
        {facadeColumnsX.slice(1, -1).map((cx, i) => (
          <mesh
            key={i}
            position={[cx, whHeight - 0.12, whDepth / 2 + 0.95]}
            rotation={[0.52, 0, 0]}
          >
            <cylinderGeometry args={[0.03, 0.03, 1.85, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
          </mesh>
        ))}

        {/* 4 Detailed Loading Bays (K01 - K04) */}
        {WAREHOUSE_BAYS.map((bayCode, idx) => {
          const span = whWidth - 5.4;
          const step = span / (WAREHOUSE_BAYS.length - 1);
          const doorX = -span / 2 + idx * step;
          return (
            <group key={bayCode} position={[doorX, 2.02, whDepth / 2 + 0.02]}>
              {/* Dark recessed steel door frame */}
              <mesh>
                <boxGeometry args={[3.2, 2.95, 0.14]} />
                <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
              </mesh>
              {/* Sectional overhead aluminum door with horizontal ribs */}
              <mesh position={[0, 0.05, 0.05]}>
                <boxGeometry args={[2.86, 2.65, 0.06]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.42} metalness={0.38} />
              </mesh>
              {[-0.8, -0.25, 0.3, 0.85].map((ry, ri) => (
                <mesh key={ri} position={[0, ry, 0.09]}>
                  <boxGeometry args={[2.84, 0.04, 0.02]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.5} />
                </mesh>
              ))}
              {/* Warm LED loading bay light strip */}
              <mesh position={[0, 1.62, 0.18]}>
                <boxGeometry args={[1.4, 0.08, 0.12]} />
                <meshStandardMaterial color="#fffbeb" emissive="#fde68a" emissiveIntensity={0.45} />
              </mesh>
              {/* Mounted crisp bay plaque (K01..K04) */}
              <mesh position={[0, 1.98, 0.14]}>
                <planeGeometry args={[1.15, 0.56]} />
                <meshStandardMaterial map={bayPlaqueTextures[idx]} roughness={0.35} />
              </mesh>
              {/* Twin black rubber dock bumpers + yellow safety bollards */}
              <mesh position={[-1.45, -1.65, 1.58]} castShadow>
                <boxGeometry args={[0.24, 0.42, 0.18]} />
                <meshStandardMaterial color="#0f172a" roughness={0.85} />
              </mesh>
              <mesh position={[1.45, -1.65, 1.58]} castShadow>
                <boxGeometry args={[0.24, 0.42, 0.18]} />
                <meshStandardMaterial color="#0f172a" roughness={0.85} />
              </mesh>
              <mesh position={[-1.8, -1.05, 1.48]} castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.95, 10]} />
                <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.2} />
              </mesh>
              <mesh position={[1.8, -1.05, 1.48]} castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.95, 10]} />
                <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.2} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ====== 2 BÃI XE ĐỐI XỨNG ====== */}
      <YardPad3D
        zoneLayout={layout.waitingZone}
        title="BÃI XE CHỜ XẾP"
        floorStencil="BÃI CHỜ XẾP"
        count={layout.waitingCount}
        accentHex="#f59e0b"
        padHex="#e7edf5"
        hazardTexture={hazardTexture}
      />

      <YardPad3D
        zoneLayout={layout.completedZone}
        title="BÃI XE ĐÃ XẾP XONG"
        floorStencil="ĐÃ XẾP XONG"
        count={layout.completedCount}
        accentHex="#10b981"
        padHex="#e3f1eb"
        hazardTexture={hazardTexture}
      />

      {/* ====== MINIMALIST ARCHITECTURAL SCALE PROPS ====== */}
      <YardLampPost position={[0, 0.02, layout.waitingZone.centerZ - layout.waitingZone.depth / 2 + 0.6]} />
      <YardLampPost position={[0, 0.02, layout.waitingZone.centerZ + layout.waitingZone.depth / 2 - 0.6]} />

      <ArchitecturalTree position={[-totalComplexW / 2 - 1.1, 0, whZ - 1.5]} scale={1.15} />
      <ArchitecturalTree position={[-totalComplexW / 2 - 1.1, 0, whZ + 2.4]} scale={0.95} />
      <ArchitecturalTree position={[totalComplexW / 2 + 1.1, 0, whZ - 1.5]} scale={1.1} />
      <ArchitecturalTree position={[totalComplexW / 2 + 1.1, 0, whZ + 2.4]} scale={0.9} />
    </group>
  );
};
