import { Upload, Download, Move, X } from 'lucide-react';

export default function Header({ file, onFileChange, onExportPDF, onCloseFile }) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 p-2 rounded-lg">
          <Move className="text-white w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">HVAC Helper</h1>
      </div>
      
      <div className="flex items-center gap-3">
        {!file ? (
          <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm">
            <Upload size={18} />
            <span>Load PDF</span>
            <input type="file" accept=".pdf" className="hidden" onChange={onFileChange} />
          </label>
        ) : (
          <>
            <button 
              onClick={onExportPDF}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Download size={18} />
              <span>Export Plan</span>
            </button>
            <button 
              onClick={onCloseFile}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close Document"
            >
              <X size={20} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
