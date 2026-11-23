import React, { useMemo, useRef, useState } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { VehicleYardPlacement } from "../../../types/vehicleOrders";

interface SizedTruck3DProps {
  placement: VehicleYardPlacement;
  isSelected: boolean;
  isDimmed: boolean;
  showLabels: boolean;
  onSelect: (placement: VehicleYardPlacement) => void;
}

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

  const isContainer = sizeClass === "container";
  const wheelRadius = sizeClass === "mini" ? 0.28 : sizeClass === "light" ? 0.32 : sizeClass === "medium" ? 0.38 : 0.44;
  const wheelThickness = sizeClass === "mini" ? 0.2 : 0.26;
  const chassisY = wheelRadius + 0.14;
  const chassisHeight = 0.22;

  // Tách tỷ lệ chiều dài cabin và thùng hàng (mũi xe hướng +Z, đuôi xe hướng -Z)
  const hitchGap = isContainer ? 0.35 : 0.1;
  const boxLength = Math.max(1.2, length - cabLength - hitchGap);
  const cabHeight = Math.min(height * 0.84, isContainer ? 2.25 : height - 0.16);
  const boxHeight = height - chassisY - chassisHeight * 0.5;

  const boxCenterZ = -length / 2 + boxLength / 2;
  const cabCenterZ = length / 2 - cabLength / 2;

  // Màu dải trạng thái trên thùng xe
  const statusStripeColor = vehicle.isCompleted
    ? "#10b981" // emerald-500
    : vehicle.isPrinted
      ? "#f59e0b" // amber-500
      : "#64748b"; // slate-500

  const cabColor = isDimmed ? "#cbd5e1" : accentHex;
  const boxColor = isDimmed
    ? "#e2e8f0"
    : zone === "completed"
      ? "#f0fdf4"
      : vehicle.isPrinted
        ? "#fffbeb"
        : "#ffffff";

  // Tính vị trí các trục bánh xe
  const axleZPositions = useMemo(() => {
    const frontZ = cabCenterZ + cabLength * 0.1;
    const rearEndZ = -length / 2 + wheelRadius * 1.65;
    if (axleCount <= 2) {
      return [frontZ, rearEndZ];
    }
    if (axleCount === 3) {
      return [frontZ, rearEndZ + wheelRadius * 2.35, rearEndZ];
    }
    if (axleCount === 4) {
      // Đầu kéo 2 trục + rơ-moóc 2 trục sau
      return [
        frontZ,
        cabCenterZ - cabLength * 0.55,
        rearEndZ + wheelRadius * 2.35,
        rearEndZ,
      ];
    }
    // 5 trục (Cont 40)
    return [
      frontZ,
      cabCenterZ - cabLength * 0.55,
      rearEndZ + wheelRadius * 4.7,
      rearEndZ + wheelRadius * 2.35,
      rearEndZ,
    ];
  }, [axleCount, cabCenterZ, cabLength, length, wheelRadius]);

  // Thanh gân sườn container cho xe Container để nhận diện ngay lập tức
  const containerRibs = useMemo(() => {
    if (!isContainer) return [];
    const ribCount = Math.max(5, Math.floor(boxLength / 0.85));
    const arr: number[] = [];
    for (let i = 1; i < ribCount; i++) {
      arr.push(boxCenterZ - boxLength / 2 + (i * boxLength) / ribCount);
    }
    return arr;
  }, [isContainer, boxCenterZ, boxLength]);

  // Nâng nhẹ xe khi hover hoặc đang chọn
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = isSelected ? 0.14 : hovered ? 0.08 : 0;
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

  return (
    <group
      position={[placement.position[0], 0, placement.position[2]]}
      rotation={[0, placement.rotationY, 0]}
    >
      {/* Vòng nhấn chọn/hover dưới mặt sân */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.75, length + 0.75]} />
          <meshBasicMaterial
            color={isSelected ? "#2563eb" : accentHex}
            transparent
            opacity={isSelected ? 0.24 : 0.14}
          />
        </mesh>
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
        {/* Khung gầm xe */}
        <mesh
          position={[0, chassisY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width * 0.86, chassisHeight, length - 0.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.75} metalness={0.2} />
        </mesh>

        {/* Thùng hàng chính */}
        <mesh
          position={[0, chassisY + chassisHeight / 2 + boxHeight / 2, boxCenterZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width, boxHeight, boxLength]} />
          <meshStandardMaterial
            color={boxColor}
            roughness={0.55}
            metalness={0.08}
            transparent={isDimmed}
            opacity={isDimmed ? 0.45 : 1}
          />
        </mesh>

        {/* Dải màu trạng thái chạy dọc 2 bên thùng hàng */}
        <mesh
          position={[
            width / 2 + 0.012,
            chassisY + chassisHeight / 2 + boxHeight - 0.16,
            boxCenterZ,
          ]}
        >
          <boxGeometry args={[0.025, 0.2, boxLength - 0.06]} />
          <meshStandardMaterial
            color={isDimmed ? "#cbd5e1" : statusStripeColor}
            roughness={0.45}
          />
        </mesh>
        <mesh
          position={[
            -width / 2 - 0.012,
            chassisY + chassisHeight / 2 + boxHeight - 0.16,
            boxCenterZ,
          ]}
        >
          <boxGeometry args={[0.025, 0.2, boxLength - 0.06]} />
          <meshStandardMaterial
            color={isDimmed ? "#cbd5e1" : statusStripeColor}
            roughness={0.45}
          />
        </mesh>

        {/* Dải màu kích thước (accentHex) ở chân thùng giúp phân biệt cỡ xe từ góc nhìn trên cao */}
        <mesh
          position={[
            0,
            chassisY + chassisHeight / 2 + boxHeight + 0.015,
            boxCenterZ,
          ]}
        >
          <boxGeometry args={[width * 0.94, 0.03, boxLength * 0.94]} />
          <meshStandardMaterial
            color={isDimmed ? "#cbd5e1" : accentHex}
            roughness={0.5}
            transparent
            opacity={isDimmed ? 0.35 : 0.22}
          />
        </mesh>

        {/* Gân container 2 bên (chỉ cho xe Container) */}
        {containerRibs.map((ribZ, i) => (
          <React.Fragment key={i}>
            <mesh
              position={[
                width / 2 + 0.018,
                chassisY + chassisHeight / 2 + boxHeight / 2,
                ribZ,
              ]}
            >
              <boxGeometry args={[0.035, boxHeight - 0.25, 0.09]} />
              <meshStandardMaterial color={isDimmed ? "#cbd5e1" : "#c4b5fd"} roughness={0.6} />
            </mesh>
            <mesh
              position={[
                -width / 2 - 0.018,
                chassisY + chassisHeight / 2 + boxHeight / 2,
                ribZ,
              ]}
            >
              <boxGeometry args={[0.035, boxHeight - 0.25, 0.09]} />
              <meshStandardMaterial color={isDimmed ? "#cbd5e1" : "#c4b5fd"} roughness={0.6} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Cửa sau thùng hàng */}
        <mesh
          position={[
            0,
            chassisY + chassisHeight / 2 + boxHeight / 2,
            boxCenterZ - boxLength / 2 - 0.01,
          ]}
        >
          <boxGeometry args={[0.04, boxHeight - 0.12, 0.02]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>

        {/* Cabin đầu xe (tô màu theo nhóm kích thước để nhận diện tức thì) */}
        <mesh
          position={[0, chassisY + chassisHeight / 2 + cabHeight / 2, cabCenterZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width * 0.92, cabHeight, cabLength]} />
          <meshStandardMaterial
            color={cabColor}
            roughness={0.42}
            metalness={0.14}
            transparent={isDimmed}
            opacity={isDimmed ? 0.45 : 1}
          />
        </mesh>

        {/* Kính chắn gió phía trước */}
        <mesh
          position={[
            0,
            chassisY + chassisHeight / 2 + cabHeight * 0.62,
            cabCenterZ + cabLength / 2 + 0.015,
          ]}
        >
          <boxGeometry args={[width * 0.8, cabHeight * 0.42, 0.04]} />
          <meshStandardMaterial color="#0f172a" roughness={0.15} metalness={0.5} />
        </mesh>

        {/* Cản trước + lưới tản nhiệt + đèn pha */}
        <mesh
          position={[
            0,
            chassisY + 0.08,
            cabCenterZ + cabLength / 2 + 0.04,
          ]}
        >
          <boxGeometry args={[width * 0.94, 0.22, 0.1]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
        <mesh
          position={[
            width * 0.3,
            chassisY + 0.1,
            cabCenterZ + cabLength / 2 + 0.09,
          ]}
        >
          <boxGeometry args={[0.2, 0.12, 0.03]} />
          <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={0.4} />
        </mesh>
        <mesh
          position={[
            -width * 0.3,
            chassisY + 0.1,
            cabCenterZ + cabLength / 2 + 0.09,
          ]}
        >
          <boxGeometry args={[0.2, 0.12, 0.03]} />
          <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={0.4} />
        </mesh>

        {/* Các trục bánh xe */}
        {axleZPositions.map((az, idx) => (
          <group key={idx} position={[0, wheelRadius, az]}>
            <mesh position={[width * 0.46, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[wheelRadius, wheelRadius, wheelThickness, 18]} />
              <meshStandardMaterial color="#1e293b" roughness={0.85} />
            </mesh>
            <mesh position={[width * 0.46 + wheelThickness * 0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[wheelRadius * 0.5, wheelRadius * 0.5, 0.04, 14]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
            </mesh>

            <mesh position={[-width * 0.46, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[wheelRadius, wheelRadius, wheelThickness, 18]} />
              <meshStandardMaterial color="#1e293b" roughness={0.85} />
            </mesh>
            <mesh position={[-width * 0.46 - wheelThickness * 0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[wheelRadius * 0.5, wheelRadius * 0.5, 0.04, 14]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
            </mesh>
          </group>
        ))}

        {/* Nhãn nổi gọn trực quan hiển thị kích thước xe + tuyến */}
        {(showLabels || hovered || isSelected) && !isDimmed && (
          <Html
            position={[0, height + 0.65, 0]}
            center
            zIndexRange={[20, 0]}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelect(placement);
              }}
              className={`cursor-pointer select-none whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] leading-tight shadow-md border transition-transform ${
                isSelected
                  ? "bg-primary-800 text-white border-primary-500 scale-105"
                  : hovered
                    ? "bg-white text-gray-900 border-primary-400 scale-105"
                    : "bg-white/92 text-gray-800 border-gray-300/90"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: accentHex }}
                />
                <span>{vehicle.weight}</span>
                {typeof vehicle.orderCount === "number" && (
                  <span
                    className={`font-mono text-[10px] px-1 rounded ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {vehicle.orderCount}đ
                  </span>
                )}
              </div>
              {(hovered || isSelected) && (
                <div
                  className={`text-[10px] mt-0.5 max-w-[160px] truncate ${
                    isSelected ? "text-sky-100" : "text-gray-500"
                  }`}
                >
                  {vehicle.time} · {vehicle.destination}
                </div>
              )}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
};
