/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  FLUXBOARD.AI — A* Wire Auto-Router                                      │
 * │                                                                          │
 * │  Pipeline: HoleId → GPoint (grid) → A* path → 3D waypoints → TubeGeo   │
 * │                                                                          │
 * │  Manhattan routing: wires only move in cardinal directions.              │
 * │  Each turn gets a corner buffer so the CatmullRom spline stays tight.   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import * as THREE from 'three/webgpu';
import type { ComponentInstance } from '../store/physicsStore';
import { COMPONENT_LIBRARY } from './ComponentLibrary';
import { PITCH, COLS, ROWS, ROW_MAP, ROW_CHARS, GridSystem, BOARD_SURFACE_Y, colToX } from './GridSystem';

export type Grid = number[][];
export type GPoint = [row: number, col: number]; // both 0-indexed

// Wire height layers above board surface
const WIRE_LIFT     = 0.22;  // leave-hole / enter-hole transition height
const WIRE_TRAVEL   = 0.32;  // main travel height (clears component bodies)
const SLOT_STEP     = 0.04;  // per-wire offset so concurrent wires don't overlap

const FREE    = 1;
const BLOCKED = 1e9;

// ─── Grid helpers ────────────────────────────────────────────────────────────

/** "E15" → [4, 14]  (both 0-indexed). Returns null for rails or bad format. */
export function parseHole(holeId: string): GPoint | null {
    const m = holeId.match(/^([A-J])(\d+)$/);
    if (!m) return null;
    const rowIdx = ROW_CHARS.indexOf(m[1] as typeof ROW_CHARS[number]);
    const colIdx = parseInt(m[2], 10) - 1; // 1-based → 0-based
    if (rowIdx < 0 || colIdx < 0 || colIdx >= COLS) return null;
    return [rowIdx, colIdx];
}

/** RAIL_VCC_L_15 → grid row nearest to that rail (snapped to row A or J). */
export function railHoleToGridPoint(holeId: string): GPoint | null {
    const m = holeId.match(/^RAIL_(VCC|GND)_(L|R)_(\d+)$/);
    if (!m) return null;
    const col = parseInt(m[3], 10) - 1;
    const row = m[2] === 'L' ? 0 : 9; // L = top (near A), R = bottom (near J)
    return [row, Math.max(0, Math.min(COLS - 1, col))];
}

// ─── Obstacle map ────────────────────────────────────────────────────────────

/**
 * Build a ROWS×COLS grid where component body cells are BLOCKED.
 * Pin cells are left FREE so the router can enter/exit them.
 */
export function buildObstacleMap(components: ComponentInstance[]): Grid {
    const grid: Grid = Array.from({ length: ROWS }, () => Array(COLS).fill(FREE));

    components.forEach(comp => {
        const libDef = COMPONENT_LIBRARY[comp.type];
        if (!libDef) return;

        // Use every actual pin hole to determine the footprint anchor
        const pinHoles = Object.values(comp.pins) as string[];
        if (pinHoles.length === 0) return;

        // Block only the body cells — NOT the pin cells
        // We'll figure out the body bounds from the actual pin positions
        pinHoles.forEach(holeId => {
            const p = parseHole(holeId);
            if (!p) return;
            // Mark the hole itself as slightly costly (not BLOCKED) so router
            // can still enter pin holes of other components for wiring
            // Leave it FREE — we rely on circuit validity rules, not routing
        });

        // Block the interior of the component body (between first and last pin)
        const parsed = pinHoles.map(parseHole).filter(Boolean) as GPoint[];
        if (parsed.length < 2) return;

        const minRow = Math.min(...parsed.map(p => p[0]));
        const maxRow = Math.max(...parsed.map(p => p[0]));
        const minCol = Math.min(...parsed.map(p => p[1]));
        const maxCol = Math.max(...parsed.map(p => p[1]));

        // Block interior (not edges) so routing can still hug the component
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                // Skip the actual pin cells — they must remain accessible
                const isPinCell = parsed.some(p => p[0] === r && p[1] === c);
                if (!isPinCell) {
                    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                        grid[r][c] = BLOCKED;
                    }
                }
            }
        }
    });

    return grid;
}

// ─── A* pathfinder ────────────────────────────────────────────────────────────

interface ANode {
    g: number; h: number;
    row: number; col: number;
    parent: ANode | null;
}

function heuristic(a: GPoint, b: GPoint): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

