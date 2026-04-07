import * as THREE from 'three/webgpu';

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GridSystem.ts — The SINGLE Source of Truth for Fluxboard Coordinates    │
 * │                                                                          │
 * │  Physical breadboard convention:                                         │
 * │    - Rows: A–J  (A–E = top half, F–J = bottom half), mapped to Z axis   │
 * │    - Columns: 1–60, mapped to X axis                                     │
 * │    - Pitch: 2.54 mm = 0.254 Three.js units                              │
 * │    - Trench gap: between row E and F (extra 0.254 space)                 │
 * │                                                                          │
 * │  X formula: x = (col - 0.5 - COLS/2) * PITCH                            │
 * │    col=1  → x = (0.5 - 30) * 0.254 = -7.493                             │
 * │    col=60 → x = (59.5 - 30) * 0.254 = +7.493  (perfectly symmetric)    │
 * │                                                                          │
 * │  This matches RealisticBreadboard which uses c from 0..59:               │
 * │    x = (c - COLS/2) * PITCH = (c - 30) * 0.254                          │
 * │    col=1, c=0 → (0 - 30) * 0.254 = -7.62                                │
 * │                                                                          │
 * │  NOTE: We keep OLD formula (col - 1 - COLS/2) to match RealisticBoard.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export const PITCH = 0.254;
export const COLS = 60;
export const ROWS = 10;
export const BOARD_SURFACE_Y = 0.055;

// Row letter → Z world position
// The trench is between E and F and has an extra gap of 1 PITCH
export const ROW_MAP: Record<string, number> = {
    A: -PITCH * 4.5,
    B: -PITCH * 3.5,
    C: -PITCH * 2.5,
    D: -PITCH * 1.5,
    E: -PITCH * 0.5,
    // --- TRENCH (1 PITCH gap here, so F starts at +1.5 not +0.5) ---
    F:  PITCH * 1.5,
    G:  PITCH * 2.5,
    H:  PITCH * 3.5,
    I:  PITCH * 4.5,
    J:  PITCH * 5.5,
};

// Row index (0=A … 9=J) lookup
export const ROW_CHARS = ['A','B','C','D','E','F','G','H','I','J'] as const;
export type RowChar = typeof ROW_CHARS[number];

// Rail Z positions (match RealisticBreadboard.tsx constants)
export const RAIL_Z: Record<string, number> = {
    VCC_L: -PITCH * 8,     // top VCC rail
    GND_L: -PITCH * 7,     // top GND rail
    VCC_R:  PITCH * 7.5,   // bottom VCC rail
    GND_R:  PITCH * 8.5,   // bottom GND rail
};

/** Convert 1-based column number to world X. Matches RealisticBreadboard indexing. */
export function colToX(col: number): number {
    // col is 1-indexed. c = col - 1 is 0-indexed.
    // RealisticBreadboard uses: x = (c - COLS/2) * PITCH
    return (col - 1 - COLS / 2) * PITCH;
}

export class GridSystem {
    /**
     * Converts a Hole ID to an exact 3D Vector3 on the board surface.
     * "E15" → column 15, row E
     * "RAIL_VCC_L_1" → VCC top rail, column 1
     */
    static getHolePos(holeId: string): THREE.Vector3 {
        // Signal hole: e.g. "E15"
        const sigMatch = holeId.match(/^([A-J])(\d+)$/);
        if (sigMatch) {
            const row = sigMatch[1];
            const col = parseInt(sigMatch[2], 10);
            const x = colToX(col);
            const z = ROW_MAP[row] ?? 0;
            return new THREE.Vector3(x, BOARD_SURFACE_Y, z);
        }

        // Power rail: e.g. "RAIL_VCC_L_15"
        const railMatch = holeId.match(/^RAIL_(VCC|GND)_(L|R)_(\d+)$/);
        if (railMatch) {
            const key = `${railMatch[1]}_${railMatch[2]}`;
            const col = parseInt(railMatch[3], 10);
            const x = colToX(col);
            const z = RAIL_Z[key] ?? 0;
            return new THREE.Vector3(x, BOARD_SURFACE_Y, z);
        }

        return new THREE.Vector3(0, BOARD_SURFACE_Y, 0);
    }

