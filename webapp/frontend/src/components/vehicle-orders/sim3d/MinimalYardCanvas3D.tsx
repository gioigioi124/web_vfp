import React, { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  TruckSizeClass,
  VehicleYardPlacement,
  YardCameraPreset,
} from "../../../types/vehicleOrders";
import { YardSceneLayout } from "./yardLayoutMapper";
import { WarehouseAndYards3D } from "./WarehouseAndYards3D";
import { SizedTruck3D } from "./SizedTruck3D";

interface MinimalYardCanvas3DProps {
  layout: YardSceneLayout;
  selectedVehicleId: string | null;
  highlightSizeClass: TruckSizeClass | null;
  cameraPreset: YardCameraPreset;
  cameraSignal: number;
  showLabels: boolean;
  onSelectPlacement: (placement: VehicleYardPlacement | null) => void;
}

class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-600 p-6 text-center">
          <p className="font-semibold text-sm text-slate-800">
            Trình duyệt hiện không hỗ trợ WebGL 3D
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Bạn có thể chuyển sang chế độ &ldquo;Danh sách 3 cột&rdquo; ở góc trên để xem dữ liệu bình thường.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const CameraRig: React.FC<{
  layout: YardSceneLayout;
  cameraPreset: YardCameraPreset;
  cameraSignal: number;
  selectedPlacement: VehicleYardPlacement | null;
}> = ({ layout, cameraPreset, cameraSignal, selectedPlacement }) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const desiredPos = useRef(new THREE.Vector3(0, 22, 30));
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 2));
  const isAnimating = useRef(true);

  useEffect(() => {
    const centerZ = layout.waitingZone.centerZ - 1.5;
    const spanScale = Math.max(1, layout.waitingZone.depth / 15);

    if (cameraPreset === "waiting") {
      desiredPos.current.set(
        layout.waitingZone.centerX - 3,
        14 * spanScale,
        layout.waitingZone.centerZ + 14 * spanScale,
      );
      desiredTarget.current.set(
        layout.waitingZone.centerX,
        0.5,
        layout.waitingZone.centerZ - 1,
      );
    } else if (cameraPreset === "completed") {
      desiredPos.current.set(
        layout.completedZone.centerX + 3,
        14 * spanScale,
        layout.completedZone.centerZ + 14 * spanScale,
      );
      desiredTarget.current.set(
        layout.completedZone.centerX,
        0.5,
        layout.completedZone.centerZ - 1,
      );
    } else if (cameraPreset === "top") {
      desiredPos.current.set(0, 36 * spanScale, centerZ + 4);
      desiredTarget.current.set(0, 0, centerZ);
    } else {
      desiredPos.current.set(0, 21 * spanScale, centerZ + 26 * spanScale);
      desiredTarget.current.set(0, 0.5, centerZ - 1);
    }
    isAnimating.current = true;
  }, [
    cameraPreset,
    cameraSignal,
    layout.waitingZone.centerX,
    layout.waitingZone.centerZ,
    layout.waitingZone.depth,
    layout.completedZone.centerX,
    layout.completedZone.centerZ,
  ]);

  // Nhẹ nhàng hướng tâm nhìn về xe vừa click
  useEffect(() => {
    if (!selectedPlacement) return;
    const [tx, , tz] = selectedPlacement.position;
    desiredTarget.current.set(tx, 0.8, tz);
    desiredPos.current.set(tx + (tx < 0 ? -7 : 7), 10.5, tz + 12.5);
    isAnimating.current = true;
  }, [selectedPlacement]);

  useFrame((_, delta) => {
    if (!isAnimating.current || !controlsRef.current) return;
    const alpha = Math.min(1, delta * 5.5);
    camera.position.lerp(desiredPos.current, alpha);
    controlsRef.current.target.lerp(desiredTarget.current, alpha);
    controlsRef.current.update();

    if (
      camera.position.distanceTo(desiredPos.current) < 0.08 &&
      controlsRef.current.target.distanceTo(desiredTarget.current) < 0.08
    ) {
      isAnimating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.08}
      minDistance={7}
      maxDistance={85}
      onStart={() => {
        isAnimating.current = false;
      }}
    />
  );
};

export const MinimalYardCanvas3D: React.FC<MinimalYardCanvas3DProps> = ({
  layout,
  selectedVehicleId,
  highlightSizeClass,
  cameraPreset,
  cameraSignal,
  showLabels,
  onSelectPlacement,
}) => {
  const selectedPlacement =
    layout.placements.find((p) => p.vehicle._id === selectedVehicleId) || null;

  return (
    <WebGLErrorBoundary>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 22, 30], fov: 38, near: 0.5, far: 250 }}
        onPointerMissed={() => onSelectPlacement(null)}
        className="w-full h-full"
      >
        <color attach="background" args={["#e8eef6"]} />

        {/* Ánh sáng ban ngày trung tính, rõ khối và kích thước xe */}
        <hemisphereLight args={["#ffffff", "#cbd5e1", 0.95]} />
        <directionalLight
          position={[18, 32, 22]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
          shadow-camera-near={2}
          shadow-camera-far={95}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-18, 16, -12]} intensity={0.35} />

        <CameraRig
          layout={layout}
          cameraPreset={cameraPreset}
          cameraSignal={cameraSignal}
          selectedPlacement={selectedPlacement}
        />

        <WarehouseAndYards3D layout={layout} />

        {layout.placements.map((placement) => (
          <SizedTruck3D
            key={placement.vehicle._id}
            placement={placement}
            isSelected={placement.vehicle._id === selectedVehicleId}
            isDimmed={
              Boolean(highlightSizeClass) &&
              placement.sizeClass !== highlightSizeClass
            }
            showLabels={showLabels}
            onSelect={(p) => onSelectPlacement(p)}
          />
        ))}
      </Canvas>
    </WebGLErrorBoundary>
  );
};
