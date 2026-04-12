import { Edit3, Trash2, PlusCircle } from 'lucide-react';

export default function SectionSidebar({ sections, pageNumber, selectedId, setSelectedId, setTool, deleteSection, handleSectionChange }) {
  const pageSections = sections.filter(s => s.page === pageNumber);

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
          <Edit3 size={20} className="text-blue-500" />
          Sections
        </h2>
        <p className="text-sm text-slate-500 mt-1">Manage drawing areas and labels</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pageSections.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="text-slate-300" size={32} />
            </div>
            <p className="text-slate-400 text-sm">No sections on this page. Select the draw tool to begin.</p>
          </div>
        ) : (
          pageSections.map((section) => (
            <div 
              key={section.id}
              onClick={() => {
                setSelectedId(section.id);
                setTool('select');
              }}
              className={`group p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedId === section.id ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="w-4 h-4 rounded-sm" 
                  style={{ backgroundColor: section.color }}
                />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSection(section.id);
                  }}
                  className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <input 
                type="text"
                value={section.name}
                onChange={(e) => handleSectionChange(section.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent font-bold text-slate-800 border-b border-transparent focus:border-blue-300 focus:outline-none py-1"
                placeholder="Section name..."
              />
              <div className="flex gap-3 mt-2 text-[10px] font-mono text-slate-400">
                {section.type === 'rect' ? (
                  <>
                    <span>X: {Math.round(section.x)}</span>
                    <span>Y: {Math.round(section.y)}</span>
                    <span>W: {Math.round(section.width)}</span>
                    <span>H: {Math.round(section.height)}</span>
                  </>
                ) : (
                  <span>Points: {section.points.length / 2}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
