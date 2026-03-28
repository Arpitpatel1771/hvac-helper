import React, { useState, useRef, useEffect } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import { Stage, Layer, Rect, Transformer, Text, Group, Line } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { Upload, Download, Trash2, Edit3, Move, MousePointer2, PlusCircle, X, ChevronUp, ChevronDown, Hexagon } from 'lucide-react';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Default colors for sections
const SECTION_COLORS = [
  'rgba(59, 130, 246, 0.4)', // Blue
  'rgba(16, 185, 129, 0.4)', // Green
  'rgba(245, 158, 11, 0.4)', // Amber
  'rgba(239, 68, 68, 0.4)',  // Red
  'rgba(139, 92, 246, 0.4)', // Violet
];

function App() {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select'); // select, draw, poly
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRect, setNewRect] = useState(null);
  const [newPoly, setNewPoly] = useState(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);

  const containerRef = useRef(null);
  const transformerRef = useRef(null);

  // Handle file upload
  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setPageNumber(1);
      setSections([]);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = (page) => {
    const { width, height } = page.getViewport({ scale: 1 });
    setPageSize({ width, height });
    
    // Scale to fit container
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 40; // padding
      setScale(containerWidth / width);
    }
  };

  // Konva drawing logic
  const handleMouseDown = (e) => {
    if (tool === 'draw') {
      const pos = e.target.getStage().getPointerPosition();
      setIsDrawing(true);
      setNewRect({
        id: uuidv4(),
        type: 'rect',
        x: pos.x / scale,
        y: pos.y / scale,
        width: 0,
        height: 0,
        name: `Section ${sections.length + 1}`,
        color: SECTION_COLORS[sections.length % SECTION_COLORS.length],
        page: pageNumber,
      });
    } else if (tool === 'poly') {
      const pos = e.target.getStage().getPointerPosition();
      const x = pos.x / scale;
      const y = pos.y / scale;

      if (!newPoly) {
        setNewPoly({
          id: uuidv4(),
          type: 'polygon',
          x: 0,
          y: 0,
          points: [x, y],
          name: `Section ${sections.length + 1}`,
          color: SECTION_COLORS[sections.length % SECTION_COLORS.length],
          page: pageNumber,
        });
      } else {
        // Points are absolute when drawing, we'll keep them as is for now
        // and handle relative conversion when finalizing if needed, 
        // but it's simpler to keep them absolute and x,y = 0 initially.
        const startX = newPoly.points[0];
        const startY = newPoly.points[1];
        const dist = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));

        if (dist < 10 / scale && newPoly.points.length >= 6) {
          // Close polygon (need at least 3 points, which is 6 coordinates)
          setSections([...sections, newPoly]);
          setSelectedId(newPoly.id);
          setNewPoly(null);
          setTool('select');
        } else {
          setNewPoly({
            ...newPoly,
            points: [...newPoly.points, x, y],
          });
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    if (isDrawing && tool === 'draw') {
      setNewRect(prev => ({
        ...prev,
        width: (pos.x / scale) - prev.x,
        height: (pos.y / scale) - prev.y,
      }));
    } else if (tool === 'poly' && newPoly) {
      // Just for re-render if we want to show a preview line (optional but good)
      // For now, Konva will re-render if we update something
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || tool !== 'draw') return;

    if (Math.abs(newRect.width) > 5 && Math.abs(newRect.height) > 5) {
      // Normalize rectangle (handle negative width/height)
      const normalized = {
        ...newRect,
        type: 'rect',
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

  // Export to PDF
  const exportPDF = async () => {
    if (!file) return;
    console.log("Starting export for", sections.length, "sections");

    const existingPdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    sections.forEach((section, index) => {
      const page = pdfDoc.getPage(section.page - 1);
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const rotation = page.getRotation().angle;
      console.log(`Section ${index}: ${section.name}, Page: ${section.page}, Rotation: ${rotation}`);

      // Extract RGBA
      const rgbaMatch = section.color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      const [r, g, b, a] = rgbaMatch ? 
        [parseInt(rgbaMatch[1])/255, parseInt(rgbaMatch[2])/255, parseInt(rgbaMatch[3])/255, parseFloat(rgbaMatch[4])] : 
        [0.2, 0.5, 1, 0.4];

      // Helper for coordinate mapping
      const mapCoords = (vX, vY) => {
        // Corrected mapping for PDF-Lib native coordinates (0,0 bottom-left)
        // vs Visual coordinates (0,0 top-left) based on page rotation.
        if (rotation === 0) {
          return { x: vX, y: pdfHeight - vY };
        } else if (rotation === 90) {
          return { x: pdfWidth - vY, y: pdfHeight - vX };
        } else if (rotation === 180) {
          return { x: pdfWidth - vX, y: vY };
        } else if (rotation === 270) {
          return { x: vY, y: vX };
        }
        return { x: vX, y: pdfHeight - vY };
      };

      const getSvgPath = (points, groupX, groupY) => {
        const path = points.reduce((acc, curr, idx, arr) => {
          if (idx % 2 === 0) {
            const { x, y } = mapCoords(groupX + curr, groupY + arr[idx+1]);
            return acc + (idx === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
          }
          return acc;
        }, "") + " Z";
        return path;
      };

      if (section.type === 'polygon' || (!section.type && section.points)) {
        const svgPath = getSvgPath(section.points, section.x, section.y);
        console.log("Polygon Path:", svgPath);
        
        page.drawSvgPath(svgPath, {
          color: rgb(r, g, b),
          opacity: a,
        });

        const labelPos = mapCoords(section.x + section.points[0], section.y + section.points[1]);
        page.drawText(section.name, {
          x: labelPos.x + 5,
          y: labelPos.y - 15,
          size: 10,
          color: rgb(0, 0, 0),
          rotate: degrees(-rotation),
        });

      } else {
        const rectPoints = [0, 0, section.width, 0, section.width, section.height, 0, section.height];
        const svgPath = getSvgPath(rectPoints, section.x, section.y);
        console.log("Rect Path:", svgPath);

        page.drawSvgPath(svgPath, {
          color: rgb(r, g, b),
          opacity: a,
        });

        const labelPos = mapCoords(section.x, section.y);
        page.drawText(section.name, {
          x: labelPos.x + 5,
          y: labelPos.y - 15,
          size: 10,
          color: rgb(0, 0, 0),
          rotate: degrees(-rotation),
        });
      }
    });

    const pdfBytes = await pdfDoc.save();
    console.log("PDF Saved, size:", pdfBytes.length, "bytes");
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HVAC_Plan_${file.name}`;
    link.click();
  };

  // Selection transformer effect
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
      {/* Header */}
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
                onClick={exportPDF}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <Download size={18} />
                <span>Export Plan</span>
              </button>
              <button 
                onClick={() => setFile(null)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                title="Close Document"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {file ? (
          <>
            {/* Toolbar */}
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

            {/* Canvas Area */}
            <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center" ref={containerRef}>
              <div className="relative shadow-2xl" style={{ width: pageSize.width * scale, height: pageSize.height * scale }}>
                {/* PDF Layer */}
                <div className="absolute inset-0">
                  <Document file={file} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="p-10 text-center">Loading PDF...</div>}>
                    <Page 
                      pageNumber={pageNumber} 
                      scale={scale} 
                      onLoadSuccess={onPageLoadSuccess}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                  </Document>
                </div>

                {/* Drawing Layer */}
                <div className="absolute inset-0 z-10">
                  <Stage
                    width={pageSize.width * scale}
                    height={pageSize.height * scale}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onClick={(e) => {
                      if (e.target === e.target.getStage()) {
                        setSelectedId(null);
                      }
                    }}
                  >
                    <Layer>
                      {sections.filter(s => s.page === pageNumber).map((section) => (
                        <Group 
                          key={section.id}
                          id={section.id}
                          x={section.x * scale}
                          y={section.y * scale}
                          draggable={tool === 'select'}
                          onDragEnd={(e) => {
                            handleSectionChange(section.id, {
                              x: e.target.x() / scale,
                              y: e.target.y() / scale,
                            });
                          }}
                          onClick={() => tool === 'select' && setSelectedId(section.id)}
                          onTransformEnd={(e) => {
                            const node = e.target;
                            const scaleX = node.scaleX();
                            const scaleY = node.scaleY();
                            
                            // Reset scale as we'll apply it to width/height or points
                            node.scaleX(1);
                            node.scaleY(1);

                            if (section.type === 'rect') {
                              handleSectionChange(section.id, {
                                x: node.x() / scale,
                                y: node.y() / scale,
                                width: (node.width() * scaleX) / scale,
                                height: (node.height() * scaleY) / scale,
                              });
                            } else {
                              // For polygon, apply scale to the relative points
                              const newPoints = section.points.map((p, i) => {
                                return i % 2 === 0 ? (p * scaleX) : (p * scaleY);
                              });
                              handleSectionChange(section.id, {
                                x: node.x() / scale,
                                y: node.y() / scale,
                                points: newPoints
                              });
                            }
                          }}
                        >
                          {section.type === 'rect' ? (
                            <Rect
                              x={0}
                              y={0}
                              width={section.width * scale}
                              height={section.height * scale}
                              fill={section.color}
                              stroke={selectedId === section.id ? '#2563eb' : '#3b82f6'}
                              strokeWidth={selectedId === section.id ? 2 : 1}
                            />
                          ) : (
                            <Line
                              points={section.points.map(p => p * scale)}
                              fill={section.color}
                              stroke={selectedId === section.id ? '#2563eb' : '#3b82f6'}
                              strokeWidth={selectedId === section.id ? 2 : 1}
                              closed={true}
                            />
                          )}
                          <Text 
                            text={section.name}
                            x={section.type === 'rect' ? 5 : section.points[0] * scale + 5}
                            y={section.type === 'rect' ? 5 : section.points[1] * scale + 5}
                            fontSize={12 * scale}
                            fill="#000"
                          />
                        </Group>
                      ))}
                      
                      {newRect && (
                        <Rect
                          x={newRect.x * scale}
                          y={newRect.y * scale}
                          width={newRect.width * scale}
                          height={newRect.height * scale}
                          fill={newRect.color}
                          stroke="#3b82f6"
                          strokeWidth={1}
                          dash={[5, 5]}
                        />
                      )}

                      {newPoly && (
                        <Line
                          points={newPoly.points.map(p => p * scale)}
                          stroke="#3b82f6"
                          strokeWidth={1}
                          dash={[5, 5]}
                          closed={false}
                        />
                      )}
                      
                      {selectedId && tool === 'select' && (
                        <Transformer
                          ref={transformerRef}
                          rotateEnabled={false}
                          boundBoxFunc={(oldBox, newBox) => {
                            if (newBox.width < 5 || newBox.height < 5) {
                              return oldBox;
                            }
                            return newBox;
                          }}
                        />
                      )}
                    </Layer>
                  </Stage>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <Edit3 size={20} className="text-blue-500" />
                  Sections
                </h2>
                <p className="text-sm text-slate-500 mt-1">Manage drawing areas and labels</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {sections.filter(s => s.page === pageNumber).length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <PlusCircle className="text-slate-300" size={32} />
                    </div>
                    <p className="text-slate-400 text-sm">No sections on this page. Select the draw tool to begin.</p>
                  </div>
                ) : (
                  sections.filter(s => s.page === pageNumber).map((section) => (
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

export default App;
