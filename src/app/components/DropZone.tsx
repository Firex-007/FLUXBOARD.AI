import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileUp, Sparkles, X, CircuitBoard, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DropZoneProps {
  onGenerate: (prompt: string, imageBase64: string) => void;
}

import { Card } from '@/components/ui/card';

export function DropZone({ onGenerate }: DropZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    }
  }, []);

  const clearFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const handleGenerateClick = async () => {
    setIsGenerating(true);

    let base64 = "";
    if (file) {
      base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    try {
      await onGenerate(prompt, base64);
    } finally {
      setIsGenerating(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1
  });

  return (
    <Card className="h-full flex flex-col gap-4 p-4 bg-slate-900/80 backdrop-blur-xl border-slate-800 shadow-2xl relative">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-slate-200 font-semibold text-sm tracking-wide flex items-center gap-2">
          <PenTool className="w-4 h-4 text-cyan-400" />
          Schematic Input
        </h2>
        <span className="text-slate-500 text-xs font-medium">Auto-Upload Area</span>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          flex-1 rounded-xl border border-dashed transition-all duration-300 relative overflow-hidden group cursor-pointer
          ${isDragActive
            ? 'border-cyan-400 bg-cyan-400/5 shadow-[0_0_30px_rgba(34,211,238,0.1)]'
            : 'border-slate-700 hover:border-cyan-400/50 hover:bg-slate-800/30 bg-slate-900/50'
          }
        `}
      >
        <input {...getInputProps()} />

        <AnimatePresence>
          {!file ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full bg-slate-800/80 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-slate-700 group-hover:border-cyan-400/50">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              </div>
              <h3 className="text-xl font-medium text-slate-200 mb-2">Upload Schematic</h3>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                Drag and drop your hand-drawn circuit sketch here, or click to browse files.
              </p>
              <div className="mt-8 flex gap-4 opacity-50">
                <CircuitBoard className="w-12 h-12 text-slate-700" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 p-4 flex flex-col cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex-1 rounded-xl overflow-hidden border border-slate-700 bg-black/20 group/preview">
                {preview && (
                  <img
                    src={preview}
                    alt="Schematic preview"
                    className="w-full h-full object-contain p-4"
                  />
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    className="p-2 rounded-full bg-slate-900/80 text-slate-400 hover:text-red-400 hover:bg-slate-800 border border-slate-700 transition-colors shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-cyan-400 px-1">
                <span className="truncate max-w-[200px]">{file.name}</span>
                <span>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Prompt Input */}
      <div className="relative group mt-2">
        <div className={`absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl opacity-20 group-hover:opacity-40 blur transition duration-500 ${isGenerating ? 'animate-pulse opacity-60' : ''}`}></div>
        <div className="relative flex flex-col bg-slate-950 rounded-xl border border-slate-700 p-4">
          <label className="text-xs font-medium text-slate-300 tracking-wide mb-2 flex items-center gap-2">
            <Sparkles className={`w-3 h-3 text-cyan-400 ${isGenerating ? 'animate-spin' : ''}`} />
            AI Instructions
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder="Describe your circuit logic (e.g., 'Connect the ESP32 to the relay...')"
            className="w-full bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-600 resize-none h-24 text-sm leading-relaxed disabled:opacity-50"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleGenerateClick}
              disabled={isGenerating || (!file && !prompt)}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg border border-slate-700 hover:border-cyan-400/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-lg"
            >
              <FileUp className={`w-4 h-4 ${isGenerating ? 'animate-bounce text-cyan-400' : 'text-slate-400'}`} />
              {isGenerating ? 'Reasoning...' : 'Generate Circuit'}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
