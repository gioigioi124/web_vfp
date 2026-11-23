import React, { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
} from "@react-three/drei";
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
  const desiredPos = useRef(new THREE.Vector3(-11, 20, 30));
  const desiredTarget = useRef(new THREE.Vector3(0, 0.5, 1));
  const isAnimating = useRef(true);

  useEffect(() => {
    const centerZ = layout.waitingZone.centerZ - 1.5;
    const spanScale = Math.max(1, layout.waitingZone.depth / 15);

    if (cameraPreset === "waiting") {
      desiredPos.current.set(
        layout.waitingZone.centerX - 6,
        13 * spanScale,
        layout.waitingZone.centerZ + 14.5 * spanScale,
      );
      desiredTarget.current.set(
        layout.waitingZone.centerX,
        0.6,
        layout.waitingZone.centerZ - 0.8,
      );
    } else if (cameraPreset === "completed") {
      desiredPos.current.set(
        layout.completedZone.centerX + 6,
        13 * spanScale,
        layout.completedZone.centerZ + 14.5 * spanScale,
      );
      desiredTarget.current.set(
        layout.completedZone.centerX,
        0.6,
        layout.completedZone.centerZ - 0.8,
      );
    } else if (cameraPreset === "top") {
      desiredPos.current.set(0, 37 * spanScale, centerZ + 4.5);
      desiredTarget.current.set(0, 0, centerZ);
    } else {
      // Hero 3/4 architectural diorama angle (highlights depth & truck size differences)
      desiredPos.current.set(
        -11 * spanScale,
        19.5 * spanScale,
        centerZ + 27 * spanScale,
      );
      desiredTarget.current.set(0, 0.6, centerZ - 1.0);
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

  // Smoothly focus on clicked truck from a handsome 3/4 angle
  useEffect(() => {
    if (!selectedPlacement) return;
    const [tx, , tz] = selectedPlacement.position;
    desiredTarget.current.set(tx, 1.0, tz);
    desiredPos.current.set(tx + (tx < 0 ? -7.5 : 7.5), 8.2, tz + 10.5);
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

  const shadowBakeKey = layout.placements
    .map((p) => `${p.vehicle._id}:${p.slotIndex}:${p.zone}`)
    .join("|");

  return (
    <WebGLErrorBoundary>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.04,
        }}
        camera={{ position: [-11, 20, 30], fov: 36, near: 0.5, far: 250 }}
        onPointerMissed={() => onSelectPlacement(null)}
        className="w-full h-full"
      >
        <color attach="background" args={["#d8e3ef"]} />
        <fog attach="fog" args={["#d8e3ef", 58, 145]} />

        {/* Studio Softbox Environment (100% offline procedural Lightformers for realistic glass & paint sheen) */}
        <Environment resolution={256} frames={1}>
          <Lightformer
            form="rect"
            intensity={1.7}
            color="#fffdf8"
            position={[0, 18, 8]}
            rotation={[Math.PI / 2.2, 0, 0]}
            scale={[34, 16, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.0}
            color="#dbeafe"
            position={[-22, 10, 6]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[24, 10, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.15}
            color="#f8fafc"
            position={[22, 12, -10]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[24, 10, 1]}
          />
        </Environment>

        {/* Balanced Architectural Daylight Rig */}
        <hemisphereLight args={["#f5f9ff", "#94a3b8", 0.65]} />
        <directionalLight
          position={[22, 34, 20]}
          intensity={1.32}
          color="#fff9ef"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-radius={3.5}
          shadow-camera-left={-36}
          shadow-camera-right={36}
          shadow-camera-top={36}
          shadow-camera-bottom={-36}
          shadow-camera-near={4}
          shadow-camera-far={95}
          shadow-bias={-0.00035}
        />
        <directionalLight
          position={[-20, 14, -16]}
          intensity={0.38}
          color="#dbeafe"
        />

        {/* Soft Ambient-Occlusion Grounding Shadows under tires & trucks (baked once per layout change) */}
        <ContactShadows
          key={shadowBakeKey}
          position={[0, 0.064, layout.waitingZone.centerZ - 1]}
          opacity={0.44}
          scale={Math.max(54, layout.groundWidth + 6)}
          blur={1.85}
          far={10}
          resolution={512}
          frames={2}
          color="#0f172a"
        />

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
