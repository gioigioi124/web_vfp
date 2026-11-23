import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { VehicleYardPlacement } from "../../../types/vehicleOrders";
import { createCanvasSignTexture } from "./canvasTextTexture";

interface SizedTruck3DProps {
  placement: VehicleYardPlacement;
  isSelected: boolean;
  isDimmed: boolean;
  showLabels: boolean;
  onSelect: (placement: VehicleYardPlacement) => void;
}

/**
 * Builds an extruded aerodynamic cab profile (sloped windshield nose + rounded roof corner)
 * oriented along +Z (front) and centered on X/Y/Z.
 */
function createSculptedCabGeometry(
  cabWidth: number,
  cabHeight: number,
  cabLength: number,
  isHeavyOrCont: boolean,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hl = cabLength / 2;
  const hh = cabHeight / 2;
  const noseSlope = isHeavyOrCont ? cabLength * 0.16 : cabLength * 0.22;
  const bumperH = cabHeight * 0.36;

  // Profile in 2D: X = forward (+Z after rotation), Y = up (+Y)
  shape.moveTo(-hl, -hh);
  shape.lineTo(hl, -hh);
  shape.lineTo(hl, -hh + bumperH);
  // Sloped windshield face
  shape.lineTo(hl - noseSlope, hh - 0.08);
  shape.quadraticCurveTo(hl - noseSlope - 0.06, hh, hl - noseSlope - 0.18, hh);
  shape.lineTo(-hl + 0.08, hh);
  shape.quadraticCurveTo(-hl, hh, -hl, hh - 0.08);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: cabWidth - 0.08,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
  });

  // Center extrusion along Z, then rotate so profile +X becomes truck +Z (nose forward)
  geom.translate(0, 0, -(cabWidth - 0.08) / 2);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a sleek aerodynamic roof wind deflector (spoiler) for medium/heavy/container cabs.
 */
function createWindDeflectorGeometry(
  width: number,
  height: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-depth / 2, 0);
  shape.lineTo(depth / 2, 0);
  shape.quadraticCurveTo(depth * 0.05, height * 0.55, -depth / 2, height);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geom.translate(0, 0, -width / 2);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

