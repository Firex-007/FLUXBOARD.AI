import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePhysicsStore, ComponentInstance, WireInstance } from './physicsStore';
import * as THREE from 'three';

// Mock dependencies since we mainly want to test the store's immutable state and pure logic
vi.mock('../lib/AStarRouter', () => ({
    buildObstacleMap: vi.fn(),
    routeWire: vi.fn().mockImplementation((map: any, src: string, dst: string) => [new THREE.Vector3(), new THREE.Vector3()])
}));

vi.mock('../lib/PhysicsEngine', () => ({
    PhysicsEngine: {
        validatePlacements: vi.fn().mockReturnValue([]),
        evaluateCircuit: vi.fn().mockReturnValue({
            shortCircuit: false,
            activeComponents: new Set(['c1']),
            errors: [],
            correctedComponents: []
        })
    }
}));

describe('physicsStore', () => {
    beforeEach(() => {
        // Reset state before each test
        usePhysicsStore.setState({
            components: [],
            wires: [],
            parent: {},
            shortCircuit: false,
            activeComponents: new Set(),
            errors: [],
            routedWires: {}
        });
    });

    it('should add a component immutably', () => {
        const comp: ComponentInstance = { id: 'c1', type: 'LED', pins: { 'ANODE': 'A1' }, rotation: 0 };
        
        usePhysicsStore.getState().addComponent(comp);
        
        const state = usePhysicsStore.getState();
        expect(state.components.length).toBe(1);
        expect(state.components[0]).toEqual(comp);
    });

    it('should remove a component by id', () => {
        const comp: ComponentInstance = { id: 'c1', type: 'LED', pins: { 'ANODE': 'A1' }, rotation: 0 };
        usePhysicsStore.setState({ components: [comp] });
        
        usePhysicsStore.getState().removeComponent('c1');
        
        const state = usePhysicsStore.getState();
        expect(state.components.length).toBe(0);
    });

    it('should add and remove a wire', () => {
        const wire: WireInstance = { id: 'w1', source: 'A1', dest: 'B1', color: '#ff0000' };
        
        // Add
        usePhysicsStore.getState().addWire(wire);
        expect(usePhysicsStore.getState().wires.length).toBe(1);
        
        // Remove
        usePhysicsStore.getState().removeWire('w1');
        expect(usePhysicsStore.getState().wires.length).toBe(0);
    });

    it('should successfully rebuild graph and update simulation state', () => {
        // Just verify that the action runs and leverages the mocked physics engine
        usePhysicsStore.getState().rebuildGraph();
        const state = usePhysicsStore.getState();
        
        expect(state.activeComponents.has('c1')).toBe(true);
        expect(state.shortCircuit).toBe(false);
    });
});
