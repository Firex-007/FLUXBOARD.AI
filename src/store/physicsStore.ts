import { create } from 'zustand';
import * as THREE from 'three/webgpu';
import { PhysicsEngine } from '../lib/PhysicsEngine';
import { GridSystem } from '../lib/GridSystem';
import { buildObstacleMap, routeWire } from '../lib/AStarRouter';

export type HoleId = string; // e.g., 'A1', 'J60', 'VCC1_15', 'GND2_45'
export type NetId = number;

export interface ComponentInstance {
    id: string;
    type: string;
    pins: Record<string, HoleId>; // e.g., { 'yin': 'A1', 'yang': 'A3' }
    rotation: number;
    isSeated?: boolean; // Contact resistance logical break
}

export interface WireInstance {
    id: string;
    source: HoleId;
    dest: HoleId;
    color: string;
}

interface PhysicsState {
    components: ComponentInstance[];
    wires: WireInstance[];

    // The DSU disjoint set array for the nodes
    parent: Record<HoleId, HoleId>;

    // Evaluated Physical/Electrical State
    shortCircuit: boolean;
    activeComponents: Set<string>;
    errors: string[];
    safetyReport: any; // Result from GridSystem.getSafetyReport

    // Pre-computed A* routed wire paths (rebuilt each rebuildGraph call)
    routedWires: Record<string, THREE.Vector3[]>;

    // BFS Visual Tracing (glow the path of current)
    currentPaths: { source: HoleId, dest: HoleId, path: HoleId[] }[];

    // Actions
    addComponent: (comp: ComponentInstance) => void;
    removeComponent: (id: string) => void;
    addWire: (wire: WireInstance) => void;
    removeWire: (id: string) => void;
    confirmPlacement: (id: string) => void;

    // Get the NetId for a topological hole
    getNetId: (hole: HoleId) => NetId;

    // Rebuild the DSU graph based on current wires and board physics
    rebuildGraph: () => void;
}



