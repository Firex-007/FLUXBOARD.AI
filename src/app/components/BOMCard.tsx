import { ArrowLeftRight, Settings, Plus, Trash2, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BOMItem {
  id: number;
  name: string;
  desc: string;
  type: string;
  stock: string;
}

interface BOMCardProps {
  items: BOMItem[];
  onDelete: (id: number) => void;
  onAdd: () => void;
  onSwap: (id: number) => void;
}

import { Card } from '@/components/ui/card';

export function BOMCard({ items, onDelete, onAdd, onSwap }: BOMCardProps) {
  return (
    <div className="hud-glass rounded-2xl overflow-hidden h-full flex flex-col shadow-2xl relative scan-effect">
      <div className="bg-cyan-500/5 p-4 border-b border-white/5 flex justify-between items-center relative">
        <h3 className="text-cyan-400 font-bold text-sm tracking-widest uppercase flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 hud-glow" />
          Bill of Materials
        </h3>
        <button className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-cyan-400 transition-all active:scale-95">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 hud-scroll space-y-3">
        <AnimatePresence>
          {items.map((item, index) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 30 }}
              className="hud-card-hover bg-white/5 border border-white/10 rounded-xl p-4 group relative overflow-hidden"
            >
              {/* Subtle background glow for each item */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="flex-1">
                  <div className="text-white font-bold text-sm flex items-center gap-3 flex-wrap">
                    {item.name}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      item.stock === 'Order' ? 'border-red-500/40 text-red-400 bg-red-500/10' : 
                      item.stock === 'Low Stock' ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' :
                      'border-cyan-500/40 text-cyan-400 bg-cyan-500/10'
                    }`}>
                      {item.stock}
                    </span>
                  </div>
                  <div className="text-slate-400 text-xs font-medium mt-1.5 opacity-80">{item.desc}</div>
                </div>
                <button 
                  onClick={() => onDelete(item.id)}
                  className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all active:scale-90"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5 relative z-10">
                <span className="text-[10px] text-cyan-500/80 font-bold uppercase tracking-widest bg-cyan-500/5 px-2.5 py-1 rounded-md border border-cyan-500/10">
                  {item.type}
                </span>
                <button 
                  onClick={() => onSwap(item.id)}
                  className="group/btn flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-400/50 rounded-lg text-[11px] font-bold text-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-900/20"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 group-hover/btn:rotate-180 transition-transform duration-700" />
                  OPTIMIZE
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      <div className="p-4 border-t border-white/5 bg-black/20">
        <button 
          onClick={onAdd}
          className="w-full py-3 border border-dashed border-white/10 hover:border-cyan-400/50 text-slate-500 hover:text-cyan-400 rounded-xl flex items-center justify-center gap-3 transition-all text-[11px] font-bold uppercase tracking-widest active:scale-[0.98] group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
          Add Node
        </button>
      </div>
    </div>
  );
}
