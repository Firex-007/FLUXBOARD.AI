import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './Navbar';
import { DropZone } from './DropZone';
import { BOMCard } from './BOMCard';
import { WiringMap } from './WiringMap';
import { Scene } from './3d/Scene';
import { Toaster, toast } from 'sonner';
import { usePhysicsStore } from '../../store/physicsStore';
import { GeminiAnalyst } from '../../lib/gemini';
import { COMPONENT_LIBRARY, ComponentDef } from '../../lib/ComponentLibrary';
import { CircuitEditBot } from './CircuitEditBot';
import { SafetyBanner } from './SafetyBanner';
import { ARManager } from './3d/ARManager';

const MIN_LEFT = 180;
const MIN_MID = 160;
const MIN_RIGHT = 300;

// Row chars in physical order — A=0, B=1, ... E=4 | trench | F=5, G=6, ... J=9
const ROW_CHARS = ['A','B','C','D','E','F','G','H','I','J'];

/**
 * Given an anchor HoleId (e.g. "E30") and a ComponentDef, compute the full
 * pin map by applying each pin's (dx, dy) offset.
 *
 * dx offsets the column number: anchorCol + dx (clamped 1–60)
 * dy offsets the row index:     anchorRowIdx + dy (clamped 0–9)
 *
 * Example: DIP8_IC at "E30"
 *   PIN1 dx=0 dy=0 → E30
 *   PIN2 dx=1 dy=0 → E31
 *   PIN5 dx=3 dy=5 → F33  ← straddles trench (E=4, F=5)
 */
function derivePins(anchorHole: string, def: ComponentDef): Record<string, string> {
    const match = anchorHole.match(/^([A-J])(\d+)$/);
    if (!match) return { anchor: anchorHole }; // fallback, shouldn't happen

    const anchorRowIdx = ROW_CHARS.indexOf(match[1]);
    const anchorCol    = parseInt(match[2], 10);
    const pins: Record<string, string> = {};

    def.pins.forEach(pin => {
        const rowIdx = Math.max(0, Math.min(9, anchorRowIdx + pin.dy));
        const col    = Math.max(1, Math.min(60, anchorCol    + pin.dx));
        pins[pin.label] = `${ROW_CHARS[rowIdx]}${col}`;
    });

    return pins;
}


