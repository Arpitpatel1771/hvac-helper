import { useState, useRef, useEffect } from 'react';
import { pdfjs } from 'react-pdf';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { Upload } from 'lucide-react';

// Components
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';
import SectionSidebar from './components/SectionSidebar';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Section colors as objects for easier PDF export mapping
const SECTION_COLORS = [
  { r: 59, g: 130, b: 246, a: 0.4, string: 'rgba(59, 130, 246, 0.4)' }, // Blue
  { r: 16, g: 185, b: 129, a: 0.4, string: 'rgba(16, 185, 129, 0.4)' }, // Green
  { r: 245, g: 158, b: 11, a: 0.4, string: 'rgba(245, 158, 11, 0.4)' }, // Amber
  { r: 239, g: 68, b: 68, a: 0.4, string: 'rgba(239, 68, 68, 0.4)' },  // Red
  { r: 139, g: 92, b: 246, a: 0.4, string: 'rgba(139, 92, 246, 0.4)' }, // Violet
];

export default function App() {
  // Document State
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);

  // Drawing State
  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select'); // select, draw, poly
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRect, setNewRect] = useState(null);
  const [newPoly, setNewPoly] = useState(null);

  const containerRef = useRef(null);
  const transformerRef = useRef(null);

  // File Handlers
  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setPageNumber(1);
      setSections([]);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);

  const onPageLoadSuccess = (page) => {
    const { width, height } = page.getViewport({ scale: 1 });
    setPageSize({ width, height });
    
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 40;
      setScale(containerWidth / width);
    }
  };

  // Drawing Logic
  const handleMouseDown = (e) => {
    if (tool === 'draw') {
      const pos = e.target.getStage().getPointerPosition();
      setIsDrawing(true);
      const colorObj = SECTION_COLORS[sections.length % SECTION_COLORS.length];
      setNewRect({
        id: uuidv4(),
        type: 'rect',
        x: pos.x / scale,
        y: pos.y / scale,
        width: 0,
        height: 0,
        name: `Section ${sections.length + 1}`,
        color: colorObj.string,
        colorData: colorObj,
        page: pageNumber,
      });
    } else if (tool === 'poly') {
      const pos = e.target.getStage().getPointerPosition();
      const x = pos.x / scale;
      const y = pos.y / scale;

      if (!newPoly) {
        const colorObj = SECTION_COLORS[sections.length % SECTION_COLORS.length];
        setNewPoly({
          id: uuidv4(),
          type: 'polygon',
          x: 0,
          y: 0,
          points: [x, y],
          name: `Section ${sections.length + 1}`,
          color: colorObj.string,
          colorData: colorObj,
          page: pageNumber,
        });
      } else {
        const startX = newPoly.points[0];
        const startY = newPoly.points[1];
        const dist = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));

        if (dist < 10 / scale && newPoly.points.length >= 6) {
          setSections([...sections, newPoly]);
          setSelectedId(newPoly.id);
          setNewPoly(null);
          setTool('select');
        } else {
          setNewPoly({ ...newPoly, points: [...newPoly.points, x, y] });
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isDrawing && tool === 'draw') {
      const pos = e.target.getStage().getPointerPosition();
      setNewRect(prev => ({
        ...prev,
        width: (pos.x / scale) - prev.x,
        height: (pos.y / scale) - prev.y,
      }));
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || tool !== 'draw') return;

    if (Math.abs(newRect.width) > 5 && Math.abs(newRect.height) > 5) {
      const normalized = {
        ...newRect,
        x: newRect.width < 0 ? newRect.x + newRect.width : newRect.x,
        y: newRect.height < 0 ? newRect.y + newRect.height : newRect.y,
        width: Math.abs(newRect.width),
        height: Math.abs(newRect.height),
      };
      setSections([...sections, normalized]);
      setSelectedId(normalized.id);
    }
    
    setIsDrawing(false);
    setNewRect(null);
    setTool('select');
  };

  const handleSectionChange = (id, newAttrs) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...newAttrs } : s));
  };

  const deleteSection = (id) => {
    setSections(sections.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // PDF Export Logic
  const exportPDF = async () => {
    if (!file) return;

    const existingPdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    sections.forEach((section) => {
      const page = pdfDoc.getPage(section.page - 1);
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const rotation = page.getRotation().angle;

      const { r, g, b, a } = section.colorData || { r: 59, g: 130, b: 246, a: 0.4 };

      // Helper for coordinate mapping (Visual Top-Left -> PDF Bottom-Left)
      const mapCoords = (vX, vY) => {
        if (rotation === 0) return { x: vX, y: pdfHeight - vY };
        if (rotation === 90) return { x: pdfWidth - vY, y: pdfHeight - vX };
        if (rotation === 180) return { x: pdfWidth - vX, y: vY };
        if (rotation === 270) return { x: vY, y: vX };
        return { x: vX, y: pdfHeight - vY };
      };

      const getSvgPath = (points, groupX, groupY) => {
        return points.reduce((acc, curr, idx, arr) => {
          if (idx % 2 === 0) {
            const { x, y } = mapCoords(groupX + curr, groupY + arr[idx+1]);
            return acc + (idx === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
          }
          return acc;
        }, "") + " Z";
      };

      const drawShape = (points, x, y, label) => {
        const svgPath = getSvgPath(points, x, y);
        page.drawSvgPath(svgPath, { color: rgb(r/255, g/255, b/255), opacity: a });
        
        const labelPos = mapCoords(x + points[0], y + points[1]);
        page.drawText(label, {
          x: labelPos.x + 5,
          y: labelPos.y - 15,
          size: 10,
          color: rgb(0, 0, 0),
          rotate: degrees(-rotation),
        });
      };

      if (section.type === 'polygon') {
        drawShape(section.points, section.x, section.y, section.name);
      } else {
        const rectPoints = [0, 0, section.width, 0, section.width, section.height, 0, section.height];
        drawShape(rectPoints, section.x, section.y, section.name);
      }
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HVAC_Plan_${file.name}`;
    link.click();
  };

  // Selection Transformer
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const selectedNode = transformerRef.current.getStage().findOne(`#${selectedId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      <Header 
        file={file} 
        onFileChange={onFileChange} 
        onExportPDF={exportPDF} 
        onCloseFile={() => setFile(null)} 
      />

      <main className="flex-1 flex overflow-hidden">
        {file ? (
          <>
            <Toolbar 
              tool={tool} 
              setTool={setTool} 
              pageNumber={pageNumber} 
              numPages={numPages} 
              setPageNumber={setPageNumber} 
            />

            <CanvasArea 
              file={file}
              pageNumber={pageNumber}
              scale={scale}
              pageSize={pageSize}
              sections={sections}
              selectedId={selectedId}
              tool={tool}
              newRect={newRect}
              newPoly={newPoly}
              containerRef={containerRef}
              transformerRef={transformerRef}
              onDocumentLoadSuccess={onDocumentLoadSuccess}
              onPageLoadSuccess={onPageLoadSuccess}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
              handleSectionChange={handleSectionChange}
              setSelectedId={setSelectedId}
            />

            <SectionSidebar 
              sections={sections}
              pageNumber={pageNumber}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              setTool={setTool}
              deleteSection={deleteSection}
              handleSectionChange={handleSectionChange}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
            <div className="max-w-md">
              <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center">
                <div className="bg-blue-50 p-6 rounded-full mb-6">
                  <Upload className="text-blue-600 w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to HVAC Helper</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  Start by uploading a floor plan PDF to begin defining your sections and layout.
                </p>
                <label className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl cursor-pointer transition-all shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]">
                  <Upload size={20} />
                  <span>Choose PDF File</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={onFileChange} />
                </label>
                <p className="mt-6 text-xs text-slate-400 uppercase tracking-widest font-semibold">
                  Secure & Private Local Editing
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