const DetailedWheel: React.FC<{
  position: [number, number, number];
  radius: number;
  thickness: number;
  dual?: boolean;
}> = ({ position, radius, thickness, dual = false }) => {
  const offsets = dual ? [-thickness * 0.54, thickness * 0.54] : [0];
  return (
    <group position={position}>
      {offsets.map((dx, idx) => (
        <group key={idx} position={[dx, 0, 0]}>
          {/* Outer matte rubber tire */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[radius, radius, thickness, 24]} />
            <meshStandardMaterial color="#181c24" roughness={0.88} metalness={0.05} />
          </mesh>
          {/* Recessed dark rim ring */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[radius * 0.62, radius * 0.62, thickness + 0.015, 18]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.45} />
          </mesh>
          {/* Brushed alloy hub */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[radius * 0.46, radius * 0.46, thickness + 0.03, 16]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.28} metalness={0.72} />
          </mesh>
          {/* Center lug cap */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[radius * 0.16, radius * 0.16, thickness + 0.05, 12]} />
            <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.65} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const SizedTruck3D: React.FC<SizedTruck3DProps> = ({
  placement,
  isSelected,
  isDimmed,
  showLabels,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const { vehicle, dimensions, sizeClass, zone } = placement;
  const { length, width, height, cabLength, axleCount, accentHex } = dimensions;

  const isMini = sizeClass === "mini";
  const isLight = sizeClass === "light";
  const isContainer = sizeClass === "container";
  const isHeavyOrCont = sizeClass === "heavy" || isContainer;
  const hasWindDeflector = sizeClass === "medium" || isHeavyOrCont;

  const wheelRadius = isMini ? 0.27 : isLight ? 0.31 : sizeClass === "medium" ? 0.37 : 0.43;
  const wheelThickness = isMini ? 0.19 : 0.24;
  const chassisY = wheelRadius + 0.16;
  const chassisHeight = isHeavyOrCont ? 0.24 : 0.19;

  const hitchGap = isContainer ? 0.42 : 0.12;
  const boxLength = Math.max(1.3, length - cabLength - hitchGap);
  const cabWidth = width * 0.9;
  const cabHeight = Math.min(height * 0.78, isContainer ? 2.08 : isHeavyOrCont ? 2.0 : height - 0.26);
  const boxHeight = Math.max(0.95, height - chassisY - chassisHeight * 0.4);

  const boxCenterZ = -length / 2 + boxLength / 2;
  const cabCenterZ = length / 2 - cabLength / 2;
  const boxBottomY = chassisY + chassisHeight / 2;
  const boxCenterY = boxBottomY + boxHeight / 2;
  const cabCenterY = boxBottomY + cabHeight / 2;

  const statusStripeColor = vehicle.isCompleted
    ? "#10b981"
    : vehicle.isPrinted
      ? "#f59e0b"
      : "#64748b";

  const cabColor = isDimmed ? "#cbd5e1" : accentHex;
  const boxColor = isDimmed
    ? "#e2e8f0"
    : isContainer
      ? "#f3f0ff"
      : zone === "completed"
        ? "#f6fef9"
        : vehicle.isPrinted
          ? "#fffdf5"
          : "#ffffff";

  // Extruded sculpted geometries (memoized & cleanly disposed)
  const cabGeometry = useMemo(
    () => createSculptedCabGeometry(cabWidth, cabHeight, cabLength, isHeavyOrCont),
    [cabWidth, cabHeight, cabLength, isHeavyOrCont],
  );

  const deflectorHeight = Math.max(0.22, boxHeight - cabHeight + 0.04);
  const windDeflectorGeometry = useMemo(
    () =>
      hasWindDeflector
        ? createWindDeflectorGeometry(cabWidth * 0.86, Math.min(0.65, deflectorHeight), cabLength * 0.72)
        : null,
    [hasWindDeflector, cabWidth, deflectorHeight, cabLength],
  );

  // Crisp roof marking texture (painted straight onto cargo roof — zero messy floating boxes!)
  const roofTexture = useMemo(() => {
    const orderLabel =
      typeof vehicle.orderCount === "number" ? `${vehicle.orderCount} ĐƠN` : "";
    return createCanvasSignTexture({
      text: (vehicle.weight || "").toUpperCase(),
      subText: orderLabel,
      width: 512,
      height: 256,
      bgColor: isDimmed ? "#e2e8f0" : boxColor,
      textColor: isDimmed ? "#94a3b8" : "#0f172a",
      subTextColor: isDimmed ? "#94a3b8" : accentHex,
      accentBarColor: isDimmed ? "#cbd5e1" : statusStripeColor,
      borderColor: isDimmed ? "#cbd5e1" : "#cbd5e1",
      borderWidth: 6,
      borderRadius: 20,
      fontSize: 96,
      subFontSize: 52,
    });
  }, [vehicle.weight, vehicle.orderCount, isDimmed, boxColor, accentHex, statusStripeColor]);

  useEffect(() => {
    return () => {
      cabGeometry.dispose();
      windDeflectorGeometry?.dispose();
      roofTexture.dispose();
    };
  }, [cabGeometry, windDeflectorGeometry, roofTexture]);

  // Axles layout
  const axleConfigs = useMemo(() => {
    const frontZ = cabCenterZ + cabLength * 0.08;
    const rearEndZ = -length / 2 + wheelRadius * 1.7;
    if (axleCount <= 2) {
      return [
        { z: frontZ, dual: false },
        { z: rearEndZ, dual: sizeClass === "medium" },
      ];
    }
    if (axleCount === 3) {
      return [
        { z: frontZ, dual: false },
        { z: rearEndZ + wheelRadius * 2.35, dual: true },
        { z: rearEndZ, dual: true },
      ];
    }
    if (axleCount === 4) {
      return [
        { z: frontZ, dual: false },
        { z: cabCenterZ - cabLength * 0.62, dual: true },
        { z: rearEndZ + wheelRadius * 2.35, dual: true },
        { z: rearEndZ, dual: true },
      ];
    }
    return [
      { z: frontZ, dual: false },
      { z: cabCenterZ - cabLength * 0.62, dual: true },
      { z: rearEndZ + wheelRadius * 4.7, dual: true },
      { z: rearEndZ + wheelRadius * 2.35, dual: true },
      { z: rearEndZ, dual: true },
    ];
  }, [axleCount, cabCenterZ, cabLength, length, sizeClass, wheelRadius]);

  // Corrugated ribs for containers / panel seams for box trucks
  const sideRibsZ = useMemo(() => {
    const step = isContainer ? 0.52 : 1.15;
    const count = Math.max(2, Math.floor(boxLength / step));
    const arr: number[] = [];
    for (let i = 1; i < count; i++) {
      arr.push(boxCenterZ - boxLength / 2 + (i * boxLength) / count);
    }
    return arr;
  }, [isContainer, boxLength, boxCenterZ]);

  // Smooth subtle lift on hover / selection
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = isSelected ? 0.14 : hovered ? 0.07 : 0;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      Math.min(1, delta * 12),
    );
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(placement);
  };

  const noseSlope = isHeavyOrCont ? cabLength * 0.16 : cabLength * 0.22;
  const windshieldAngle = Math.atan2(noseSlope, cabHeight * 0.6);

  return (
    <group
      position={[placement.position[0], 0, placement.position[2]]}
      rotation={[0, placement.rotationY, 0]}
    >
      {/* Clean ground selection frame */}
      {(isSelected || hovered) && (
        <group position={[0, 0.055, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width + 0.85, length + 0.85]} />
            <meshBasicMaterial
              color={isSelected ? "#2563eb" : accentHex}
              transparent
              opacity={isSelected ? 0.2 : 0.11}
            />
          </mesh>
          {/* Crisp perimeter outline */}
          <mesh position={[0, 0.005, (length + 0.85) / 2]}>
            <boxGeometry args={[width + 0.85, 0.015, 0.08]} />
            <meshBasicMaterial color={isSelected ? "#2563eb" : accentHex} />
          </mesh>
          <mesh position={[0, 0.005, -(length + 0.85) / 2]}>
            <boxGeometry args={[width + 0.85, 0.015, 0.08]} />
            <meshBasicMaterial color={isSelected ? "#2563eb" : accentHex} />
          </mesh>
          <mesh position={[(width + 0.85) / 2, 0.005, 0]}>
            <boxGeometry args={[0.08, 0.015, length + 0.85]} />
            <meshBasicMaterial color={isSelected ? "#2563eb" : accentHex} />
          </mesh>
          <mesh position={[-(width + 0.85) / 2, 0.005, 0]}>
            <boxGeometry args={[0.08, 0.015, length + 0.85]} />
            <meshBasicMaterial color={isSelected ? "#2563eb" : accentHex} />
          </mesh>
        </group>
      )}

      <group
        ref={groupRef}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        {/* Steel Ladder Chassis Frame */}
        <mesh position={[width * 0.22, chassisY, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.14, chassisHeight, length - 0.24]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} metalness={0.35} />
        </mesh>
        <mesh position={[-width * 0.22, chassisY, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.14, chassisHeight, length - 0.24]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} metalness={0.35} />
        </mesh>

        {/* Fifth-wheel coupling plate for Container tractors */}
        {isContainer && (
          <mesh position={[0, chassisY + chassisHeight * 0.55, cabCenterZ - cabLength * 0.58]}>
            <cylinderGeometry args={[0.38, 0.42, 0.1, 16]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
          </mesh>
        )}

        {/* Side underrun safety guard rails + aluminum fuel tank */}
        {!isMini && (
          <>
            <mesh position={[width * 0.45, chassisY - 0.04, boxCenterZ * 0.45]}>
              <boxGeometry args={[0.05, 0.09, boxLength * 0.38]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.55} />
            </mesh>
            <mesh position={[-width * 0.45, chassisY - 0.04, boxCenterZ * 0.45]}>
              <boxGeometry args={[0.05, 0.09, boxLength * 0.38]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.55} />
            </mesh>
            {/* Cylindrical aluminum fuel tank */}
            <mesh
              position={[width * 0.36, chassisY - 0.06, cabCenterZ - cabLength * 0.72]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.16, 0.16, 0.72, 14]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.28} metalness={0.78} />
            </mesh>
          </>
        )}

        {/* Sculpted Cargo Body (RoundedBox with metallic frame trim) */}
        <RoundedBox
          args={[width, boxHeight, boxLength]}
          radius={isContainer ? 0.04 : 0.075}
          smoothness={3}
          position={[0, boxCenterY, boxCenterZ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={boxColor}
            roughness={isContainer ? 0.5 : 0.38}
            metalness={isContainer ? 0.22 : 0.12}
            transparent={isDimmed}
            opacity={isDimmed ? 0.38 : 1}
          />
        </RoundedBox>

        {/* Top & bottom brushed aluminum rail moldings along cargo sides */}
        <mesh position={[width / 2 + 0.008, boxBottomY + boxHeight - 0.12, boxCenterZ]}>
          <boxGeometry args={[0.024, 0.13, boxLength - 0.08]} />
          <meshStandardMaterial
            color={isDimmed ? "#cbd5e1" : statusStripeColor}
            roughness={0.35}
            metalness={0.18}
          />
        </mesh>
        <mesh position={[-width / 2 - 0.008, boxBottomY + boxHeight - 0.12, boxCenterZ]}>
          <boxGeometry args={[0.024, 0.13, boxLength - 0.08]} />
          <meshStandardMaterial
            color={isDimmed ? "#cbd5e1" : statusStripeColor}
            roughness={0.35}
            metalness={0.18}
          />
        </mesh>
        {/* Lower size-class accent pinstripe */}
        <mesh position={[width / 2 + 0.008, boxBottomY + 0.09, boxCenterZ]}>
          <boxGeometry args={[0.022, 0.08, boxLength - 0.12]} />
          <meshStandardMaterial
            color={isDimmed ? "#cbd5e1" : accentHex}
            roughness={0.35}
            metalness={0.2}
          />
        </mesh>
        <mesh position={[-width / 2 - 0.008, boxBottomY + 0.09, boxCenterZ]}>
          <boxGeometry args={[0.022, 0.08, boxLength - 0.12]} />
          <meshStandardMaterial
            color={isDimmed ? "#cbd5e1" : accentHex}
            roughness={0.35}
            metalness={0.2}
          />
        </mesh>

        {/* Corrugated ribs (Container) or subtle insulated panel seams (Box truck) */}
        {sideRibsZ.map((rz, idx) => (
          <React.Fragment key={idx}>
            <mesh position={[width / 2 + 0.012, boxCenterY, rz]}>
              <boxGeometry
                args={[
                  isContainer ? 0.032 : 0.012,
                  boxHeight - 0.3,
                  isContainer ? 0.12 : 0.025,
                ]}
              />
              <meshStandardMaterial
                color={isDimmed ? "#cbd5e1" : isContainer ? "#ddd6fe" : "#e2e8f0"}
                roughness={0.5}
                metalness={isContainer ? 0.25 : 0.1}
              />
            </mesh>
            <mesh position={[-width / 2 - 0.012, boxCenterY, rz]}>
              <boxGeometry
                args={[
                  isContainer ? 0.032 : 0.012,
                  boxHeight - 0.3,
                  isContainer ? 0.12 : 0.025,
                ]}
              />
              <meshStandardMaterial
                color={isDimmed ? "#cbd5e1" : isContainer ? "#ddd6fe" : "#e2e8f0"}
                roughness={0.5}
                metalness={isContainer ? 0.25 : 0.1}
              />
            </mesh>
          </React.Fragment>
        ))}

        {/* Rear door center seam + vertical chrome lock rods + taillights */}
        <mesh position={[0, boxCenterY, boxCenterZ - boxLength / 2 - 0.008]}>
          <boxGeometry args={[0.028, boxHeight - 0.12, 0.016]} />
          <meshStandardMaterial color="#64748b" roughness={0.5} />
        </mesh>
        <mesh position={[width * 0.14, boxCenterY, boxCenterZ - boxLength / 2 - 0.018]}>
          <cylinderGeometry args={[0.018, 0.018, boxHeight - 0.24, 8]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
        <mesh position={[-width * 0.14, boxCenterY, boxCenterZ - boxLength / 2 - 0.018]}>
          <cylinderGeometry args={[0.018, 0.018, boxHeight - 0.24, 8]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
        {/* Rear underrun bumper + taillight clusters */}
        <mesh position={[0, chassisY - 0.04, -length / 2 - 0.03]}>
          <boxGeometry args={[width * 0.92, 0.16, 0.08]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
        <mesh position={[width * 0.34, chassisY - 0.03, -length / 2 - 0.075]}>
          <boxGeometry args={[0.26, 0.09, 0.02]} />
          <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[-width * 0.34, chassisY - 0.03, -length / 2 - 0.075]}>
          <boxGeometry args={[0.26, 0.09, 0.02]} />
          <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.35} />
        </mesh>

        {/* Crisp Painted Roof Marking (zero messy floating HTML boxes!) */}
        {showLabels && (
          <mesh
            position={[0, boxBottomY + boxHeight + 0.012, boxCenterZ]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          >
            <planeGeometry args={[Math.min(boxLength - 0.24, 3.3), width - 0.2]} />
            <meshStandardMaterial
              map={roofTexture}
              roughness={0.65}
              metalness={0.02}
              transparent={isDimmed}
              opacity={isDimmed ? 0.35 : 0.96}
            />
          </mesh>
        )}

        {/* Sculpted Aerodynamic Cab */}
        <mesh
          geometry={cabGeometry}
          position={[0, cabCenterY, cabCenterZ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={cabColor}
            roughness={0.26}
            metalness={0.18}
            transparent={isDimmed}
            opacity={isDimmed ? 0.38 : 1}
          />
        </mesh>

        {/* Roof Aerodynamic Wind Deflector */}
        {windDeflectorGeometry && (
          <mesh
            geometry={windDeflectorGeometry}
            position={[0, boxBottomY + cabHeight - 0.02, cabCenterZ - cabLength * 0.06]}
            castShadow
          >
            <meshStandardMaterial
              color={cabColor}
              roughness={0.26}
              metalness={0.18}
              transparent={isDimmed}
              opacity={isDimmed ? 0.38 : 1}
            />
          </mesh>
        )}

        {/* Sloped Panoramic Windshield (catches studio Environment reflections!) */}
        <mesh
          position={[
            0,
            cabCenterY + cabHeight * 0.18,
            cabCenterZ + cabLength / 2 - noseSlope * 0.45 + 0.035,
          ]}
          rotation={[-windshieldAngle, 0, 0]}
        >
          <boxGeometry args={[cabWidth * 0.84, cabHeight * 0.44, 0.04]} />
          <meshStandardMaterial
            color="#0f172a"
            roughness={0.08}
            metalness={0.85}
          />
        </mesh>

        {/* Side Cab Windows */}
        <mesh position={[cabWidth / 2 + 0.022, cabCenterY + cabHeight * 0.16, cabCenterZ + cabLength * 0.04]}>
          <boxGeometry args={[0.025, cabHeight * 0.36, cabLength * 0.56]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.8} />
        </mesh>
        <mesh position={[-cabWidth / 2 - 0.022, cabCenterY + cabHeight * 0.16, cabCenterZ + cabLength * 0.04]}>
          <boxGeometry args={[0.025, cabHeight * 0.36, cabLength * 0.56]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.8} />
        </mesh>

        {/* Side Mirrors on Arms */}
        <group position={[cabWidth / 2 + 0.12, cabCenterY + cabHeight * 0.18, cabCenterZ + cabLength * 0.24]}>
          <mesh position={[-0.06, 0, 0]}>
            <boxGeometry args={[0.14, 0.025, 0.025]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <RoundedBox args={[0.06, 0.26, 0.1]} radius={0.015}>
            <meshStandardMaterial color="#1e293b" roughness={0.4} />
          </RoundedBox>
        </group>
        <group position={[-cabWidth / 2 - 0.12, cabCenterY + cabHeight * 0.18, cabCenterZ + cabLength * 0.24]}>
          <mesh position={[0.06, 0, 0]}>
            <boxGeometry args={[0.14, 0.025, 0.025]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <RoundedBox args={[0.06, 0.26, 0.1]} radius={0.015}>
            <meshStandardMaterial color="#1e293b" roughness={0.4} />
          </RoundedBox>
        </group>

        {/* Front Grille + Chrome Accent Slats */}
        <mesh position={[0, cabCenterY - cabHeight * 0.19, cabCenterZ + cabLength / 2 + 0.035]}>
          <boxGeometry args={[cabWidth * 0.68, cabHeight * 0.24, 0.04]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, cabCenterY - cabHeight * 0.15, cabCenterZ + cabLength / 2 + 0.058]}>
          <boxGeometry args={[cabWidth * 0.6, 0.035, 0.015]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.85} />
        </mesh>
        <mesh position={[0, cabCenterY - cabHeight * 0.23, cabCenterZ + cabLength / 2 + 0.058]}>
          <boxGeometry args={[cabWidth * 0.56, 0.035, 0.015]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.85} />
        </mesh>

        {/* Sculpted Front Bumper + Twin Headlights + Amber Turn Signals */}
        <RoundedBox
          args={[width * 0.96, 0.22, 0.16]}
          radius={0.04}
          position={[0, boxBottomY + 0.08, cabCenterZ + cabLength / 2 + 0.04]}
          castShadow
        >
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.25} />
        </RoundedBox>
        {/* Headlights */}
        <mesh position={[width * 0.31, boxBottomY + 0.1, cabCenterZ + cabLength / 2 + 0.125]}>
          <boxGeometry args={[0.22, 0.11, 0.025]} />
          <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.55} roughness={0.15} />
        </mesh>
        <mesh position={[-width * 0.31, boxBottomY + 0.1, cabCenterZ + cabLength / 2 + 0.125]}>
          <boxGeometry args={[0.22, 0.11, 0.025]} />
          <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.55} roughness={0.15} />
        </mesh>
        {/* Corner turn signals */}
        <mesh position={[width * 0.43, boxBottomY + 0.1, cabCenterZ + cabLength / 2 + 0.115]}>
          <boxGeometry args={[0.07, 0.1, 0.03]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[-width * 0.43, boxBottomY + 0.1, cabCenterZ + cabLength / 2 + 0.115]}>
          <boxGeometry args={[0.07, 0.1, 0.03]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.25} />
        </mesh>

        {/* Detailed Multi-Axle Wheels */}
        {axleConfigs.map((axle, idx) => (
          <group key={idx} position={[0, wheelRadius, axle.z]}>
            <DetailedWheel
              position={[width * 0.44 - (axle.dual ? wheelThickness * 0.38 : 0), 0, 0]}
              radius={wheelRadius}
              thickness={wheelThickness}
              dual={axle.dual}
            />
            <DetailedWheel
              position={[-(width * 0.44 - (axle.dual ? wheelThickness * 0.38 : 0)), 0, 0]}
              radius={wheelRadius}
              thickness={wheelThickness}
              dual={axle.dual}
            />
          </group>
        ))}

        {/* Sleek Dark Glassmorphic Tooltip ONLY on Hover or Selected (zero clutter!) */}
        {(hovered || isSelected) && !isDimmed && (
          <Html
            position={[0, height + 0.72, 0]}
            center
            zIndexRange={[30, 0]}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelect(placement);
              }}
              className="pointer-events-auto cursor-pointer select-none whitespace-nowrap rounded-lg px-2.5 py-1.5 bg-slate-900/92 text-white backdrop-blur-md shadow-xl border border-white/15"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: accentHex }}
                />
                <span>{vehicle.weight}</span>
                <span className="text-slate-400 font-normal">·</span>
                <span className="text-sky-300 font-mono text-[11px]">
                  {vehicle.time}
                </span>
                {typeof vehicle.orderCount === "number" && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-mono">
                    {vehicle.orderCount} đơn
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5 max-w-[200px] truncate">
                {vehicle.destination}
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
};
