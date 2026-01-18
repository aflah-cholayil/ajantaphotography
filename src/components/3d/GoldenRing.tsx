import { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

const Ring = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef}>
        <torusGeometry args={[1.5, 0.15, 32, 100]} />
        <MeshDistortMaterial
          color="#c9a54e"
          roughness={0.2}
          metalness={0.9}
          distort={0.1}
          speed={2}
        />
      </mesh>
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[1.2, 0.1, 32, 100]} />
        <MeshDistortMaterial
          color="#d4af65"
          roughness={0.3}
          metalness={0.8}
          distort={0.05}
          speed={3}
        />
      </mesh>
    </Float>
  );
};

interface GoldenRingProps {
  className?: string;
}

export const GoldenRing = ({ className = '' }: GoldenRingProps) => {
  return (
    <div className={`w-full h-full ${className}`}>
      <Suspense fallback={null}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#d4af65" />
          <Ring />
        </Canvas>
      </Suspense>
    </div>
  );
};
