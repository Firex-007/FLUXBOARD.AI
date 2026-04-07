import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900/40 backdrop-blur rounded-3xl border border-white/5">
          <p className="text-sm font-mono tracking-widest mb-2">3D RENDER FAILURE</p>
          <p className="text-[10px] text-red-400 font-mono mb-4 px-2 py-1 bg-red-400/10 rounded border border-red-400/20 max-w-full truncate">
            {this.state.error?.message}
          </p>
          <p className="text-xs max-w-xs leading-relaxed">
            Please ensure you are using a Chromium-based browser (Chrome/Android) for the best experience.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