export const usePhysicsStore = create<PhysicsState>((set, get) => ({
    components: [],
    wires: [],
    parent: {},
    shortCircuit: false,
    activeComponents: new Set(),
    errors: [],
    safetyReport: { shorts: [], polarityErrors: [], mechanicalConflicts: [], railGaps: [] },
    routedWires: {},
    currentPaths: [],

    addComponent: (comp) => {
        set((state) => {
            const newComps = [...state.components, comp];
            return { components: newComps };
        });
        get().rebuildGraph();
    },

    removeComponent: (id) => {
        set((state) => {
            return { components: state.components.filter(c => c.id !== id) };
        });
        get().rebuildGraph();
    },

    confirmPlacement: (id) => {
        set((state) => {
            return { 
                components: state.components.map(c => 
                    c.id === id ? { ...c, isSeated: true } : c
                ) 
            };
        });
        get().rebuildGraph();
    },

    addWire: (wire) => {
        set((state) => {
            const newWires = [...state.wires, wire];
            return { wires: newWires };
        });
        get().rebuildGraph();
    },

    removeWire: (id) => {
        set((state) => {
            return { wires: state.wires.filter(w => w.id !== id) };
        });
        get().rebuildGraph();
    },

    getNetId: (hole) => {
        let current = hole;
        let parents = get().parent;

        // Path compression
        const path: HoleId[] = [];
        while (parents[current] && parents[current] !== current) {
            path.push(current);
            current = parents[current];
        }

        // Simple hash to integer
        let hash = 0;
        for (let i = 0; i < current.length; i++) {
            hash = (Math.imul(31, hash) + current.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    },

    rebuildGraph: () => {
        const state = get();
        const parent: Record<HoleId, HoleId> = {};

        const find = (i: HoleId): HoleId => {
            if (!parent[i]) parent[i] = i;
            if (parent[i] === i) return i;
            return parent[i] = find(parent[i]);
        };

        const union = (i: HoleId, j: HoleId) => {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) {
                // Union by simple lexicographical tie break for determinism
                if (rootI < rootJ) {
                    parent[rootJ] = rootI;
                } else {
                    parent[rootI] = rootJ;
                }
            }
        };

        // 1. Build base connections for all possible holes (1-60)
        // To be efficient, we only need to union the canonical base holes when they are referenced
        // Actually, it's easier to just pre-union the board's internal metal clips

        for (let row = 1; row <= 60; row++) {
            // A-E
            for (let i = 1; i < 5; i++) {
                union(`A${row}`, `${String.fromCharCode(65 + i)}${row}`); // A-E
            }
            // F-J
            for (let i = 1; i < 5; i++) {
                union(`F${row}`, `${String.fromCharCode(70 + i)}${row}`); // F-J
            }

            // Power Rails
            if (row < 30) {
                union(`RAIL_VCC_L_1`, `RAIL_VCC_L_${row + 1}`);
                union(`RAIL_GND_L_1`, `RAIL_GND_L_${row + 1}`);
                union(`RAIL_VCC_R_1`, `RAIL_VCC_R_${row + 1}`);
                union(`RAIL_GND_R_1`, `RAIL_GND_R_${row + 1}`);
            } else if (row < 60) {
                union(`RAIL_VCC_L_31`, `RAIL_VCC_L_${row + 1}`);
                union(`RAIL_GND_L_31`, `RAIL_GND_L_${row + 1}`);
                union(`RAIL_VCC_R_31`, `RAIL_VCC_R_${row + 1}`);
                union(`RAIL_GND_R_31`, `RAIL_GND_R_${row + 1}`);
            }
        }

        // 2. Add Wire Unions
        state.wires.forEach(wire => {
            union(wire.source, wire.dest);
        });

        // 3. Evaluate Physics Logic
        const seatedComponents = state.components.filter(c => c.isSeated !== false);
        const physicsErrors = PhysicsEngine.validatePlacements(seatedComponents, state.wires);
        const evalState = PhysicsEngine.evaluateCircuit(seatedComponents, state.wires);
        
        // 3.5 Generate new Safety Report via GridSystem
        const safetyReport = GridSystem.getSafetyReport(state.components, state.wires);

        // Merge collision errors with electrical errors
        const combinedErrors = [...physicsErrors, ...evalState.errors, ...safetyReport.railGaps, ...safetyReport.mechanicalConflicts, ...safetyReport.polarityErrors];

        // 4. Build A* obstacle map and route all wires
        const obstacleMap = buildObstacleMap(state.components);
        const routedWires: Record<string, THREE.Vector3[]> = {};
        state.wires.forEach((wire, idx) => {
            routedWires[wire.id] = routeWire(obstacleMap, wire.source, wire.dest, idx);
        });

        // 5. Map node-based current paths to HoleId-based paths for rendering
        const currentPaths = evalState.activePaths.map(pathNodes => {
            const pathHoles: HoleId[] = pathNodes.map(nodeKey => {
                // Heuristic: STRIP:15:L -> C15, RAIL:VCC:L:1 -> RAIL_VCC_L_1
                if (nodeKey.startsWith('STRIP:')) {
                    const [, col, side] = nodeKey.split(':');
                    const rowLetter = side === 'L' ? 'C' : 'H'; // Midpoint of half
                    return `${rowLetter}${col}`;
                } else if (nodeKey.startsWith('RAIL:')) {
                    const [, type, side, half] = nodeKey.split(':');
                    const col = half === '1' ? '15' : '45';
                    return `RAIL_${type}_${side}_${col}`;
                }
                return nodeKey;
            });
            return { source: pathHoles[0], dest: pathHoles[pathHoles.length - 1], path: pathHoles };
        });

        set({ 
            parent,
            components: state.components.map(c => evalState.correctedComponents.find(ec => ec.id === c.id) || c), // Maintain isSeated across eval
            shortCircuit: evalState.shortCircuit,
            activeComponents: evalState.activeComponents,
            errors: combinedErrors,
            routedWires,
            currentPaths,
            safetyReport
        });
    }
}));
