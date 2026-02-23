import { Suspense } from "react";
import AnalysisContent from "./page";

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-4 border-white/5 border-t-[var(--primary)] rounded-full animate-spin shadow-[0_0_20px_var(--primary-glow)]"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 animate-pulse">
              Syncing Structural Kernel
            </p>
          </div>
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
