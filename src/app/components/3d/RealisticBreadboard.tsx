import { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three/webgpu';
import type { } from '@react-three/fiber';

const PITCH = 0.254;
const COLS = 60;

// ── Row Z positions (exact values used everywhere) ──────────────────────────
// Rows A-E: top half.  Rows F-J: bottom half.  Trench between E and F.
export const ROW_Z: Record<string, number> = {
    A: -PITCH * 4.5,
    B: -PITCH * 3.5,
    C: -PITCH * 2.5,
    D: -PITCH * 1.5,
    E: -PITCH * 0.5,
    // ── Trench gap here ──
    F: PITCH * 1.5,   // gap includes trench physical spacing
    G: PITCH * 2.5,
    H: PITCH * 3.5,
    I: PITCH * 4.5,
    J: PITCH * 5.5,
};

// Trench visual center (midpoint between E and F)
export const TRENCH_Z_MID = (ROW_Z.E + ROW_Z.F) / 2; // = PITCH * 0.5

// ── Power rail Z positions ───────────────────────────────────────────────────
const RAIL_VCC_TOP_Z = -PITCH * 8;
const RAIL_GND_TOP_Z = -PITCH * 7;
const RAIL_VCC_BOT_Z = PITCH * 7.5;
const RAIL_GND_BOT_Z = PITCH * 8.5;

export function RealisticBreadboard() {
    const boardW = COLS * PITCH + 0.5;
    const boardZ = 19 * PITCH + 0.5;

    // ── Compute all hole positions ─────────────────────────────────────────
    const { signalPositions, vccPositions, gndPositions } = useMemo(() => {
        const signal: THREE.Vector3[] = [];
        const vcc: THREE.Vector3[] = [];
        const gnd: THREE.Vector3[] = [];

        // Signal holes A-J (all 10 rows × 60 cols = 600 holes)
        for (const [, rowZ] of Object.entries(ROW_Z)) {
            for (let c = 0; c < COLS; c++) {
                const x = (c - COLS / 2) * PITCH;
                signal.push(new THREE.Vector3(x, 0.055, rowZ));
            }
        }

        // Power rail holes — 60 per rail × 4 rails = 240
        for (let c = 0; c < COLS; c++) {
            const x = (c - COLS / 2) * PITCH;
            vcc.push(new THREE.Vector3(x, 0.055, RAIL_VCC_TOP_Z));
            vcc.push(new THREE.Vector3(x, 0.055, RAIL_VCC_BOT_Z));
            gnd.push(new THREE.Vector3(x, 0.055, RAIL_GND_TOP_Z));
            gnd.push(new THREE.Vector3(x, 0.055, RAIL_GND_BOT_Z));
        }

        return { signalPositions: signal, vccPositions: vcc, gndPositions: gnd };
    }, []);

    // ── Geometries and materials ──────────────────────────────────────────
    const holeGeo = useMemo(() => new THREE.BoxGeometry(PITCH * 0.52, 0.06, PITCH * 0.52), []);
    const clipGeo = useMemo(() => new THREE.BoxGeometry(PITCH * 0.35, PITCH * 0.35, PITCH * 0.35), []);
    const holeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#010a18' }), []);
    const clipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8daabf', metalness: 0.85, roughness: 0.2 }), []);
    const railHoleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#010a18' }), []);

    // ── Instanced mesh refs ──────────────────────────────────────────────
    const sigHoleRef = useRef<THREE.InstancedMesh>(null);
    const sigClipRef = useRef<THREE.InstancedMesh>(null);
    const vccRef = useRef<THREE.InstancedMesh>(null);
    const gndRef = useRef<THREE.InstancedMesh>(null);

    useEffect(() => {
        const dummy = new THREE.Object3D();

        if (sigHoleRef.current) {
            signalPositions.forEach((p, i) => {
                dummy.position.set(p.x, p.y, p.z);
                dummy.updateMatrix();
                sigHoleRef.current!.setMatrixAt(i, dummy.matrix);
            });
            sigHoleRef.current.instanceMatrix.needsUpdate = true;
        }
        if (sigClipRef.current) {
            signalPositions.forEach((p, i) => {
                dummy.position.set(p.x, p.y - 0.025, p.z);
                dummy.updateMatrix();
                sigClipRef.current!.setMatrixAt(i, dummy.matrix);
            });
            sigClipRef.current.instanceMatrix.needsUpdate = true;
        }
        if (vccRef.current) {
            vccPositions.forEach((p, i) => {
                dummy.position.set(p.x, p.y, p.z);
                dummy.updateMatrix();
                vccRef.current!.setMatrixAt(i, dummy.matrix);
            });
            vccRef.current.instanceMatrix.needsUpdate = true;
        }
        if (gndRef.current) {
            gndPositions.forEach((p, i) => {
                dummy.position.set(p.x, p.y, p.z);
                dummy.updateMatrix();
                gndRef.current!.setMatrixAt(i, dummy.matrix);
            });
            gndRef.current.instanceMatrix.needsUpdate = true;
        }
    }, [signalPositions, vccPositions, gndPositions]);

    const [scanPos, setScanPos] = useState(-10);

    // Entrance Animation: One-time scan across the board
    useEffect(() => {
        let frame: number;
        let start = Date.now();
        const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(1, elapsed / 2000); // 2 second scan
            setScanPos(-boardW / 2 + progress * boardW);
            if (progress < 1) frame = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(frame);
    }, [boardW]);

    return (
        <group>
            {/* ── Base Ring (Anchored indicator) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.19, 0]}>
                <ringGeometry args={[boardZ / 2 + 0.1, boardZ / 2 + 0.12, 64]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} />
            </mesh>

            {/* ── Digitizing Scan-Line */}
            <mesh position={[scanPos, 0.05, 0]}>
               <boxGeometry args={[0.05, 0.3, boardZ + 0.2]} />
               <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
            </mesh>

            {/* ── Board body */}
            <mesh position={[0, -0.1, 0]}>
                <boxGeometry args={[boardW, 0.2, boardZ]} />
                <meshStandardMaterial color="#0f172a" roughness={0.7} />
            </mesh>

            {/* ── Center trench (visible dark ravine, slightly recessed) */}
            <mesh position={[0, 0.01, TRENCH_Z_MID]}>
                <boxGeometry args={[boardW - 0.1, 0.05, PITCH * 1.0]} />
                <meshStandardMaterial color="#020617" roughness={0.95} />
            </mesh>

            {/* ════════════ POWER RAILS — Always visible ════════════ */}
            {/* Top VCC rail (RED) — bright permanent stripe */}
            <mesh position={[0, 0.014, RAIL_VCC_TOP_Z - PITCH * 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[boardW - 0.1, PITCH * 0.28]} />
                <meshBasicMaterial color="#ef4444" />
            </mesh>
            {/* Top GND rail (BLUE) */}
            <mesh position={[0, 0.014, RAIL_GND_TOP_Z + PITCH * 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[boardW - 0.1, PITCH * 0.28]} />
                <meshBasicMaterial color="#3b82f6" />
            </mesh>
            {/* Bottom VCC rail (RED) */}
            <mesh position={[0, 0.014, RAIL_VCC_BOT_Z - PITCH * 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[boardW - 0.1, PITCH * 0.28]} />
                <meshBasicMaterial color="#ef4444" />
            </mesh>
            {/* Bottom GND rail (BLUE) */}
            <mesh position={[0, 0.014, RAIL_GND_BOT_Z + PITCH * 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[boardW - 0.1, PITCH * 0.28]} />
                <meshBasicMaterial color="#3b82f6" />
            </mesh>

            {/* ── Rail GLOW strips (emissive, always on) */}
            {[RAIL_VCC_TOP_Z, RAIL_VCC_BOT_Z].map((rz, i) => (
                <mesh key={`vcc${i}`} position={[0, 0.02, rz]}>
                    <boxGeometry args={[boardW - 0.1, 0.002, PITCH * 0.12]} />
                    <meshBasicMaterial color="#fca5a5" />
                </mesh>
            ))}
            {[RAIL_GND_TOP_Z, RAIL_GND_BOT_Z].map((rz, i) => (
                <mesh key={`gnd${i}`} position={[0, 0.02, rz]}>
                    <boxGeometry args={[boardW - 0.1, 0.002, PITCH * 0.12]} />
                    <meshBasicMaterial color="#93c5fd" />
                </mesh>
            ))}

            {/* ── Rail split gap markers (Law 4: rails break at col 30/31) */}
            {[RAIL_VCC_TOP_Z, RAIL_GND_TOP_Z, RAIL_VCC_BOT_Z, RAIL_GND_BOT_Z].map((rz, i) => (
                <mesh key={`split${i}`} position={[0, 0.025, rz]}>
                    <boxGeometry args={[0.02, 0.015, PITCH * 0.6]} />
                    <meshBasicMaterial color="#fbbf24" />
                </mesh>
            ))}

            {/* ── Rail + / − labels as colored point lights */}
            <pointLight color="#ef4444" intensity={1.5} distance={2}
                position={[-(boardW / 2 - 0.06), 0.15, RAIL_VCC_TOP_Z]} />
            <pointLight color="#3b82f6" intensity={1.5} distance={2}
                position={[-(boardW / 2 - 0.06), 0.15, RAIL_GND_TOP_Z]} />
            <pointLight color="#ef4444" intensity={1.5} distance={2}
                position={[boardW / 2 - 0.06, 0.15, RAIL_VCC_BOT_Z]} />
            <pointLight color="#3b82f6" intensity={1.5} distance={2}
                position={[boardW / 2 - 0.06, 0.15, RAIL_GND_BOT_Z]} />

            {/* ── Signal holes (600 total = 10 rows × 60 cols) */}
            <instancedMesh ref={sigHoleRef} args={[holeGeo, holeMat, signalPositions.length]} />
            <instancedMesh ref={sigClipRef} args={[clipGeo, clipMat, signalPositions.length]} />
            {/* ── Power rail holes */}
            <instancedMesh ref={vccRef} args={[holeGeo, railHoleMat, vccPositions.length]} />
            <instancedMesh ref={gndRef} args={[holeGeo, railHoleMat, gndPositions.length]} />
        </group>
    );
}
