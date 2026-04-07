import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, RoundedBox, Cylinder, Torus, Sphere } from '@react-three/drei';
import * as THREE from 'three/webgpu';

export function AICore() {
  const coreRef = useRef<THREE.Group>(null);
  const chipRef = useRef<THREE.Mesh>(null);
  const { mouse } = useThree();

  // Create some orbiting component data
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      orbitRadius: 3 + Math.random() * 2,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
      size: 0.1 + Math.random() * 0.2,
      id: i
    }));
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    if (coreRef.current) {
        // Subtle mouse parallax
        coreRef.current.rotation.x = THREE.MathUtils.lerp(coreRef.current.rotation.x, mouse.y * 0.3, 0.1);
        coreRef.current.rotation.y = THREE.MathUtils.lerp(coreRef.current.rotation.y, mouse.x * 0.3, 0.1);
    }

    if (chipRef.current) {
        chipRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <Float floatIntensity={1.5} speed={1.5} rotationIntensity={0.3}>
      <group ref={coreRef}>
        {/* The "Main Microchip" Core */}
        <RoundedBox ref={chipRef} args={[2.2, 2.2, 0.4]} radius={0.06} smoothness={4}>
          <meshStandardMaterial 
            color="#0f172a" 
            metalness={0.9} 
            roughness={0.1} 
            emissive="#22d3ee"
            emissiveIntensity={0.2}
          />
        </RoundedBox>

        {/* Silicon Wafers / Circuit Detail Lines */}
        <group position={[0, 0, 0.21]}>
            <mesh>
                <planeGeometry args={[1.8, 1.8]} />
                <meshStandardMaterial 
                    color="#22d3ee" 
                    emissive="#22d3ee" 
                    emissiveIntensity={1.5} 
                    wireframe 
                    transparent 
                    opacity={0.4}
                />
            </mesh>
        </group>

        {/* Sentient Circuit Sphere in the center */}
        <Sphere args={[0.5, 32, 32]}>
          <MeshDistortMaterial
            color="#ffffff"
            emissive="#22d3ee"
            emissiveIntensity={4}
            distort={0.4}
            speed={4}
            roughness={0}
          />
        </Sphere>

        {/* Orbiting "Data Packets" / Electronic Bits */}
        {particles.map((p) => (
            <OrbitingBit key={p.id} data={p} />
        ))}

        {/* The Outer Containment Ring */}
        <Torus args={[3.2, 0.02, 16, 100]} rotation={[Math.PI / 2.5, 0, 0]}>
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} transparent opacity={0.3} />
        </Torus>
      </group>
    </Float>
  );
}

function OrbitingBit({ data }: { data: any }) {
    const ref = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        const t = state.clock.elapsedTime * data.speed + data.offset;
        if (ref.current) {
            ref.current.position.x = Math.cos(t) * data.orbitRadius;
            ref.current.position.z = Math.sin(t) * data.orbitRadius;
            ref.current.position.y = Math.sin(t * 0.5) * 1.5;
            ref.current.rotation.y = t * 2;
        }
    });

    return (
        <mesh ref={ref}>
            <boxGeometry args={[data.size, data.size, data.size]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={5} />
        </mesh>
    );
}