const DIRS: GPoint[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function findPath(grid: Grid, start: GPoint, end: GPoint): GPoint[] {
    const key = (r: number, c: number) => `${r},${c}`;
    const open: ANode[] = [];
    const closed = new Set<string>();
    const gScore = new Map<string, number>();

    open.push({ g: 0, h: heuristic(start, end), row: start[0], col: start[1], parent: null });
    gScore.set(key(start[0], start[1]), 0);

    let best: ANode | null = null;
    let explored = 0;
    const MAX = 3000;

    while (open.length > 0 && explored++ < MAX) {
        open.sort((a, b) => (a.g + a.h) - (b.g + b.h));
        const curr = open.shift()!;
        const ck = key(curr.row, curr.col);

        if (curr.row === end[0] && curr.col === end[1]) { best = curr; break; }
        if (closed.has(ck)) continue;
        closed.add(ck);

        for (const [dr, dc] of DIRS) {
            const nr = curr.row + dr, nc = curr.col + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            const nk = key(nr, nc);
            if (closed.has(nk)) continue;

            // Always allow entry into start/end cells regardless of obstacle
            const isEndpoint = (nr === start[0] && nc === start[1]) || (nr === end[0] && nc === end[1]);
            const cost = isEndpoint ? FREE : grid[nr][nc];
            if (cost >= BLOCKED * 0.9) continue;

            const ng = curr.g + cost;
            if (ng < (gScore.get(nk) ?? Infinity)) {
                gScore.set(nk, ng);
                open.push({ g: ng, h: heuristic([nr, nc], end), row: nr, col: nc, parent: curr });
            }
        }
    }

    // Reconstruct
    if (!best) {
        // Fallback: direct L-shape (row-first)
        return [start, [end[0], start[1]], end];
    }
    const path: GPoint[] = [];
    let node: ANode | null = best;
    while (node) { path.unshift([node.row, node.col]); node = node.parent; }
    return path;
}

/** Remove collinear intermediate points (keep only corners). */
export function simplifyPath(path: GPoint[]): GPoint[] {
    if (path.length <= 2) return path;
    const out: GPoint[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const dr1 = path[i][0] - path[i - 1][0], dc1 = path[i][1] - path[i - 1][1];
        const dr2 = path[i + 1][0] - path[i][0], dc2 = path[i + 1][1] - path[i][1];
        if (dr1 !== dr2 || dc1 !== dc2) out.push(path[i]);
    }
    out.push(path[path.length - 1]);
    return out;
}

// ─── 3D path elevation ────────────────────────────────────────────────────────

/**
 * Convert a simplified grid path to 3D waypoints for a CatmullRomCurve3.
 *
 * Pattern for each segment:
 *   pin-surface → lift → travel → drop → pin-surface
 *
 * At every 90° corner we insert a "corner buffer" point so the spline
 * stays tight and doesn't interpolate diagonally across the turn.
 */
export function elevate3DPath(
    waypoints: GPoint[],
    slotIndex: number,
    sourceId: string,
    destId: string
): THREE.Vector3[] {
    const srcPt = GridSystem.getHolePos(sourceId);
    const dstPt = GridSystem.getHolePos(destId);

    // Calculate 2D distance between pins to determine arch height
    // 0.254 is PITCH, so 5cm is ~20 pitches
    const dist = srcPt.distanceTo(dstPt);
    
    // Manhattan Z-Layers:
    // 0.22 units (Flat), 0.44 units (Medium), 0.88 units (High)
    let travelOffset = WIRE_TRAVEL;
    if (dist > 1.27) { // > 5 pitches (approx 1.27cm world units if 1 unit = 1cm) 
        // Wait, the pitch is 0.254. 5cm / 0.254 = ~19.6 pitches.
        // The user says "dist > 5cm". 
        if (dist > 5.0) {
            travelOffset = 0.88;
        } else if (dist > 2.0) {
            travelOffset = 0.44;
        } else {
            travelOffset = 0.22;
        }
    }

    const lift   = BOARD_SURFACE_Y + WIRE_LIFT   + slotIndex * SLOT_STEP;
    const travel = BOARD_SURFACE_Y + travelOffset + slotIndex * SLOT_STEP;

    // Convert a grid point to world XZ at board surface level
    const toXZ = (gp: GPoint): [number, number] => {
        const [rowIdx, colIdx] = gp;
        const x = colToX(colIdx + 1);
        const z = ROW_MAP[ROW_CHARS[rowIdx]];
        return [x, z];
    };

    if (waypoints.length < 2) return [srcPt, dstPt];

    const pts: THREE.Vector3[] = [];

    // Start at source pin, surface level
    pts.push(srcPt.clone());

    // Lift off from source
    pts.push(new THREE.Vector3(srcPt.x, lift, srcPt.z));

    // Walk through waypoints building travel-height points with corner buffers
    for (let i = 0; i < waypoints.length - 1; i++) {
        const [ax, az] = toXZ(waypoints[i]);
        const [bx, bz] = toXZ(waypoints[i + 1]);

        // Point at current waypoint at travel height
        pts.push(new THREE.Vector3(ax, travel, az));

        // Corner buffer: a point just before the turn
        // This keeps the CatmullRom from rounding diagonally across the corner
        const MID_FRAC = 0.15; // how close to corner before we "commit"
        const beforeX = ax + (bx - ax) * (1 - MID_FRAC);
        const beforeZ = az + (bz - az) * (1 - MID_FRAC);
        pts.push(new THREE.Vector3(beforeX, travel, beforeZ));
    }

    // Last waypoint at travel height
    const lastWP = waypoints[waypoints.length - 1];
    const [lx, lz] = toXZ(lastWP);
    pts.push(new THREE.Vector3(lx, travel, lz));

    // Drop down to destination lift height then pin surface
    pts.push(new THREE.Vector3(dstPt.x, lift, dstPt.z));
    pts.push(dstPt.clone());

    return pts;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function routeWire(
    grid: Grid,
    sourceId: string,
    destId: string,
    slotIndex: number
): THREE.Vector3[] {
    const start = parseHole(sourceId) ?? railHoleToGridPoint(sourceId);
    const end   = parseHole(destId)   ?? railHoleToGridPoint(destId);

    if (!start || !end) {
        return [GridSystem.getHolePos(sourceId), GridSystem.getHolePos(destId)];
    }

    const raw = findPath(grid, start, end);
    const simplified = simplifyPath(raw);
    return elevate3DPath(simplified, slotIndex, sourceId, destId);
}
