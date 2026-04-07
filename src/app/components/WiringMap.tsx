import { Share2, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

interface Connection {
  id: number;
  source: string;
  dest: string;
  type: string;
}

interface WiringMapProps {
  connections: Connection[];
}

import { Card } from '@/components/ui/card';

export function WiringMap({ connections }: WiringMapProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className="hud-glass rounded-2xl overflow-hidden h-full flex flex-col shadow-2xl relative group scan-effect">
        <div className="bg-cyan-500/5 p-4 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-cyan-400 font-bold text-sm tracking-widest flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 hud-glow" />
            Wiring Schematics
          </h3>
          <Dialog.Trigger asChild>
            <button className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-cyan-400 transition-all active:scale-95">
              <Maximize2 className="w-4 h-4" />
            </button>
          </Dialog.Trigger>
        </div>
        
        <div className="flex-1 overflow-auto hud-scroll p-0">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-black/40 sticky top-0 z-10 backdrop-blur-xl text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-bold">Source Node</th>
                <th className="px-6 py-4 font-bold">Target Node</th>
                <th className="px-6 py-4 font-bold text-right">Path</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300 font-bold text-[11px] tracking-tight">
              {connections.map((conn, index) => (
                <motion.tr 
                  key={conn.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, type: "spring", stiffness: 400, damping: 40 }}
                  className="hover:bg-cyan-500/5 transition-all group/row cursor-default"
                >
                  <td className="px-6 py-4 relative">
                    <span className="flex items-center gap-3 text-cyan-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></div>
                      {conn.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className="flex items-center gap-3 text-lime-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.6)]"></div>
                      {conn.dest}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2 py-1 rounded bg-white/5 border border-white/5 text-slate-500 group-hover/row:text-cyan-500/80 group-hover/row:border-cyan-500/20 transition-all font-mono">
                      {conn.type}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)]" style={{ backgroundSize: "32px 32px" }}></div>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-700 bg-slate-900 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
          <div className="flex flex-col gap-4 h-[80vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <Dialog.Title className="text-lg font-semibold text-lime-400 font-mono flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                FULL SCHEMATIC VIEW
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Detailed view of the wiring schematic connections
              </Dialog.Description>
              <Dialog.Close className="rounded-full p-2 hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
            
            <div className="flex-1 bg-slate-950/50 rounded-lg border border-slate-800 p-8 flex items-center justify-center relative overflow-hidden">
               {/* Placeholder for a real graph visualization */}
               <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-slate-950"></div>
               <div className="text-center">
                 <Share2 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                 <p className="text-slate-500 font-mono text-sm">Interactive Node Graph Visualization Placeholder</p>
                 <p className="text-slate-600 text-xs mt-2">Double-click nodes to edit pin assignments</p>
               </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
