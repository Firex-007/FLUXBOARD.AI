/**
 * WiringVisuals.tsx
 *
 * Renders every wire using the pre-computed A* route stored in physicsStore.routedWires.
 * Each wire is a CatmullRomCurve3 through the elevated 3D waypoints, rendered as a
 * TubeGeometry — mimicking a real 22 AWG jumper wire with rounded bends.
 *
 * No routing math happens here; this component is a pure "consumer".
 * All routing logic lives in AStarRouter.ts and is run inside rebuildGraph().
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { usePhysicsStore, WireInstance } from '../../../store/physicsStore';

const TUBE_RADIUS   = 0.013;
const TUBE_SEGMENTS = 20;
const PATH_SAMPLES  = 50;

/** Resolve wire color: VCC/GND get canonical colors regardless of JSON value. */
function resolveColor(wire: WireInstance): string {
    if (wire.source.includes('VCC') || wire.dest.includes('VCC')) return '#ef4444';
    if (wire.source.includes('GND') || wire.dest.includes('GND')) return '#3b82f6';
    return wire.color || '#10b981';
}

interface WireProps {
    wire: WireInstance;
    path: THREE.Vector3[];
}

function Wire({ wire, path }: WireProps) {
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);
    const uniformsData = useRef({ time: { value: 0 } });

    useFrame((state) => {
        uniformsData.current.time.value = state.clock.elapsedTime;
    });

    const { geo, mat } = useMemo(() => {
        if (!path || path.length < 2) return { geo: null, mat: null };

        const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.0);
        const points = curve.getPoints(PATH_SAMPLES);
        
        const unique: THREE.Vector3[] = [points[0]];
        for (let i = 1; i < points.length; i++) {
            if (points[i].distanceTo(unique[unique.length - 1]) > 0.001) {
                unique.push(points[i]);
            }
        }
        if (unique.length < 2) return { geo: null, mat: null };

        const finalCurve = new THREE.CatmullRomCurve3(unique, false, 'catmullrom', 0.0);
        const geometry = new THREE.TubeGeometry(finalCurve, unique.length * 2, TUBE_RADIUS, TUBE_SEGMENTS, false);
        
        const color = resolveColor(wire);
        
        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.30,
            metalness: 0.05,
            emissive: color,
            emissiveIntensity: 0.15,
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = uniformsData.current.time;
            
            // Inject uv and time vars
            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <emissivemap_fragment>`,
                `#include <emissivemap_fragment>
                 
                 // Pulse logic based on UV (vUv.x runs along the tube)
                 float pulse = sin(vUv.x * 20.0 - uTime * 10.0) * 0.5 + 0.5;
                 
                 // Boost emissive to simulate current flowing
                 totalEmissiveRadiance *= 1.0 + (pulse * 3.0);
                 
                 // Optionally add a white core
                 if (pulse > 0.9) {
                     diffuseColor.rgb += vec3(0.5);
                 }
                `
            );
        };
        
        return { geo: geometry, mat: material };
    }, [path, wire]);

    if (!geo || !mat) return null;

    return <mesh geometry={geo} material={mat} ref={(el) => { if(el) el.material = mat }} />;
}

export function WiringVisuals() {
    const wires       = usePhysicsStore(state => state.wires);
    const routedWires = usePhysicsStore(state => state.routedWires);

    return (
        <group>
            {wires.map((wire: WireInstance) => {
                const path = routedWires[wire.id];
                if (!path || path.length < 2) return null;
                return (
                    <Wire
                        key={wire.id}
                        wire={wire}
                        path={path}
                    />
                );
            })}
        </group>
    );
}
