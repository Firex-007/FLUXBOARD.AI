import React, { useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { usePhysicsStore } from '../../../store/physicsStore';
import { COMPONENT_LIBRARY } from '../../../lib/ComponentLibrary';
import { Text } from '@react-three/drei';
import { GridSystem, PITCH, BOARD_SURFACE_Y } from '../../../lib/GridSystem';

/**
 * ComponentsOnBoard — Grid-Locked 3D Component Rendering
 *
 * Every component is built from its actual pin HoleIDs.
 * We call GridSystem.getHolePos(holeId) → exact Vector3, then construct
 * the body to bridge those pin points.  No guessing. No floating.
 */

// ─── Shared pin leg material ──────────────────────────────────────────────────
const PIN_COLOR = '#9daab5';
const METAL_PROPS = { metalness: 1.0, roughness: 0.2, clearcoat: 1.0 } as const;

// ─── LED ──────────────────────────────────────────────────────────────────────
function LEDBody({
    pins,
    ledColor = '#ef4444',
    isActive = false,
}: {
    pins: Record<string, string>;
    ledColor?: string;
    isActive?: boolean;
}) {
    const anodeId   = pins.ANODE   ?? pins.P1;
    const cathodeId = pins.CATHODE ?? pins.P2;

    if (!anodeId || !cathodeId) return null;

    const anode   = GridSystem.getHolePos(anodeId);
    const cathode = GridSystem.getHolePos(cathodeId);
    const center  = anode.clone().lerp(cathode, 0.5);

    const BODY_R  = 0.09;
    const BODY_H  = 0.14;
    const DOME_R  = 0.10;
    const PIN_R   = 0.011;
    const PIN_H   = 0.28; // part that goes into hole
    const LEAD_H  = 0.15; // exposed lead above board

    const bodyBase = BOARD_SURFACE_Y + LEAD_H + BODY_H / 2;

    return (
        <group position={[center.x, 0, center.z]}>
            {/* Body cylinder */}
            <mesh position={[0, bodyBase, 0]}>
                <cylinderGeometry args={[BODY_R, BODY_R, BODY_H, 24]} />
                <meshPhysicalMaterial color={ledColor} transparent opacity={0.75} roughness={0.1} />
            </mesh>

            {/* Dome */}
            <mesh position={[0, bodyBase + BODY_H / 2 + DOME_R * 0.72, 0]}>
                <sphereGeometry args={[DOME_R, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
                <meshPhysicalMaterial
                    color={ledColor}
                    transparent
                    opacity={0.55}
                    emissive={ledColor}
                    emissiveIntensity={isActive ? 8 : 0.05}
                />
            </mesh>

            {isActive && (
                <pointLight
                    color={ledColor}
                    intensity={5}
                    distance={3}
                    position={[0, bodyBase + BODY_H + DOME_R, 0]}
                />
            )}

            {/* Anode lead — from board surface up to body */}
            <mesh position={[anode.x - center.x, BOARD_SURFACE_Y + LEAD_H / 2, anode.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, LEAD_H, 8]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>
            {/* Anode pin — goes down into hole */}
            <mesh position={[anode.x - center.x, BOARD_SURFACE_Y - PIN_H / 2, anode.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, PIN_H, 8]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>

            {/* Cathode lead */}
            <mesh position={[cathode.x - center.x, BOARD_SURFACE_Y + LEAD_H / 2, cathode.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, LEAD_H, 8]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>
            {/* Cathode pin */}
            <mesh position={[cathode.x - center.x, BOARD_SURFACE_Y - PIN_H / 2, cathode.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, PIN_H, 8]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>
        </group>
    );
}

// ─── RESISTOR ─────────────────────────────────────────────────────────────────
function ResistorBody({ pins }: { pins: Record<string, string> }) {
    const p1Id = pins.P1 ?? pins.A ?? pins.ANODE;
    const p2Id = pins.P2 ?? pins.B ?? pins.CATHODE;
    if (!p1Id || !p2Id) return null;

    const p1 = GridSystem.getHolePos(p1Id);
    const p2 = GridSystem.getHolePos(p2Id);

    const center = p1.clone().lerp(p2, 0.5);
    const dist   = p1.distanceTo(new THREE.Vector3(p2.x, p1.y, p1.z));

    const BODY_R = 0.055;
    const BODY_H = Math.max(dist * 0.45, 0.18); // body is ~45% of pin span
    const PIN_R  = 0.011;
    const RISE_Y = BOARD_SURFACE_Y + 0.15; // body center height above surface
    const BANDS  = ['#5a4000', '#f0f000', '#cc2222', '#ffd700'];

    return (
        <group position={[center.x, 0, center.z]}>
            {/* Body */}
            <mesh position={[0, RISE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[BODY_R, BODY_R, BODY_H, 20]} />
                <meshStandardMaterial color="#c8a265" roughness={0.65} />
            </mesh>

            {/* Color bands */}
            {BANDS.map((c, i) => (
                <mesh
                    key={i}
                    position={[BODY_H * (-0.38 + i * 0.25), RISE_Y, 0]}
                    rotation={[0, 0, Math.PI / 2]}
                >
                    <cylinderGeometry args={[BODY_R + 0.004, BODY_R + 0.004, 0.018, 20]} />
                    <meshStandardMaterial color={c} />
                </mesh>
            ))}

            {/* Legs */}
            {([p1, p2] as THREE.Vector3[]).map((pinPos, i) => {
                const localX = pinPos.x - center.x;
                const localZ = pinPos.z - center.z;
                const bodyEndX = i === 0 ? -BODY_H / 2 : BODY_H / 2;
                const dropH = RISE_Y - BOARD_SURFACE_Y;
                const pinH = 0.22;

                return (
                    <group key={i}>
                        {/* Horizontal lead to node plane */}
                        <mesh
                            position={[(bodyEndX + localX) / 2, RISE_Y, localZ / 2]}
                            rotation={[0, Math.atan2(localZ, localX - bodyEndX), Math.PI / 2]}
                        >
                            <cylinderGeometry
                                args={[PIN_R, PIN_R, new THREE.Vector2(localX - bodyEndX, localZ).length(), 8]}
                            />
                            <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                        </mesh>

                        {/* Vertical drop down from horizontal wire height */}
                        <mesh position={[localX, RISE_Y - dropH / 2, localZ]}>
                            <cylinderGeometry args={[PIN_R, PIN_R, dropH, 8]} />
                            <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                        </mesh>

                        {/* Pin into hole */}
                        <mesh position={[localX, BOARD_SURFACE_Y - pinH / 2, localZ]}>
                            <cylinderGeometry args={[PIN_R, PIN_R, pinH, 8]} />
                            <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

// ─── CAPACITOR ────────────────────────────────────────────────────────────────
function CapacitorBody({ pins }: { pins: Record<string, string> }) {
    const posId = pins.POSITIVE ?? pins.P1;
    const negId = pins.NEGATIVE ?? pins.P2;
    if (!posId || !negId) return null;

    const pos    = GridSystem.getHolePos(posId);
    const neg    = GridSystem.getHolePos(negId);
    const center = pos.clone().lerp(neg, 0.5);

    const CAN_R = 0.11;
    const CAN_H = 0.28;
    const PIN_R = 0.011;
    const PIN_H = 0.28;
    const LEAD_H = 0.1;
    const BASE_Y = BOARD_SURFACE_Y + LEAD_H;
    const TOP_Y = BASE_Y + CAN_H + 0.02;

    return (
        <group position={[center.x, 0, center.z]}>
            {/* Cylindrical can */}
            <mesh position={[0, BASE_Y + CAN_H / 2, 0]}>
                <cylinderGeometry args={[CAN_R, CAN_R, CAN_H, 24]} />
                <meshStandardMaterial color="#b0b8c8" metalness={0.7} roughness={0.25} />
            </mesh>

            {/* Top disc */}
            <mesh position={[0, TOP_Y, 0]}>
                <cylinderGeometry args={[CAN_R, CAN_R, 0.018, 24]} />
                <meshStandardMaterial color="#8090a0" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Stripe marking negative side */}
            <mesh position={[neg.x - center.x > 0 ? CAN_R * 0.5 : -CAN_R * 0.5, BASE_Y + CAN_H / 2, 0]}>
                <boxGeometry args={[CAN_R * 0.5, CAN_H + 0.002, CAN_R * 0.4]} />
                <meshStandardMaterial color="#334155" />
            </mesh>
            
            {/* Leads above surface */}
            <mesh position={[pos.x - center.x, BOARD_SURFACE_Y + LEAD_H / 2, pos.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, LEAD_H, 8]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>
            <mesh position={[neg.x - center.x, BOARD_SURFACE_Y + LEAD_H / 2, neg.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, LEAD_H, 8]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>

            {/* Positive pin in hole */}
            <mesh position={[pos.x - center.x, BOARD_SURFACE_Y - PIN_H / 2, pos.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, PIN_H, 6]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>

            {/* Negative pin in hole */}
            <mesh position={[neg.x - center.x, BOARD_SURFACE_Y - PIN_H * 0.8 / 2, neg.z - center.z]}>
                <cylinderGeometry args={[PIN_R, PIN_R, PIN_H * 0.8, 6]} />
                <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
            </mesh>
        </group>
    );
}

// ─── DIP8 IC ─────────────────────────────────────────────────────────────────
function DIPICBody({ pins, pinCount = 8 }: { pins: Record<string, string>; pinCount?: number }) {
    const pinEntries = Object.entries(pins);
    if (pinEntries.length === 0) return null;

    const pinPositions = pinEntries.map(([key, holeId]) => ({
        key,
        holeId,
        pos: GridSystem.getHolePos(holeId),
    }));

    const xs = pinPositions.map(p => p.pos.x);
    const zs = pinPositions.map(p => p.pos.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const BODY_W = (maxX - minX) + PITCH * 0.8;
    const BODY_D = (maxZ - minZ) + PITCH * 0.2; // Body doesn't cover actual holes
    const BODY_H = 0.15;
    const BODY_Y = BOARD_SURFACE_Y + 0.12;
    const PIN_R  = 0.012;
    const PIN_H  = 0.22;
    
    const SHOULDER_W = (BODY_D + PITCH * 0.6 - BODY_D) / 2;

    return (
        <group position={[centerX, 0, centerZ]}>
            {/* IC body */}
            <mesh position={[0, BODY_Y + BODY_H / 2, 0]}>
                <boxGeometry args={[BODY_W, BODY_H, BODY_D]} />
                <meshPhysicalMaterial color="#0a0a14" roughness={0.12} metalness={0.25} />
            </mesh>

            {/* Notch */}
            <mesh position={[-(BODY_W / 2), BODY_Y + BODY_H, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.005, 16]} />
                <meshStandardMaterial color="#334155" />
            </mesh>

            {/* Label */}
            <Text
                position={[0, BODY_Y + BODY_H + 0.005, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.06}
                color="#94a3b8"
            >
                IC
            </Text>

            {/* Pins */}
            {pinPositions.map(({ key, pos }) => {
                const isBottomRow = pos.z > centerZ;
                const shoulderZOff = isBottomRow ? -(SHOULDER_W/2) : (SHOULDER_W/2);
                
                return (
                <group key={key} position={[pos.x - centerX, 0, pos.z - centerZ]}>
                    {/* Shoulder out from body */}
                    <mesh position={[0, BODY_Y + 0.04, shoulderZOff]}>
                        <boxGeometry args={[0.02, 0.01, SHOULDER_W]} />
                        <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                    </mesh>
                    {/* Drop vertically to board */}
                    <mesh position={[0, (BODY_Y + 0.04 + BOARD_SURFACE_Y) / 2, 0]}>
                        <cylinderGeometry args={[PIN_R, PIN_R, (BODY_Y + 0.04 - BOARD_SURFACE_Y), 8]} />
                        <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                    </mesh>
                    {/* Enter hole */}
                    <mesh position={[0, BOARD_SURFACE_Y - PIN_H / 2, 0]}>
                        <cylinderGeometry args={[PIN_R, PIN_R, PIN_H, 8]} />
                        <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                    </mesh>
                </group>
                );
            })}
        </group>
    );
}

// ─── TRANSISTOR ───────────────────────────────────────────────────────────────
function TransistorBody({ pins }: { pins: Record<string, string> }) {
    const baseId  = pins.BASE ?? pins.P1;
    const collId  = pins.COLLECTOR ?? pins.P2;
    const emitId  = pins.EMITTER ?? pins.P3;

    const positions = [baseId, collId, emitId]
        .filter(Boolean)
        .map(id => GridSystem.getHolePos(id!));

    if (positions.length < 2) return null;

    const xs = positions.map(p => p.x);
    const center = new THREE.Vector3(
        (Math.min(...xs) + Math.max(...xs)) / 2,
        0,
        positions[0].z,
    );

    const BODY_R = 0.11, BODY_H = 0.22, PIN_R = 0.011, PIN_H = 0.26, LEAD_H = 0.12;
    const BODY_Y = BOARD_SURFACE_Y + LEAD_H;

    return (
        <group position={[center.x, 0, center.z]}>
            {/* TO-92 body */}
            <mesh position={[0, BODY_Y + BODY_H / 2, 0]}>
                <cylinderGeometry args={[BODY_R, BODY_R, BODY_H, 24]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>

            {positions.map((pos, i) => (
                <group key={i} position={[pos.x - center.x, 0, pos.z - center.z]}>
                    <mesh position={[0, BOARD_SURFACE_Y + LEAD_H / 2, 0]}>
                        <cylinderGeometry args={[PIN_R, PIN_R, LEAD_H, 8]} />
                        <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                    </mesh>
                    <mesh position={[0, BOARD_SURFACE_Y - PIN_H / 2, 0]}>
                        <cylinderGeometry args={[PIN_R, PIN_R, PIN_H, 6]} />
                        <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// ─── Generic fallback ─────────────────────────────────────────────────────────
function GenericBody({ pins }: { pins: Record<string, string> }) {
    const PIN_R = 0.011, PIN_H = 0.22;
    const positions = Object.entries(pins).map(([key, holeId]) => ({
        key,
        pos: GridSystem.getHolePos(holeId),
    }));
    return (
        <group>
            {positions.map(({ key, pos }) => (
                <mesh key={key} position={[pos.x, BOARD_SURFACE_Y - PIN_H / 2, pos.z]}>
                    <cylinderGeometry args={[PIN_R, PIN_R, PIN_H, 6]} />
                    <meshStandardMaterial color={PIN_COLOR} {...METAL_PROPS} />
                </mesh>
            ))}
        </group>
    );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
function ComponentBody({ component }: { component: any }) {
    const isActive = usePhysicsStore(
        (state: any) => state.activeComponents?.has(component.id) ?? false
    );

    const { type, pins } = component;

    switch (type) {
        case 'LED':
            return <LEDBody pins={pins} isActive={isActive} />;
        case 'RESISTOR':
            return <ResistorBody pins={pins} />;
        case 'CAPACITOR':
            return <CapacitorBody pins={pins} />;
        case 'DIP8_IC':
            return <DIPICBody pins={pins} pinCount={8} />;
        case 'TRANSISTOR':
            return <TransistorBody pins={pins} />;
        default:
            return <GenericBody pins={pins} />;
    }
}

// ─── Root export ──────────────────────────────────────────────────────────────
export function ComponentsOnBoard() {
    const components = usePhysicsStore((state: any) => state.components);
    if (!components || components.length === 0) return null;
    return (
        <group>
            {components.map((c: any) => (
                <ComponentBody key={c.id} component={c} />
            ))}
        </group>
    );
}
