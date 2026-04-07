import { useState } from 'react';
import { Cpu, Zap, X, BookOpen, FolderOpen, Settings2, Scan } from 'lucide-react';
import { useLibraryStore, exportCircuitToFile, importCircuitFromFile } from '../../store/libraryStore';
import { usePhysicsStore } from '../../store/physicsStore';
import { toast } from 'sonner'; 
import { isSafari } from '../../lib/utils/browser';

type Panel = 'library' | 'projects' | 'settings' | 'profile' | null;

export function Navbar({ onLaunchAR }: { onLaunchAR?: () => void }) {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Panel) => setPanel((prev: Panel) => (prev === p ? null : p));

  const circuits = useLibraryStore((s: any) => s.circuits);
  const deleteCircuit = useLibraryStore((s: any) => s.deleteCircuit);
  const renameCircuit = useLibraryStore((s: any) => s.renameCircuit);
  const addComponent = usePhysicsStore((s: any) => s.addComponent);
  const addWire = usePhysicsStore((s: any) => s.addWire);
  const rebuildGraph = usePhysicsStore((s: any) => s.rebuildGraph);

  const loadCircuit = (c: any) => {
    usePhysicsStore.setState({ components: [], wires: [] });
    c.components.forEach((comp: any) => addComponent(comp));
    c.wires.forEach((w: any) => addWire(w));
    rebuildGraph();
    setPanel(null);
    toast.success(`📂 Loaded "${c.name}"`);
  };

  const navBtn = (id: Panel, label: string, Icon: any) => {
    const isLib = id === 'library';
    return (
      <button
        onClick={() => toggle(id)}
        className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200 px-2 py-1 rounded-lg"
        style={{
          color: panel === id ? '#22d3ee' : '#94a3b8',
          background: panel === id ? 'rgba(34,211,238,0.08)' : 'transparent',
          border: panel === id ? '1px solid #22d3ee33' : '1px solid transparent',
        }}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
        {isLib && circuits.length > 0 && (
          <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 leading-none">
            {circuits.length}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[98%] md:w-[90%] max-w-7xl h-16 hud-glass rounded-2xl z-[100] flex items-center px-4 md:px-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] border border-white/5 group scan-effect">
        {/* Logo Section */}
        <div className="flex items-center gap-3 md:gap-4 cursor-pointer flex-shrink-0 group/logo" onClick={() => window.location.reload()}>
          <div className="relative">
            <Cpu className="w-6 h-6 md:w-7 md:h-7 text-cyan-400 group-hover/logo:text-lime-400 transition-colors duration-500" />
            <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 text-lime-400 absolute -top-1 -right-1 animate-pulse hud-glow rounded-full" />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tighter text-white hidden xs:block">
            FLUX<span className="text-cyan-400">BOARD</span><span className="text-lime-400/80">.AI</span>
          </h1>
        </div>

        {/* Dynamic Navigation HUD */}
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden md:flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 mr-2">
            {navBtn('projects', 'PROJECTS', FolderOpen)}
            {navBtn('library', 'LIBRARY', BookOpen)}
            {navBtn('settings', 'CONFIG', Settings2)}
          </div>

          {/* Simple Mobile Icons */}
          <div className="flex md:hidden items-center gap-1.5 mr-1">
             <button onClick={() => toggle('library')} className={`p-2 rounded-xl transition-all ${panel === 'library' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}>
                <BookOpen className="w-5 h-5" />
             </button>
             <button onClick={() => toggle('settings')} className={`p-2 rounded-xl transition-all ${panel === 'settings' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' : 'text-slate-400 hover:text-white'}`}>
                <Settings2 className="w-5 h-5" />
             </button>
          </div>

          {/* ── AR Launcher NODE ── */}
          <button
            id="ar-launch-btn"
            onClick={() => {
                if (isSafari()) {
                    toast.info("Enhanced mobile support for iOS is currently in development. High-fidelity AR coming soon!");
                } else if (onLaunchAR) {
                    onLaunchAR();
                }
            }}
            className="group/ar flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-500 relative overflow-hidden"
            style={{
              background: 'rgba(34,211,238,0.1)',
              border: '1px solid rgba(34,211,238,0.3)',
              color: '#22d3ee',
              opacity: isSafari() ? 0.6 : 1,
              boxShadow: '0 0 20px rgba(34,211,238,0.15)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent translate-x-[-100%] group-hover/ar:translate-x-[100%] transition-transform duration-1000" />
            <Scan className="w-4 h-4 animate-pulse" />
            <span className="hidden sm:inline tracking-widest">{isSafari() ? 'iOS BETA' : 'ENGAGE AR'}</span>
            
            {/* Pulsing Core */}
            <span className="absolute inset-0 border border-cyan-400/20 rounded-xl animate-ping opacity-20 pointer-events-none" />
          </button>

          {/* User Node */}
          <button
            onClick={() => toggle('profile')}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-[10px] md:text-xs font-bold transition-all ml-1 relative overflow-hidden ${
                panel === 'profile' ? 'border-cyan-400 bg-cyan-900/40 text-white' : 'border-white/10 bg-white/5 text-cyan-400 hover:border-cyan-400/50'
            } border`}
          >
            {panel === 'profile' && <div className="absolute inset-0 hud-glow opacity-50" />}
            US
          </button>
        </div>
      </nav>

      {/* ── Slide-down panel backdrop ──────────────────────────────── */}
      {panel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setPanel(null)}
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ── LIBRARY panel ─────────────────────────────────────────── */}
      {panel === 'library' && (
        <SlidePanel title="CIRCUIT LIBRARY" accent="#a78bfa" icon="📚" onClose={() => setPanel(null)}>
          <LibrarySaveSection onSaved={() => { }} />
          <div className="my-1 border-t border-slate-800" />
          {circuits.length === 0 ? (
            <EmptyState icon="📭" msg="No circuits saved yet. Use the Save button above!" />
          ) : circuits.map((c: any) => (
            <LibraryCard key={c.id} circuit={c}
              onLoad={() => loadCircuit(c)}
              onDelete={() => { deleteCircuit(c.id); toast.info('Deleted from library'); }}
              onRename={(name: string) => renameCircuit(c.id, name)}
            />
          ))}
        </SlidePanel>
      )}


      {/* ── PROJECTS panel ────────────────────────────────────────── */}
      {panel === 'projects' && (
        <SlidePanel title="PROJECTS" accent="#4ade80" icon="📁" onClose={() => setPanel(null)}>
          <EmptyState icon="🚧" msg="Project management coming in v2.1 — Save circuits to Library for now!" />
        </SlidePanel>
      )}

      {/* ── SETTINGS panel ────────────────────────────────────────── */}
      {panel === 'settings' && (
        <SlidePanel title="SETTINGS" accent="#f59e0b" icon="⚙️" onClose={() => setPanel(null)}>
          <SettingsContent />
        </SlidePanel>
      )}

      {/* ── PROFILE panel ─────────────────────────────────────────── */}
      {panel === 'profile' && (
        <SlidePanel title="PROFILE" accent="#22d3ee" icon="👤" onClose={() => setPanel(null)}>
          <ProfileContent circuits={circuits} />
        </SlidePanel>
      )}
    </>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SlidePanel({ title, accent, icon, onClose, children }: {
  title: string; accent: string; icon: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className="fixed top-16 right-0 bottom-0 z-50 w-[420px] flex flex-col overflow-hidden"
      style={{
        background: 'rgba(6,9,20,0.97)',
        borderLeft: `1px solid ${accent}33`,
        boxShadow: `-8px 0 40px rgba(0,0,0,0.6), -2px 0 20px ${accent}11`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-mono font-bold tracking-widest" style={{ color: accent }}>{title}</span>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

function LibrarySaveSection({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const components = usePhysicsStore((s: any) => s.components);
  const wires = usePhysicsStore((s: any) => s.wires);
  const saveCircuit = useLibraryStore((s: any) => s.saveCircuit);
  const hasContent = components.length > 0;

  const handle = () => {
    if (!hasContent) return;
    const finalName = name.trim() || `Circuit ${new Date().toLocaleTimeString()}`;
    saveCircuit(finalName, components, wires);
    setName('');
    toast.success(`💾 Saved "${finalName}" to library`);
    onSaved();
  };

  return (
    <div className="rounded-xl p-3 border border-slate-800 flex flex-col gap-2"
      style={{ background: 'rgba(15,23,42,0.7)' }}>
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">💾 Save Current Circuit</p>
      {hasContent
        ? <p className="text-[11px] text-slate-400">{components.length} components · {wires.length} wires on board</p>
        : <p className="text-[11px] text-slate-600 italic">No circuit on board yet</p>
      }
      <div className="flex gap-2">
        <input
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500 transition-colors"
          placeholder="Circuit name (optional)…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
          disabled={!hasContent}
        />
        <button onClick={handle} disabled={!hasContent}
          className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-all disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg,#6d28d9,#7c3aed)', color: '#fff', boxShadow: hasContent ? '0 0 10px #7c3aed44' : 'none' }}>
          Save
        </button>
      </div>
      {/* Import from file */}
      <button
        onClick={async () => {
          const circuit = await importCircuitFromFile();
          if (!circuit) return;
          useLibraryStore.getState().importCircuit(circuit);
          toast.success(`📥 Imported "${circuit.name}" from file`);
        }}
        className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-mono text-slate-400 border border-slate-700 hover:border-cyan-500/50 hover:text-cyan-400 transition-all"
      >
        📂 Import from File (.fluxboard.json)
      </button>
    </div>
  );
}

function LibraryCard({ circuit, onLoad, onDelete, onRename }: {
  circuit: any; onLoad: () => void; onDelete: () => void; onRename: (n: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(circuit.name);

  const commit = () => { onRename(name); setEditing(false); };

  return (
    <div className="rounded-xl p-3 border border-slate-800 hover:border-violet-500/40 transition-all group"
      style={{ background: 'rgba(15,23,42,0.7)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onBlur={commit} onKeyDown={e => e.key === 'Enter' && commit()}
              className="w-full bg-slate-800 border border-violet-500/50 rounded-lg px-2 py-0.5 text-sm text-slate-200 outline-none" />
          ) : (
            <button onClick={() => setEditing(true)}
              className="text-sm font-mono text-slate-200 group-hover:text-violet-300 text-left truncate w-full transition-colors" title="Click to rename">
              {circuit.name}
            </button>
          )}
          <p className="text-[10px] text-slate-500 mt-0.5">
            {circuit.components.length} components · {circuit.wires.length} wires · {new Date(circuit.savedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={onLoad}
            className="px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
            Load
          </button>
          <button
            onClick={() => exportCircuitToFile(circuit).then(() => toast.success(`⬇️ Exported "${circuit.name}"`))}
            className="px-2 py-1 text-[11px] rounded-lg text-cyan-400 border border-cyan-900/30 hover:border-cyan-500/60 transition-all"
            title="Export to file">
            ⬇️
          </button>
          <button onClick={onDelete}
            className="px-2 py-1 text-[11px] rounded-lg text-red-400 border border-red-900/30 hover:border-red-500/50 transition-all">
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsContent() {
  const [theme, setTheme] = useState('dark');
  const [gridSnap, setGridSnap] = useState(true);
  const [wireGlow, setWireGlow] = useState(true);

  const toggle = (setter: any, val: boolean) => setter(!val);

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>⚡ Appearance</SectionLabel>
      <SettingRow label="Theme" value={<select value={theme} onChange={e => setTheme(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none">
        <option value="dark">Dark (Neon)</option>
        <option value="midnight">Midnight</option>
      </select>} />

      <SectionLabel>🔧 Board</SectionLabel>
      <SettingRow label="Grid Snap" value={<Toggle on={gridSnap} onClick={() => toggle(setGridSnap, gridSnap)} />} />
      <SettingRow label="Wire Glow" value={<Toggle on={wireGlow} onClick={() => toggle(setWireGlow, wireGlow)} />} />

      <SectionLabel>🧪 Simulation</SectionLabel>
      <SettingRow label="SPICE Engine" value={<span className="text-xs font-mono text-lime-400">ngspice.wasm ✓</span>} />
      <SettingRow label="AI Model" value={<span className="text-xs font-mono text-cyan-400">gemini-3-flash</span>} />

      <div className="mt-4 pt-4 border-t border-slate-800">
        <button
          onClick={() => { usePhysicsStore.setState({ components: [], wires: [] }); toast.info('Board cleared'); }}
          className="w-full py-2 rounded-xl text-xs font-mono text-red-400 border border-red-900/40 hover:border-red-500/60 transition-all">
          🗑 Clear Board
        </button>
      </div>
    </div>
  );
}

function ProfileContent({ circuits }: { circuits: any[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800"
        style={{ background: 'rgba(15,23,42,0.7)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{ background: 'linear-gradient(135deg,#0e7490,#06b6d4)', border: '2px solid #22d3ee55' }}>
          US
        </div>
        <div>
          <p className="text-sm font-mono font-bold text-slate-200">FluxBoard User</p>
          <p className="text-xs text-slate-500">Admin · FluxBoard v2.0</p>
        </div>
      </div>

      <SectionLabel>📊 Session Stats</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Saved Circuits', val: circuits.length, color: '#a78bfa' },
          { label: 'Total Components', val: circuits.reduce((a, c) => a + c.components.length, 0), color: '#22d3ee' },
          { label: 'Total Wires', val: circuits.reduce((a, c) => a + c.wires.length, 0), color: '#4ade80' },
          { label: 'AI Model', val: '3-flash', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border border-slate-800 flex flex-col gap-1"
            style={{ background: 'rgba(15,23,42,0.7)' }}>
            <span className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.val}</span>
            <span className="text-[10px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-xs text-slate-500 font-mono max-w-[260px] leading-relaxed">{msg}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">{children}</p>;
}


function SettingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-800"
      style={{ background: 'rgba(15,23,42,0.6)' }}>
      <span className="text-xs text-slate-300 font-mono">{label}</span>
      {value}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-9 h-5 rounded-full relative transition-all duration-300 flex-shrink-0"
      style={{ background: on ? '#0891b2' : '#1e293b', border: `1px solid ${on ? '#22d3ee55' : '#334155'}` }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: on ? '17px' : '1px' }} />
    </button>
  );
}