    static isValidHole(holeId: string): boolean {
        return !!(holeId.match(/^([A-J])(\d+)$/) || holeId.match(/^RAIL_(VCC|GND)_(L|R)_(\d+)$/));
    }

    // --- NEW PHYSICS/GEOMETRY VALIDATIONS ---

    /** 1. Split Rail Trap: Check if the left and right halves of a rail are bridged. */
    static checkRailContinuity(wires: { source: string, dest: string }[], rail: 'TOP' | 'BOTTOM'): boolean {
        const sidePrefix = rail === 'TOP' ? 'L' : 'R';
        // If there's a wire connecting VCC_L_30 to VCC_L_31 or GND, etc
        // An easier check: is there any wire where one dest is col <= 30 and other is col > 30 on the same rail?
        for (const w of wires) {
            const isVCC = w.source.includes(`RAIL_VCC_${sidePrefix}`) && w.dest.includes(`RAIL_VCC_${sidePrefix}`);
            const isGND = w.source.includes(`RAIL_GND_${sidePrefix}`) && w.dest.includes(`RAIL_GND_${sidePrefix}`);
            if (isVCC || isGND) {
                const sCol = parseInt(w.source.split('_').pop() || '0', 10);
                const dCol = parseInt(w.dest.split('_').pop() || '0', 10);
                if ((sCol <= 30 && dCol > 30) || (sCol > 30 && dCol <= 30)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** 2. Component Bounding Boxes collision based on radial footprint overlapping */
    static checkPhysicalCollisions(components: any[]): string[] {
        const errors: string[] = [];
        for (let i = 0; i < components.length; i++) {
            for (let j = i + 1; j < components.length; j++) {
                const c1 = components[i];
                const c2 = components[j];
                const p1 = this.getHolePos(Object.values(c1.pins)[0] as string || '');
                const p2 = this.getHolePos(Object.values(c2.pins)[0] as string || '');
                
                // Approximate radius based on string length type or predefined
                const r1 = c1.type.includes('CAPACITOR') ? PITCH * 1.5 : PITCH;
                const r2 = c2.type.includes('CAPACITOR') ? PITCH * 1.5 : PITCH;

                if (p1 && p2 && p1.distanceTo(p2) < (r1 + r2) * 0.8) { // 0.8 fuzz factor
                    errors.push(`🧱 MECHANICAL COLLISION: ${c1.type} [${c1.id}] overlaps with ${c2.type} [${c2.id}].`);
                }
            }
        }
        return errors;
    }

    /** 3. The "Pro" Safety Check requested */
    static getSafetyReport(components: any[], wires: any[]) {
        const shorts: string[] = [];
        const polarityErrors: string[] = [];
        
        // Very basic mock of the polarity check for demonstration (assume reversed if mapped wrong)
        components.forEach(comp => {
            if (!comp.isSeated && comp.isSeated !== undefined) {
                // If it exposes isSeated but it's explicitly false
                polarityErrors.push(`⚠️ CONTACT WARNING: High resistance at ${comp.type} [${comp.id}]. Ensure component is fully seated.`);
            }
        });

        const mechanicalConflicts = this.checkPhysicalCollisions(components);
        
        const railGaps: string[] = [];
        if (!this.checkRailContinuity(wires, 'TOP')) railGaps.push("Top Power Rail is disconnected between Col 30 and 31.");
        if (!this.checkRailContinuity(wires, 'BOTTOM')) railGaps.push("Bottom Power Rail is disconnected between Col 30 and 31.");

        return { shorts, polarityErrors, mechanicalConflicts, railGaps };
    }
}