/** Thin draggable divider between panels */
function ResizeDivider({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;

    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      onDrag(me.clientX - lastX.current);
      lastX.current = me.clientX;
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onDrag]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative w-1 flex-shrink-0 cursor-col-resize select-none z-10"
      style={{ background: '#1e293b' }}
    >
      {/* Wider invisible hit area */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5 group-hover:bg-slate-700/50 transition-colors" />
      {/* Pip at center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-slate-600 opacity-50 group-hover:opacity-100 transition-opacity duration-200"
      />
    </div>
  );
}

export default function PrompterCAD() {
  const [fullscreen3D, setFullscreen3D] = useState(false);
  const [arMode, setArMode] = useState(false);
  const [leftW, setLeftW] = useState(256);
  const [midW, setMidW] = useState(256);

  const containerRef = useRef<HTMLElement>(null);

  const dragLeft = useCallback((dx: number) => {
    setLeftW(w => Math.max(MIN_LEFT, w + dx));
  }, []);

  const dragMid = useCallback((dx: number) => {
    setLeftW(lw => {
      setMidW(mw => {
        const containerW = containerRef.current?.offsetWidth ?? 1200;
        const newMid = Math.max(MIN_MID, mw + dx);
        if (containerW - lw - newMid < MIN_RIGHT) return mw;
        return newMid;
      });
      return lw;
    });
  }, []);

  const components = usePhysicsStore((s: any) => s.components);
  const wires = usePhysicsStore((s: any) => s.wires);
  const addComponent = usePhysicsStore((s: any) => s.addComponent);
  const addWire = usePhysicsStore((s: any) => s.addWire);
  const rebuildGraph = usePhysicsStore((s: any) => s.rebuildGraph);

  const hasContent = components.length > 0 || wires.length > 0;

  const bomItems = components.map((c: any) => ({
    id: c.id as unknown as number,
    name: c.type,
    desc: `Anchor: ${Object.values(c.pins as Record<string, string>)[0] || 'Floating'}`,
    type: 'Component',
    stock: 'In Stock'
  }));

  const connections = wires.map((w: any) => ({
    id: w.id as unknown as number,
    source: w.source,
    dest: w.dest,
    type: 'Jumper'
  }));

  const handleDeleteBOM = (id: number) => {
    usePhysicsStore.getState().removeComponent(String(id));
    toast.error('Component removed from board');
  };
  const handleAddBOM = () => toast.error('Manual add disabled. Ask the AI.');
  const handleSwapBOM = (_id: number) => toast.info('Swap handled by AI routing');


  const handleGenerate = async (prompt: string, imageBase64: string) => {
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          const result = await GeminiAnalyst.generateCircuit(prompt, imageBase64);
          if (result) {
            usePhysicsStore.setState({ components: [], wires: [] });
            result.components.forEach((c: any) => {
              const libDef = COMPONENT_LIBRARY[c.type];
              if (!libDef) return;

              // Derive every pin's HoleId from the anchorHole + ComponentLibrary offsets
              const pins = derivePins(c.anchorHole, libDef);
              addComponent({ id: c.id, type: c.type, pins, rotation: c.rotation });
            });
            result.wires.forEach((w: any) => {
              addWire({ id: Math.random().toString(36).substring(7), source: w.source, dest: w.dest, color: w.color });
            });
            rebuildGraph();
            resolve(result.analysis);
          } else reject('Failed null');
        } catch (e) { console.error(e); reject(e); }
      }),
      {
        loading: 'AI Routing physical circuit...',
        success: (msg) => `Circuit Generated! ${msg}`,
        error: 'Failed to process schematic'
      }
    );
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans flex flex-col bg-[#030712] selection:bg-cyan-500/30">
      <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'hud-glass border-cyan-500/20 text-cyan-400 font-bold', style: { maxWidth: '360px', fontSize: '0.85rem' } }} />
      
      {/* HUD Layer — overlays the 3D canvas */}
      <SafetyBanner />
      
      {/* AR Component — full engagement node */}
      {arMode && <ARManager onExit={() => setArMode(false)} />}
      
      {/* Control Center */}
      <Navbar onLaunchAR={() => setArMode(true)} />

      {/* Full 3D Overlay Mode */}
      <AnimatePresence>
        {fullscreen3D && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[150] bg-black flex flex-col"
          >
            <div className="flex-1"><Scene /></div>
            <button
              onClick={() => setFullscreen3D(false)}
              className="absolute top-8 right-8 z-[160] px-6 py-3 hud-glass border-white/10 text-cyan-400 font-bold tracking-widest text-xs rounded-2xl hover:border-cyan-400 transition-all active:scale-95 shadow-2xl"
            >
              ✕ DISENGAGE
            </button>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest text-slate-500 uppercase p-4 hud-glass border-white/5 rounded-full pointer-events-none">
              Orbit: Drag · Zoom: Scroll · Pan: Right-Click
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace HUD: Grid-to-Stack Transition */}
      <main ref={containerRef} className="flex-1 pt-24 pb-8 px-4 md:px-8 max-w-[1920px] mx-auto w-full grid grid-cols-1 md:grid-cols-[auto_1fr] lg:grid-cols-[auto_auto_1fr] gap-6 md:gap-8 overflow-y-auto md:overflow-visible">

        {/* Panel 1: AI Prompt Node */}
        <div
          className="flex-shrink-0 flex flex-col w-full hud-glass rounded-3xl border border-white/5 overflow-hidden"
          style={{ width: window.innerWidth < 768 ? '100%' : leftW }}
        >
          <div className="p-1 h-full mini-scroll">
            <DropZone onGenerate={handleGenerate} />
          </div>
        </div>
        
        {/* Panel 2: Diagnostics & Schematic Node */}
        <div
          className="flex-shrink-0 flex flex-col w-full h-[80vh] md:h-auto"
          style={{ width: window.innerWidth < 768 ? '100%' : midW }}
        >
          <div className="flex-1 flex flex-col gap-6 md:gap-8 min-h-0">
            <div className="flex-1 min-h-[300px] md:min-h-0">
              <BOMCard items={bomItems} onDelete={handleDeleteBOM} onAdd={handleAddBOM} onSwap={handleSwapBOM} />
            </div>
            <div className="flex-1 min-h-[300px] md:min-h-0">
              <WiringMap connections={connections} />
            </div>
          </div>
        </div>

        {/* Panel 3: 3D Visualization Node (Primary View) */}
        <div className="flex-1 relative flex flex-col w-full h-[60vh] md:h-auto hud-glass rounded-3xl border border-white/5 overflow-hidden shadow-2xl min-h-[400px]">
          {/* HUD Overlay inside 3D View */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 hud-glow" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-white uppercase opacity-80">3D Workspace</span>
              {hasContent && (
                <span className="text-[10px] font-bold text-cyan-400/60 ml-2 hidden sm:inline-block tracking-widest">
                   {components.length} NODES · {wires.length} LINKS
                </span>
              )}
            </div>
            <button
              onClick={() => setFullscreen3D(true)}
              className="px-4 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-400/50 rounded-lg text-cyan-400 text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
            >
              Expand HUD
            </button>
          </div>
          {/* 3D Canvas Engaged */}
          <div className="flex-1 relative bg-[#020617]"><Scene /></div>
        </div>

      </main>

      {/* Floating Assistant Control */}
      <CircuitEditBot />
    </div>
  );
}
