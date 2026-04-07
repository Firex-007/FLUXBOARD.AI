import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GridSystem, BOARD_SURFACE_Y, ROW_MAP, PITCH } from './GridSystem';

describe('GridSystem', () => {
    it('should correctly parse standard row/col holes (e.g. A1)', () => {
        // A1 is col 1 (which is index 0). x should be (0 - 30) * PITCH = -30 * 0.254 = -7.62
        const pos = GridSystem.getHolePos('A1');
        
        // Expected X:
        const expectedX = (1 - 60 / 2 - 0.5) * PITCH; 
        expect(pos.x).toBeCloseTo(expectedX, 3);
        
        // Expected Y
        expect(pos.y).toBeCloseTo(BOARD_SURFACE_Y, 3);

        // Expected Z for Row A
        expect(pos.z).toBeCloseTo(ROW_MAP['A'], 3);
    });

    it('should correctly parse power rail holes (e.g. RAIL_VCC_L_1)', () => {
        const vccLeft = GridSystem.getHolePos('RAIL_VCC_L_1');
        const vccRight = GridSystem.getHolePos('RAIL_VCC_R_35');
        
        expect(vccLeft.z).toBeLessThan(0); // Top rail
        expect(vccRight.z).toBeGreaterThan(0); // Bottom rail
    });

    it('should enforce the physical gap at columns 30 and 31 for power rails', () => {
        const p1 = GridSystem.getHolePos('RAIL_VCC_L_30');
        const p2 = GridSystem.getHolePos('RAIL_VCC_R_31'); // The split happens here. Right starts at 31
        
        expect(p1.x).toBeLessThan(0);
        expect(p2.x).toBeGreaterThan(0);
    });

    it('should return a default fallback Vector3 for invalid hole IDs', () => {
        // We expect it to fallback to (0, BOARD_SURFACE_Y, 0)
        const pos = GridSystem.getHolePos('INVALID_HOLE');
        
        expect(pos.x).toBe(0);
        expect(pos.y).toBeCloseTo(BOARD_SURFACE_Y, 3);
        expect(pos.z).toBe(0);
    });
});
