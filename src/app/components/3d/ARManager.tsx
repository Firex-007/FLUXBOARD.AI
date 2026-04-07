/**
 * ARManager.tsx — Hybrid 6DOF WebXR + Markerless Tracker
 */
import React, { useState, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import { ARButton, XR, Interactive, useXRHitTest, createXRStore, XRSpace, useXRAnchor } from '@react-three/xr';
import { RealisticBreadboard } from './RealisticBreadboard';
import { ComponentsOnBoard } from './ComponentsOnBoard';
import { WiringVisuals } from './WiringVisuals';
import { toast } from 'sonner';
import * as THREE from 'three/webgpu';
import { isSafari, getCompatibilityMessage } from '../../../lib/utils/browser';

// Initialize the XR store with required features for surface detection and anchors
const store = createXRStore({
  hitTest: true,
  anchors: true,
  hand: true,
});

const Reticle = ({ onSelect }: { onSelect: (hit: any) => void }) => {
  const reticleRef = useRef<THREE.Group>(null);
  const [pulse, setPulse] = useState(0);

  // Continuous animation for the hologram pulse
  React.useEffect(() => {
    let frame: number;
    const animate = () => {
      setPulse(p => (p + 0.05) % (Math.PI * 2));
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, []);
  
  useXRHitTest((hits) => {
    if (reticleRef.current) {
        if (hits.length > 0) {
            reticleRef.current.visible = true;
            const hit = hits[0] as any;
            reticleRef.current.matrix.copy(hit.matrix);
            reticleRef.current.matrixWorldNeedsUpdate = true;
            // Store the hit test result on the group for select access
            (reticleRef.current as any).rawHit = hit;
        } else {
            reticleRef.current.visible = false;
        }
    }
  }, 'viewer');

  const pulseScale = 1 + Math.sin(pulse) * 0.1;

  return (
    <Interactive onSelect={(e) => {
      const hit = (reticleRef.current as any)?.rawHit;
      if (reticleRef.current?.visible && hit) {
        onSelect(hit);
      }
    }}>
      <group ref={reticleRef} matrixAutoUpdate={false} visible={false}>
        {/* Outer Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={pulseScale}>
          <ringGeometry args={[0.07, 0.08, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
        </mesh>
        {/* Pulsing Core */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[0.02, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.3 + (Math.sin(pulse) * 0.2)} />
        </mesh>
        {/* Scan Lines */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[0.02, 0.025, 4]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      </group>
    </Interactive>
  );
};

const WorldLockedScene = ({ 
  isConfirmed,
  setConfirmed
}: {
  isConfirmed: boolean;
  setConfirmed: (val: boolean) => void;
}) => {
  const [anchor, requestAnchor] = useXRAnchor();
  const [isPlacing, setPlacing] = useState(true);

  const handleOrbClick = () => {
    const audio = new Audio('/sounds/component-click.mp3');
    audio.play().catch(() => {});
    setConfirmed(true);
    toast.success("Electrical connectivity active. A* Routing initialized.");
  };

  const handlePlace = async (hit: any) => {
    try {
        // Create a native WebXR anchor at the hit test location
        await requestAnchor({
            relativeTo: 'hit-test-result',
            hitTestResult: hit.hitTestResult
        });
        setPlacing(false);
        toast.success("Circuit Anchored to World Space");
    } catch (e) {
        console.error("Anchor creation failed:", e);
        toast.error("Surface sync failed. Try another spot.");
    }
  };

  return (
    <>
      {isPlacing && (
        <Reticle onSelect={handlePlace} />
      )}

      {anchor && (
        <XRSpace space={anchor.anchorSpace}>
           <RealisticBreadboard />
           
           {isConfirmed ? (
               <group>
                   <ComponentsOnBoard />
                   <WiringVisuals />
               </group>
           ) : (
             <Interactive onSelect={handleOrbClick}>
               <mesh position={[0, 0.1, 0]}>
                 <sphereGeometry args={[0.04, 32, 32]} />
                 <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={1} />
                 <pointLight color="#22c55e" intensity={0.5} distance={0.5} />
               </mesh>
             </Interactive>
           )}

           <ContactShadows opacity={0.5} scale={10} blur={2.5} far={2} />
        </XRSpace>
      )}
    </>
  );
};

export const ARManager = ({ onExit }: { onExit?: () => void }) => {
  const [isPlaced, setPlaced] = useState(false);
  const [isConfirmed, setConfirmed] = useState(false);
  
  const placementPos = useRef(new THREE.Vector3());
  const placementQuat = useRef(new THREE.Quaternion());

  if (isSafari()) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 mb-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
          <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4 tracking-tighter">iOS Calibration In Progress</h2>
        <p className="text-slate-400 max-w-md mb-10 leading-relaxed font-medium">
          {getCompatibilityMessage()}
        </p>
        <button 
          onClick={onExit}
          className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl backdrop-blur-xl transition-all"
        >
          Return to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <Canvas dpr={[1, 2]}>
          <XR store={store}>
            <PerspectiveCamera makeDefault fov={70} />
            <Environment preset="city" />
            <ambientLight intensity={0.6} />
            <pointLight position={[5, 4, 5]} intensity={1} castShadow />
            
            <WorldLockedScene 
              isConfirmed={isConfirmed}
              setConfirmed={setConfirmed}
            />
          </XR>
        </Canvas>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <ARButton 
          store={store} 
          onError={(error) => {
            console.error("XR Session Error:", error);
            toast.error("WebXR Session Blocked. Ensure you are using HTTPS.");
          }}
          className="bg-gradient-to-r from-blue-600/80 to-cyan-500/80 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-md border border-white/10 transition-all duration-300 active:scale-95"
        >
          {(status) => {
            switch(status) {
              case 'unsupported': return '❌ AR UNSUPPORTED';
              case 'entered': return '📍 AR ACTIVE';
              default: return '🚀 ENTER AR';
            }
          }}
        </ARButton>
      </div>

      {/* Interactive UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-10 z-10">
        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-3xl text-white mt-16 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] font-medium tracking-wide">
          {!isPlaced && "Point at surface and TAP reticle to place"}
          {isPlaced && !isConfirmed && "Board anchored. Walk and TAP the Green Orb!"}
          {isConfirmed && "✓ Circuit Live & Validated"}
        </div>
        
        <div className="flex gap-4 pointer-events-auto mb-8">
          {isPlaced && (
            <button 
              className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-100 px-6 py-4 rounded-3xl backdrop-blur-2xl shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95"
              onClick={() => { setPlaced(false); setConfirmed(false); }}
            >
              Reset Anchor
            </button>
          )}

          {onExit && (
            <button 
              onClick={onExit} 
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-4 rounded-3xl backdrop-blur-2xl shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
                ✕ EXIT AR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
