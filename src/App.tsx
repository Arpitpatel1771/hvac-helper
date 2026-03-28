import { useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

type Rect = {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

type PageSize = {
  width: number;
  height: number;
};

const palette = [
  '#ff6b6b',
  '#4dabf7',
  '#ffd43b',
  '#63e6be',
  '#b197fc',
  '#ff922b',
  '#74c0fc',
  '#ff8787',
];

const getColor = (index: number) => palette[index % palette.length];

function App() {
  const [pdfArray, setPdfArray] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [rectangles, setRectangles] = useState<Rect[]>([]);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const pageRects = useMemo(
    () => rectangles.filter((r) => r.pageNumber === selectedPage),
    [rectangles, selectedPage],
  );

  useEffect(() => {
    if (!pdfDoc) return;
    const renderPage = async () => {
      const page = await pdfDoc.getPage(selectedPage);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ width: viewport.width, height: viewport.height });
      setPageSizes((prev) => ({
        ...prev,
        [selectedPage]: { width: viewport.width, height: viewport.height },
      }));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const renderContext = {
        canvasContext: ctx,
        viewport,
        canvas,
      };
      await page.render(renderContext).promise;
    };

    renderPage();
  }, [pdfDoc, selectedPage]);

  const loadFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const document = await getDocument({ data }).promise;
    setPdfArray(data);
    setPdfDoc(document);
    setNumPages(document.numPages);
    setSelectedPage(1);
    setRectangles([]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadFile(file);
    }
  };

  const startDrawing = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!overlayRef.current || !pageSize) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const color = getColor(rectangles.length);
    const newRect: Rect = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      pageNumber: selectedPage,
      x,
      y,
      width: 0,
      height: 0,
      color,
    };
    setCurrentRect(newRect);
    setIsDrawing(true);
  };

  const updateDrawing = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!isDrawing || !currentRect || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x2 = event.clientX - rect.left;
    const y2 = event.clientY - rect.top;
    const x1 = currentRect.x;
    const y1 = currentRect.y;
    const newX = Math.min(x1, x2);
    const newY = Math.min(y1, y2);
    const newWidth = Math.abs(x2 - x1);
    const newHeight = Math.abs(y2 - y1);
    setCurrentRect({ ...currentRect, x: newX, y: newY, width: newWidth, height: newHeight });
  };

  const finishDrawing = () => {
    if (!currentRect) return;
    if (currentRect.width > 5 && currentRect.height > 5) {
      setRectangles([...rectangles, currentRect]);
    }
    setCurrentRect(null);
    setIsDrawing(false);
  };

  const removeRect = (id: string) => {
    setRectangles(rectangles.filter((rect) => rect.id !== id));
  };

  const downloadPdf = async () => {
    if (!pdfArray) {
      console.warn('No PDF loaded to save.');
      return;
    }

    console.log('Saving PDF with rectangles:', rectangles);

    try {
      const libDoc = await PDFDocument.load(pdfArray);
      for (const rect of rectangles) {
        const page = libDoc.getPage(rect.pageNumber - 1);
        const { width: pageWidth, height: pageHeight } = page.getSize();
        const targetSize = pageSizes[rect.pageNumber];
        if (!targetSize) {
          console.warn(`Missing page size for page ${rect.pageNumber}. Skipping rectangle.`);
          continue;
        }

        const scaleX = pageWidth / targetSize.width;
        const scaleY = pageHeight / targetSize.height;
        const x = rect.x * scaleX;
        const y = (targetSize.height - rect.y - rect.height) * scaleY;
        const width = rect.width * scaleX;
        const height = rect.height * scaleY;
        const [r, g, b] = hexToRgb(rect.color);
        if (r === null) {
          console.warn(`Invalid color for rectangle ${rect.id}. Skipping.`);
          continue;
        }

        page.drawRectangle({
          x,
          y,
          width,
          height,
          borderColor: rgb(r, g, b),
          borderWidth: 2,
          color: rgb(r, g, b),
          opacity: 0.2,
        });
      }

      const pdfBytes = await libDoc.save();
      const arrayBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength,
      );
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = 'annotated.pdf';
      document.body.appendChild(link);
      if (typeof link.click === 'function') {
        link.click();
      } else {
        window.open(url, '_blank');
      }
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to save PDF:', error);
      alert('Unable to save PDF. Check the browser console for details.');
    }
  };

  const hexToRgb = (hex: string): [number, number, number] | [null, null, null] => {
    const sanitized = hex.replace('#', '');
    if (sanitized.length !== 6) return [null, null, null];
    const bigint = parseInt(sanitized, 16);
    return [(bigint >> 16 & 255) / 255, (bigint >> 8 & 255) / 255, (bigint & 255) / 255];
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>PDF Zone Editor</h1>
        <label className="file-input">
          Select PDF
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
        </label>
        {pdfDoc && (
          <>
            <div className="page-picker">
              <span>Page</span>
              <select value={selectedPage} onChange={(e) => setSelectedPage(Number(e.target.value))}>
                {Array.from({ length: numPages }, (_, index) => (
                  <option key={index + 1} value={index + 1}>{`Page ${index + 1}`}</option>
                ))}
              </select>
            </div>
            <button className="save-button" onClick={downloadPdf}>Save new PDF</button>
            <div className="zone-list">
              <h2>Zones</h2>
              {pageRects.length === 0 ? (
                <p>No zones yet. Drag on the page.</p>
              ) : (
                <ul>
                  {pageRects.map((rect, index) => (
                    <li key={rect.id} style={{ borderLeft: `4px solid ${rect.color}` }}>
                      <strong>Zone {index + 1}</strong>
                      <button onClick={() => removeRect(rect.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        <p className="hint">Draw rectangles on the page to define zones. Save as a new PDF when ready.</p>
      </aside>

      <main className="canvas-area">
        <div className="canvas-frame">
          <canvas ref={canvasRef} className="pdf-canvas" />
          <div
            ref={overlayRef}
            className="overlay"
            onMouseDown={startDrawing}
            onMouseMove={updateDrawing}
            onMouseUp={finishDrawing}
            onMouseLeave={finishDrawing}
          >
            {pageRects.map((rect) => (
              <div
                key={rect.id}
                className="rectangle"
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                  borderColor: rect.color,
                }}
              />
            ))}
            {currentRect && (
              <div
                className="rectangle drawing"
                style={{
                  left: currentRect.x,
                  top: currentRect.y,
                  width: currentRect.width,
                  height: currentRect.height,
                  borderColor: currentRect.color,
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
