"use client";

// Removed lucide-react to avoid dependency issues

export default function Modal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-500" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-7xl max-h-full overflow-hidden glassy-panel rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col animate-in zoom-in-95 fade-in duration-500 delay-100 border-white/5">
        <button
          onClick={onClose}
          className="absolute right-8 top-8 p-3 rounded-2xl hover:bg-white/5 text-gray-500 hover:text-white transition-all z-50 border border-transparent hover:border-white/10 active:scale-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
