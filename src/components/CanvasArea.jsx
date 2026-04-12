import { Document, Page } from 'react-pdf';
import { Stage, Layer, Rect, Transformer, Text, Group, Line } from 'react-konva';

export default function CanvasArea({ 
  file, 
  pageNumber, 
  scale, 
  pageSize, 
  sections, 
  selectedId, 
  tool, 
  newRect, 
  newPoly, 
  containerRef, 
  transformerRef,
  onDocumentLoadSuccess,
  onPageLoadSuccess,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleSectionChange,
  setSelectedId
}) {
  const pageSections = sections.filter(s => s.page === pageNumber);

  return (
    <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center" ref={containerRef}>
      <div className="relative shadow-2xl" style={{ width: pageSize.width * scale, height: pageSize.height * scale }}>
        {/* PDF Layer */}
        <div className="absolute inset-0">
          <Document file={file} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="p-10 text-center text-slate-500 font-medium">Loading PDF...</div>}>
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
              {pageSections.map((section) => (
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
  );
}
