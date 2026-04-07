/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  FLUXBOARD.AI — Physics Engine v2.0.1                                    │
 * │                                                                          │
 * │  Responsibilities:                                                        │
 * │  1. SPATIAL VALIDATION — solid-body footprint collision detection         │
 * │  2. CONNECTIVITY GRAPH — build an undirected graph of electrical nodes    │
 * │  3. ELECTRICAL VALIDATION — 5 safety rules before anything renders       │
 * │  4. CIRCUIT EVALUATION  — BFS current-flow detection (LEDs glow, etc.)   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { COMPONENT_LIBRARY } from './ComponentLibrary';
import type { ComponentInstance, HoleId, WireInstance } from '../store/physicsStore';

// ── Re-exported for callers ───────────────────────────────────────────────
export type NetId = number;

export interface EvaluatedState {
    shortCircuit: boolean;
    activeNets: Set<NetId>;
    activeComponents: Set<string>;
    activePaths: string[][]; // Node keys forming the current path(s)
    errors: string[];
    correctedComponents: ComponentInstance[];
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 1 — INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════════════════

const ROW_CHARS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
type RowChar = typeof ROW_CHARS[number];

function parseSignalHole(holeId: string): { rowIdx: number; col: number } | null {
    const m = holeId.match(/^([A-J])(\d+)$/);
    if (!m) return null;
    const rowIdx = ROW_CHARS.indexOf(m[1] as RowChar);
    const col = parseInt(m[2], 10);  // 1-based
    if (rowIdx < 0 || col < 1 || col > 60) return null;
    return { rowIdx, col };
}

/** Canonical DSU key for a 5-hole terminal strip. */
function stripKey(col: number, side: 'L' | 'R'): string {
    return `STRIP:${col}:${side}`;
}

/** Canonical key for a power rail segment. */
function railKey(type: 'VCC' | 'GND', side: 'L' | 'R', half: 1 | 2): string {
    return `RAIL:${type}:${side}:${half}`;
}

/** Map a HoleId → its electrical Node key (for the connectivity graph). */
function holeToNode(holeId: string): string | null {
    // Signal hole e.g. "E15" → STRIP:15:L (col 15, left half A-E)
    const sig = parseSignalHole(holeId);
    if (sig) {
        const side: 'L' | 'R' = sig.rowIdx <= 4 ? 'L' : 'R';  // A-E = L, F-J = R
        return stripKey(sig.col, side);
    }

    // Power rail e.g. "RAIL_VCC_L_15"
    const m = holeId.match(/^RAIL_(VCC|GND)_(L|R)_(\d+)$/);
    if (m) {
        const col = parseInt(m[3], 10);
        const half = col <= 30 ? 1 : 2;
        return railKey(m[1] as 'VCC' | 'GND', m[2] as 'L' | 'R', half as 1 | 2);
    }

    return null;
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 2 — SOLID BODY FOOTPRINT COLLISION DETECTOR
//  Checks that NO two component bodies overlap on the physical board.
//  Each component occupies a rectangle of holes: (anchorRow, anchorCol)
//  to (anchorRow + heightRows - 1, anchorCol + widthCols - 1).
// ══════════════════════════════════════════════════════════════════════════

/** Get the anchor hole for a component (first pin, deterministically). */
function getAnchorHole(comp: ComponentInstance): string | null {
    return (
        comp.pins['P1'] ??
        comp.pins['ANODE'] ??
        comp.pins['PIN1'] ??
        comp.pins['BASE'] ??
        comp.pins['POSITIVE'] ??
        comp.pins['IN'] ??
        comp.pins['COIL_A'] ??
        Object.values(comp.pins)[0] ??
        null
    );
}

/** All holes covered by a component's physical body (bounding box). */
function getBodyFootprint(comp: ComponentInstance): Set<string> {
    const libDef = COMPONENT_LIBRARY[comp.type];
    if (!libDef) return new Set();

    const anchorHole = getAnchorHole(comp);
    if (!anchorHole) return new Set();

    const anchor = parseSignalHole(anchorHole);
    if (!anchor) return new Set();

    const { rowIdx: anchorRow, col: anchorCol } = anchor;
    const cells = new Set<string>();

    for (let dr = 0; dr < libDef.heightRows; dr++) {
        for (let dc = 0; dc < libDef.widthCols; dc++) {
            const r = anchorRow + dr;
            const c = anchorCol + dc;
            if (r >= 0 && r < 10 && c >= 1 && c <= 60) {
                cells.add(`${ROW_CHARS[r]}${c}`);
            }
        }
    }
    return cells;
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 3 — CONNECTIVITY GRAPH BUILDER
//  Node = one electrical strip or power-rail segment.
//  Edge = a wire (or a component body connection from leads to a node).
// ══════════════════════════════════════════════════════════════════════════

interface ElectricalGraph {
    /** All nodes (strips, rails) */
    nodes: Set<string>;
    /** Adjacency: nodeKey → Set<nodeKey> it is connected to */
    adj: Map<string, Set<string>>;
    /** Which nodes are VCC sources */
    vccNodes: Set<string>;
    /** Which nodes are GND sinks */
    gndNodes: Set<string>;
    /** Map from component id → list of {pinLabel, node} */
    componentNodes: Map<string, { label: string; node: string }[]>;
}

function buildConnectivityGraph(
    components: ComponentInstance[],
    wires: WireInstance[]
): ElectricalGraph {
    const nodes = new Set<string>();
    const adj = new Map<string, Set<string>>();
    const vccNodes = new Set<string>();
    const gndNodes = new Set<string>();
    const componentNodes = new Map<string, { label: string; node: string }[]>();

    const addEdge = (a: string, b: string) => {
        nodes.add(a); nodes.add(b);
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
    };

    // 1. Register all component pins as nodes in the graph
    components.forEach(comp => {
        const pinNodes: { label: string; node: string }[] = [];
        Object.entries(comp.pins).forEach(([label, holeId]) => {
            const node = holeToNode(holeId);
            if (!node) return;
            nodes.add(node);
            if (!adj.has(node)) adj.set(node, new Set());
            pinNodes.push({ label, node });
        });
        componentNodes.set(comp.id, pinNodes);
    });

    // 2. Register all wires as edges
    wires.forEach(wire => {
        const srcNode = holeToNode(wire.source);
        const dstNode = holeToNode(wire.dest);
        if (!srcNode || !dstNode) return;
        addEdge(srcNode, dstNode);

        // Mark power nodes
        if (wire.source.includes('VCC') || wire.dest.includes('VCC')) {
            vccNodes.add(srcNode);
            vccNodes.add(dstNode);
        }
        if (wire.source.includes('GND') || wire.dest.includes('GND')) {
            gndNodes.add(srcNode);
            gndNodes.add(dstNode);
        }
    });

    // 3. Register any BATTERY / power supply component as VCC/GND sources
    components.filter(c => c.type === 'BATTERY').forEach(bat => {
        const posNode = holeToNode(bat.pins['POSITIVE'] ?? bat.pins['P1'] ?? '');
        const negNode = holeToNode(bat.pins['NEGATIVE'] ?? bat.pins['P2'] ?? '');
        if (posNode) vccNodes.add(posNode);
        if (negNode) gndNodes.add(negNode);
    });

    return { nodes, adj, vccNodes, gndNodes, componentNodes };
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 4 — ELECTRICAL VALIDATOR (5 Rules)
// ══════════════════════════════════════════════════════════════════════════

function validateElectrical(graph: ElectricalGraph, components: ComponentInstance[]): string[] {
    const errors: string[] = [];

    components.forEach(comp => {
        const pinNodes = graph.componentNodes.get(comp.id) ?? [];

        // Rule 1 — Self-Short: both pins of a polar component on the same node
        // (same 5-hole strip = electrically identical holes)
        if (pinNodes.length >= 2) {
            for (let i = 0; i < pinNodes.length - 1; i++) {
                for (let j = i + 1; j < pinNodes.length; j++) {
                    if (pinNodes[i].node === pinNodes[j].node) {
                        errors.push(
                            `⚡ SELF-SHORT: ${comp.type} [${comp.id}] pins ` +
                            `"${pinNodes[i].label}" and "${pinNodes[j].label}" ` +
                            `are both in the same terminal strip.`
                        );
                    }
                }
            }
        }

        // Rule 2 — Float: a pin is not connected to any wire or other component
        pinNodes.forEach(({ label, node }) => {
            const degree = graph.adj.get(node)?.size ?? 0;
            if (degree === 0) {
                errors.push(
                    `🔌 FLOATING PIN: ${comp.type} [${comp.id}] pin "${label}" ` +
                    `is not connected to anything.`
                );
            }
        });

        // Rule 3 — Polarity Inversion: LED or Diode Cathode on a higher-potential
        // node than Anode (detected later after BFS, placeholder set here)
        if (comp.type === 'LED' || comp.type === 'DIODE' || comp.type === 'ZENER_DIODE') {
            const anodeNode = pinNodes.find(p => p.label === 'ANODE')?.node;
            const cathodeNode = pinNodes.find(p => p.label === 'CATHODE')?.node;
            if (anodeNode && cathodeNode && anodeNode === cathodeNode) {
                errors.push(
                    `🔄 POLARITY: ${comp.type} [${comp.id}] anode and cathode ` +
                    `are on the same strip — self-shorted and mis-wired.`
                );
            }
        }

        // Rule 4 — IC Trench Breach: a mustCrossTrench IC must have pins on BOTH sides
        const libDef = COMPONENT_LIBRARY[comp.type];
        if (libDef?.mustCrossTrench) {
            const hasPinsLeft = pinNodes.some(p => p.node.endsWith(':L'));
            const hasPinsRight = pinNodes.some(p => p.node.endsWith(':R'));
            if (!hasPinsLeft || !hasPinsRight) {
                errors.push(
                    `🚧 IC TRENCH: ${comp.type} [${comp.id}] must straddle the center trench ` +
                    `(pins on both A–E and F–J rows).`
                );
            }
        }
    });

    // Rule 5 — Dead Short: any VCC node and GND node connected directly without resistance
    // We check if a VCC node and a GND node share the same connected component via BFS
    // BUT only pass through "wire-only" edges (no component in between).
    // For the MVP, checking if VCC and GND node are direct graph neighbours is a fast proxy.
    for (const vNode of Array.from(graph.vccNodes)) {
        const neighbours = graph.adj.get(vNode) ?? new Set<string>();
        for (const gNode of Array.from(graph.gndNodes)) {
            if (neighbours.has(gNode)) {
                errors.push(
                    `💀 DEAD SHORT: A wire directly connects a VCC rail to a GND rail.`
                );
                break;
            }
        }
    }

    return errors;
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 5 — CURRENT FLOW EVALUATOR (BFS from VCC to GND)
// ══════════════════════════════════════════════════════════════════════════

function evaluateCurrentFlow(
    graph: ElectricalGraph,
    components: ComponentInstance[]
): { shortCircuit: boolean; activeNets: Set<NetId>; activeComponents: Set<string>; activePaths: string[][] } {

    const activeNets = new Set<NetId>();
    const activeComponents = new Set<string>();

    if (graph.vccNodes.size === 0 || graph.gndNodes.size === 0) {
        return { shortCircuit: false, activeNets, activeComponents, activePaths: [] };
    }

    // BFS forward from VCC to find all reachable nodes
    const visited = new Set<string>(graph.vccNodes);
    const queue = Array.from(graph.vccNodes);
    const predEdge = new Map<string, string>(); // node → predecessor node

    while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbour of Array.from(graph.adj.get(curr) ?? [])) {
            if (!visited.has(neighbour)) {
                visited.add(neighbour);
                predEdge.set(neighbour, curr);
                queue.push(neighbour);
            }
        }
    }

    // Check if any GND node is reachable
    const reachedGnd = Array.from(graph.gndNodes).filter(g => visited.has(g));
    if (reachedGnd.length === 0) {
        return { shortCircuit: false, activeNets, activeComponents, activePaths: [] };
    }

    const activePaths: string[][] = [];
    
    // For each reached GND node, trace back to a VCC node to form a path
    reachedGnd.forEach(gnd => {
        const path: string[] = [];
        let curr: string | undefined = gnd;
        while (curr) {
            path.unshift(curr);
            curr = predEdge.get(curr);
            if (graph.vccNodes.has(path[0])) break; // Found start
        }
        if (path.length > 1) activePaths.push(path);
    });

    // Trace back from GND to mark all nodes on active paths
    const backQueue = [...reachedGnd];
    const activeNodes = new Set<string>(backQueue);

    while (backQueue.length > 0) {
        const curr = backQueue.shift()!;
        const pred = predEdge.get(curr);
        if (pred && !activeNodes.has(pred)) {
            activeNodes.add(pred);
            backQueue.push(pred);
        }
    }

    // Check for dead short (VCC and GND in the same node or direct adjacency)
    const shortCircuit = Array.from(graph.vccNodes).some(v => graph.gndNodes.has(v));

    // Map active nodes → active components (those whose ALL pins are on active nodes)
    components.forEach(comp => {
        const pinNodes = graph.componentNodes.get(comp.id) ?? [];
        if (pinNodes.length > 0 && pinNodes.every(p => activeNodes.has(p.node))) {
            activeComponents.add(comp.id);
        }
    });

    // Map active nodes → NetIds for highlighting
    activeNodes.forEach(nodeKey => {
        // Just hash the node key to a number for easy comparison
        let hash = 0;
        for (let i = 0; i < nodeKey.length; i++) {
            hash = (Math.imul(31, hash) + nodeKey.charCodeAt(i)) | 0;
        }
        activeNets.add(Math.abs(hash));
    });

    return { shortCircuit, activeNets, activeComponents, activePaths };
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 6 — PUBLIC API
// ══════════════════════════════════════════════════════════════════════════

export class PhysicsEngine {

    /**
     * Validate physical placement: check for solid-body footprint overlaps.
     * Returns a list of human-readable error strings.
     */
    static validatePlacements(
        components: ComponentInstance[],
        wires: WireInstance[]
    ): string[] {
        const errors: string[] = [];

        // --- 1. Pin-level hole collision (two pins sharing one hole)
        const pinOccupancy = new Map<HoleId, string>(); // hole → "comp.type [comp.id]"
        components.forEach(comp => {
            Object.entries(comp.pins).forEach(([pinLabel, hole]) => {
                if (!hole) return;
                if (pinOccupancy.has(hole)) {
                    errors.push(
                        `📍 PIN COLLISION at ${hole}: ${comp.type} [${comp.id}] pin "${pinLabel}" ` +
                        `conflicts with ${pinOccupancy.get(hole)}.`
                    );
                } else {
                    pinOccupancy.set(hole, `${comp.type} [${comp.id}]`);
                }
            });
        });

        // --- 2. Solid-body footprint collision (two component bodies overlapping)
        const bodyOccupancy = new Map<string, string>(); // hole → "comp.type [comp.id]"
        components.forEach(comp => {
            const footprint = getBodyFootprint(comp);
            const owner = `${comp.type} [${comp.id}]`;

            footprint.forEach(hole => {
                if (bodyOccupancy.has(hole) && bodyOccupancy.get(hole) !== owner) {
                    errors.push(
                        `🧱 BODY OVERLAP at ${hole}: ${owner} physically clips into ${bodyOccupancy.get(hole)}.`
                    );
                } else {
                    bodyOccupancy.set(hole, owner);
                }
            });
        });

        // --- 3. Wire endpoint conflicts (wire starts/ends in a component body, not at a pin)
        wires.forEach(wire => {
            [wire.source, wire.dest].forEach(hole => {
                if (bodyOccupancy.has(hole) && !pinOccupancy.has(hole)) {
                    errors.push(
                        `🔧 WIRE CLIP: Wire [${wire.id}] endpoint ${hole} is inside the body of ` +
                        `${bodyOccupancy.get(hole)} — not a valid pin location.`
                    );
                }
            });
        });

        return errors;
    }

    /**
     * ─── AUTO-STRADDLE LOGIC ───
     * If a component MUST cross the trench (e.g. DIP8_IC) but the AI placed all
     * pins on one side, we 'Jugaad' it by rewriting the pins to straddle the
     * trench (Row E and Row F) centering on the anchor column.
     */
    static preProcessPlacements(components: ComponentInstance[]): ComponentInstance[] {
        return components.map(comp => {
            const libDef = COMPONENT_LIBRARY[comp.type];
            if (!libDef?.mustCrossTrench) return comp;

            const pinKeys = Object.keys(comp.pins);
            const pinNodes = pinKeys.map(k => holeToNode(comp.pins[k]));
            
            const allOnLeft = pinNodes.every(n => n?.endsWith(':L'));
            const allOnRight = pinNodes.every(n => n?.endsWith(':R'));

            if (allOnLeft || allOnRight) {
                // Determine anchor column from the first pin
                const anchorHole = comp.pins[pinKeys[0]];
                const m = anchorHole.match(/^([A-J])(\d+)$/);
                if (!m) return comp;
                
                const col = parseInt(m[2], 10);
                const halfCount = pinKeys.length / 2;
                const newPins: Record<string, string> = {};

                // Re-map: Pins 1..N/2 to Row E, Pins N/2+1..N to Row F
                pinKeys.forEach((key, idx) => {
                    const isTopHalf = idx < halfCount;
                    const rowChar = isTopHalf ? 'E' : 'F';
                    const colOffset = isTopHalf ? idx : (pinKeys.length - 1 - idx);
                    newPins[key] = `${rowChar}${col + colOffset}`;
                });

                return { ...comp, pins: newPins };
            }
            return comp;
        });
    }

    /**
     * Full electrical validation: build connectivity graph, run 5 rules,
     * evaluate current flow.
     */
    static evaluateCircuit(
        components: ComponentInstance[],
        wires: WireInstance[]
    ): EvaluatedState {
        // Pre-process to fix 'BS' layouts
        const correctedComponents = this.preProcessPlacements(components);

        // Build graph with corrected layout
        const graph = buildConnectivityGraph(correctedComponents, wires);

        // Run 5 validation rules
        const validationErrors = validateElectrical(graph, correctedComponents);

        // Evaluate current flow (BFS)
        const flowResult = evaluateCurrentFlow(graph, components);

        return {
            shortCircuit: flowResult.shortCircuit,
            activeNets: flowResult.activeNets,
            activeComponents: flowResult.activeComponents,
            activePaths: flowResult.activePaths,
            errors: validationErrors,
            correctedComponents,
        };
    }
}
