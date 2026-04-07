import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RealisticBreadboard } from './RealisticBreadboard';
import { WiringVisuals } from './WiringVisuals';
import { ComponentsOnBoard } from './ComponentsOnBoard';
import { CurrentTracer } from './CurrentTracer';

export function Scene() {
    return (
        <div className="w-full h-full relative" style={{ background: '#07111f' }}>
            <Canvas
                camera={{ position: [0, 7, 11], fov: 42 }}
                /* demand = only re-render on pointer/resize events → no idle GPU spin */
                frameloop="demand"
                /* cap pixel ratio at 1 — avoids 4× fill on HiDPI screens */
                dpr={[1, 1]}
                gl={{
                    alpha: false,
                    antialias: true,
                    powerPreference: 'high-performance',
                }}
            >
                <color attach="background" args={['#07111f']} />

                {/* Minimal lighting — cheap flat fill */}
                <ambientLight intensity={1.4} />
                {/* Key light */}
                <directionalLight position={[8, 16, 8]} intensity={2.5} />
                {/* Soft fill opposite */}
                <directionalLight position={[-6, 6, -6]} intensity={1.2} color="#dbeafe" />
                {/* Neon rim pair — point lights only, no env texture */}
                <pointLight position={[-12, 4, -8]} color="#06b6d4" intensity={2.5} distance={28} />
                <pointLight position={[12, 4, 8]} color="#84cc16" intensity={2.0} distance={28} />

                <group position={[0, -0.5, 0]}>
                    <RealisticBreadboard />
                    <ComponentsOnBoard />
                    <WiringVisuals />
                    <CurrentTracer />
                </group>

                <OrbitControls
                    makeDefault
                    maxPolarAngle={Math.PI / 2.05}
                    minDistance={2}
                    maxDistance={22}
                    /* Invalidate on each control event so frameloop="demand" still works */
                    onChange={() => {/* R3F auto-invalidates on pointer events */ }}
                />
            </Canvas>

            <div className="absolute bottom-4 left-4 pointer-events-none">
                <div className="px-3 py-1 bg-black/60 backdrop-blur border border-lime-400/20 rounded-full text-xs text-lime-400 font-mono tracking-widest">
                    DSU Physics Engine Active
                </div>
            </div>
        </div>
    );
}
