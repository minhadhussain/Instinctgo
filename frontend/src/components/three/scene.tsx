"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

export default function Scene() {
  return (
    <div className="h-80 w-full" role="img" aria-label="Interactive 3D workflow placeholder">
      <Canvas camera={{ position: [3, 2, 4], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 3]} intensity={2} />
        <mesh rotation={[0.4, 0.4, 0]}>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color="#9cb2d4" roughness={0.3} metalness={0.3} />
        </mesh>
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
}
