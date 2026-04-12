import { MousePointer2, PlusCircle, Hexagon, ChevronUp, ChevronDown } from 'lucide-react';

export default function Toolbar({ tool, setTool, pageNumber, numPages, setPageNumber }) {
  return (
    <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-4">
      <button 
        onClick={() => setTool('select')}
        className={`p-3 rounded-xl transition-all ${tool === 'select' ? 'bg-blue-100 text-blue-600 shadow-inner' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
        title="Select Tool"
      >
        <MousePointer2 size={24} />
      </button>
      <button 
        onClick={() => setTool('draw')}
        className={`p-3 rounded-xl transition-all ${tool === 'draw' ? 'bg-blue-100 text-blue-600 shadow-inner' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
        title="Draw Rectangle"
      >
        <PlusCircle size={24} />
      </button>
      <button 
        onClick={() => setTool('poly')}
        className={`p-3 rounded-xl transition-all ${tool === 'poly' ? 'bg-blue-100 text-blue-600 shadow-inner' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
        title="Draw Polygon"
      >
        <Hexagon size={24} />
      </button>
      <div className="w-8 h-px bg-slate-100 my-2" />
      <div className="flex flex-col gap-1 items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Page</span>
        <div className="flex flex-col items-center gap-1">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(prev => prev - 1)}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronUp size={14} />
          </button>
          <span className="text-sm font-bold bg-slate-100 px-2 py-0.5 rounded text-blue-600">{pageNumber}</span>
          <button 
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(prev => prev + 1)}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <span className="text-[10px] text-slate-400">of {numPages || '?'}</span>
      </div>
    </div>
  );
}
