import { useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { usePhysicsStore } from '../../../store/physicsStore';
import { GridSystem } from '../../../lib/GridSystem';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

const GLOW_RADIUS = 0.04;
const GLOW_COLOR  = '#22d3ee'; // Cyan glow

function PathSegment({ points }: { points: THREE.Vector3[] }) {
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);

    useFrame((state) => {
        if (materialRef.current) {
            // Pulsate the glow intensity
            const pulse = Math.sin(state.clock.elapsedTime * 6) * 0.4 + 0.6;
            materialRef.current.emissiveIntensity = pulse * 2.5;
        }
    });

    const geometry = useMemo(() => {
        if (points.length < 2) return null;
        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
        return new THREE.TubeGeometry(curve, points.length * 8, GLOW_RADIUS, 8, false);
    }, [points]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial
                ref={materialRef}
                color={GLOW_COLOR}
                emissive={GLOW_COLOR}
                emissiveIntensity={2}
                transparent
                opacity={0.4}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </mesh>
    );
}

export function CurrentTracer() {
    const currentPaths = usePhysicsStore(state => state.currentPaths);

    const memoizedPaths = useMemo(() => {
        return currentPaths.map(cp => {
            return cp.path.map(holeId => GridSystem.getHolePos(holeId));
        });
    }, [currentPaths]);

    return (
        <group>
            {memoizedPaths.map((pathPts, idx) => (
                <PathSegment key={idx} points={pathPts} />
            ))}
        </group>
    );
}
