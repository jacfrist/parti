import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MousePointer2, 
  PenTool, 
  PaintBucket, 
  Eraser, 
  Download, 
  Undo2, 
  Redo2, 
  Settings2,
  Grid3X3,
  Trash2,
  Square,
  Circle,
  Spline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// --- Types ---

type Point = { x: number; y: number };

type ElementType = "poly" | "rect" | "circle" | "spline";

interface BaseElement {
  id: string;
  type: ElementType;
  selected?: boolean;
}

interface PolyElement extends BaseElement {
  type: "poly";
  points: Point[];
  fillColor: string; // Can be a pattern ID or "none"
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  isClosed: boolean;
  isArrow?: boolean;
}

interface RectElement extends BaseElement {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

interface CircleElement extends BaseElement {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

interface SplineElement extends BaseElement {
  type: "spline";
  points: Point[]; // Array of control points
  strokeColor: string;
  strokeWidth: number;
  isArrow?: boolean;
  fillColor: string; // Added fill capability
  opacity: number;
}

type CanvasElement = PolyElement | RectElement | CircleElement | SplineElement;

type Tool = "select" | "pen" | "spline" | "eraser" | "rect" | "circle";

// --- Utils ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const distance = (a: Point, b: Point) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

const SNAP_RADIUS = 10;

// --- Components ---

const Toolbar = ({ 
  activeTool, 
  setTool, 
  onUndo, 
  onRedo, 
  canUndo, 
  canRedo,
  onClear
}: { 
  activeTool: Tool, 
  setTool: (t: Tool) => void,
  onUndo: () => void,
  onRedo: () => void,
  canUndo: boolean,
  canRedo: boolean,
  onClear: () => void
}) => (
  <motion.div 
    initial={{ x: -50, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    className="fixed left-4 top-1/2 -translate-y-1/2 bg-card border border-border shadow-xl p-2 flex flex-col gap-2 z-50 rounded-lg"
  >
    <div className="flex flex-col gap-1">
      <Button
        variant={activeTool === "select" ? "default" : "ghost"}
        size="icon"
        onClick={() => setTool("select")}
        title="Select & Move (V)"
      >
        <MousePointer2 className="h-5 w-5" />
      </Button>
      <Button
        variant={activeTool === "pen" ? "default" : "ghost"}
        size="icon"
        onClick={() => setTool("pen")}
        title="Pen / Line Tool (P)"
      >
        <PenTool className="h-5 w-5" />
      </Button>
      <Button
        variant={activeTool === "spline" ? "default" : "ghost"}
        size="icon"
        onClick={() => setTool("spline")}
        title="Spline Tool (S)"
      >
        <Spline className="h-5 w-5" />
      </Button>
      <Button
        variant={activeTool === "eraser" ? "default" : "ghost"}
        size="icon"
        onClick={() => setTool("eraser")}
        title="Eraser (E)"
      >
        <Eraser className="h-5 w-5" />
      </Button>
    </div>
    
    <Separator />
    
    <div className="flex flex-col gap-1">
      <Button
        variant={activeTool === "rect" ? "default" : "ghost"}
        size="icon"
        onClick={() => setTool("rect")}
        title="Rectangle"
      >
        <Square className="h-5 w-5" />
      </Button>
      <Button
        variant={activeTool === "circle" ? "default" : "ghost"}
        size="icon"
        onClick={() => setTool("circle")}
        title="Circle"
      >
        <Circle className="h-5 w-5" />
      </Button>
    </div>

    <Separator />
    
    <div className="flex flex-col gap-1">
      <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <Redo2 className="h-5 w-5" />
      </Button>
    </div>
    <Separator />
    <Button variant="ghost" size="icon" onClick={onClear} className="text-destructive hover:text-destructive" title="Clear All">
      <Trash2 className="h-5 w-5" />
    </Button>
  </motion.div>
);

const PropertiesPanel = ({
  settings,
  updateSettings,
  selectedElements,
  updateElement,
  position,
  onPositionChange
}: {
  settings: any,
  updateSettings: (k: string, v: any) => void,
  selectedElements: CanvasElement[],
  updateElement: (id: string, props: Partial<CanvasElement>) => void,
  position: Point,
  onPositionChange: (pos: Point) => void
}) => {
  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const isMultiSelect = selectedElements.length > 1;
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on the header area
    if ((e.target as HTMLElement).closest('.panel-header')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        onPositionChange({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, onPositionChange]);

  return (
    <div
      className="fixed bg-card border border-border shadow-xl w-72 p-4 z-50 mt-10 font-mono text-sm rounded-lg max-h-[90vh] overflow-y-auto"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onMouseDown={handleMouseDown}
    >
      <div className="panel-header flex items-center gap-2 mb-4 text-muted-foreground uppercase tracking-widest text-xs font-bold cursor-move">
        <Settings2 className="h-4 w-4" />
        Properties
      </div>

      <div className="space-y-6">
        {/* Global Settings or Selected Item Settings */}
        {!selectedElement && !isMultiSelect ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium">Global Stroke Weight</label>
              <div className="flex items-center gap-2">
                <Slider 
                  value={[settings.strokeWidth]} 
                  min={1} 
                  max={20} 
                  step={1}
                  onValueChange={(v) => updateSettings("strokeWidth", v[0])} 
                />
                <span className="w-8 text-right">{settings.strokeWidth}px</span>
              </div>
            </div>

             <div className="space-y-2">
                  <label className="text-xs font-medium">Global Fill Color</label>
                  <div className="flex items-center gap-2">
                     <Input 
                        type="color" 
                        className="w-full h-8 p-1" 
                        value={settings.fillColor.startsWith('#') ? settings.fillColor : "#FFFFFF"}
                        onChange={(e) => updateSettings("fillColor", e.target.value)}
                     />
                  </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium">Snapping</label>
              <div className="flex items-center justify-between">
                <span>Snap to Points</span>
                <Toggle 
                  pressed={settings.snapping} 
                  onPressedChange={(v) => updateSettings("snapping", v)}
                  size="sm"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Toggle>
              </div>
            </div>
          </>
        ) : (
          <>
             <div className="pb-2 border-b border-border mb-2">
               <span className="text-xs text-accent font-bold">
                 {isMultiSelect ? `${selectedElements.length} ITEMS SELECTED` : selectedElement?.type.toUpperCase() + " SELECTED"}
               </span>
             </div>
             
             <div className="space-y-2">
              <label className="text-xs font-medium">Stroke Weight</label>
              <div className="flex items-center gap-2">
                <Slider 
                  value={[isMultiSelect ? settings.strokeWidth : selectedElement!.strokeWidth]} 
                  min={1} 
                  max={20} 
                  step={1}
                  onValueChange={(v) => selectedElements.forEach(el => updateElement(el.id, { strokeWidth: v[0] }))} 
                />
                <span className="w-8 text-right">{isMultiSelect ? '-' : selectedElement!.strokeWidth}px</span>
              </div>
            </div>

            {(selectedElement?.type === 'poly' || selectedElement?.type === 'spline') && (
               <div className="space-y-2">
                  <label className="text-xs font-medium">Style</label>
                  <div className="flex items-center justify-between">
                    <span>Arrowhead</span>
                    <Toggle 
                      pressed={!!selectedElement.isArrow} 
                      onPressedChange={(v) => updateElement(selectedElement.id, { isArrow: v })}
                      size="sm"
                    >
                      <span className="text-xs">→</span>
                    </Toggle>
                  </div>
               </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium">Fill Opacity</label>
              <div className="flex items-center gap-2">
                <Slider 
                  value={[(isMultiSelect ? 1 : (selectedElement as any).opacity ?? 1) * 100]} 
                  min={0} 
                  max={100} 
                  step={1}
                  onValueChange={(v) => selectedElements.forEach(el => updateElement(el.id, { opacity: v[0] / 100 } as any))} 
                />
                <span className="w-8 text-right">{Math.round((isMultiSelect ? 100 : ((selectedElement as any).opacity ?? 1) * 100))}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Fill Color</label>
              <div className="flex items-center gap-2">
                  <Input 
                    type="color" 
                    className="w-full h-8 p-1" 
                    value={(selectedElement as any)?.fillColor?.startsWith('#') ? (selectedElement as any).fillColor : "#000000"}
                    onChange={(e) => selectedElements.forEach(el => updateElement(el.id, { fillColor: e.target.value } as any))}
                  />
                  <Button 
                    size="icon" 
                    variant="outline"
                    title="No Fill"
                    onClick={() => selectedElements.forEach(el => updateElement(el.id, { fillColor: "none" } as any))}
                  >
                    <div className="w-4 h-4 border border-red-500 relative">
                      <div className="absolute inset-0 border-t border-red-500 rotate-45 transform origin-center top-1/2" />
                    </div>
                  </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Pattern Fill</label>
              <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 'url(#hatch-diagonal)', name: 'Hatch Diag' },
                    { val: 'url(#hatch-cross)', name: 'Hatch Cross' },
                    { val: 'url(#pattern-rock)', name: 'Rock' },
                    { val: 'url(#pattern-pavers)', name: 'Pavers' },
                    { val: 'url(#pattern-grass)', name: 'Grass' },
                    { val: 'url(#pattern-wood)', name: 'Wood' },
                    { val: 'url(#pattern-dots)', name: 'Stippling' },
                    { val: 'url(#pattern-concrete)', name: 'Concrete' },
                    { val: 'url(#pattern-waves)', name: 'Water' },
                  ].map((fill, i) => (
                    <button
                      key={i}
                      className={cn(
                        "h-10 w-full border border-border rounded-sm overflow-hidden relative hover:border-accent transition-colors",
                        !isMultiSelect && selectedElement && (selectedElement as any).fillColor === fill.val && "ring-2 ring-accent"
                      )}
                      title={fill.name}
                      onClick={() => selectedElements.forEach(el => updateElement(el.id, { fillColor: fill.val } as any))}
                    >
                      <svg width="100%" height="100%">
                        <rect width="100%" height="100%" fill={fill.val} />
                      </svg>
                    </button>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- Patterns ---
const Patterns = () => (
  <svg width="0" height="0" className="absolute pointer-events-none">
    <defs>
      <pattern id="hatch-diagonal" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="10" style={{stroke: "black", strokeWidth: 1}} />
      </pattern>
      <pattern id="hatch-cross" width="10" height="10" patternUnits="userSpaceOnUse">
         <path d="M0,0 l10,10 M10,0 l-10,10" style={{stroke: "black", strokeWidth: 0.5}} />
      </pattern>
      
      {/* Rock / Gravel */}
      <pattern id="pattern-rock" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M2,5 Q4,2 7,5 T12,5 T2,5 M10,15 Q14,12 18,15 T10,15 M5,12 Q7,14 3,16" fill="none" stroke="black" strokeWidth="1"/>
      </pattern>

      {/* Pavers */}
      <pattern id="pattern-pavers" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="10" height="10" fill="none" stroke="black" strokeWidth="0.5"/>
        <rect x="10" y="10" width="10" height="10" fill="none" stroke="black" strokeWidth="0.5"/>
      </pattern>
      
      {/* Grass */}
      <pattern id="pattern-grass" width="15" height="15" patternUnits="userSpaceOnUse">
        <path d="M2,10 L2,5 M5,10 L5,3 M8,10 L8,6" fill="none" stroke="black" strokeWidth="1"/>
      </pattern>

      {/* Wood */}
      <pattern id="pattern-wood" width="20" height="10" patternUnits="userSpaceOnUse">
        <path d="M0,2 Q10,0 20,2 M0,5 Q10,3 20,5 M0,8 Q10,6 20,8" fill="none" stroke="black" strokeWidth="0.5"/>
      </pattern>

      {/* Dots / Stippling */}
      <pattern id="pattern-dots" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.5" fill="black" />
        <circle cx="3.5" cy="3.5" r="0.5" fill="black" />
      </pattern>

      {/* Concrete */}
      <pattern id="pattern-concrete" width="50" height="50" patternUnits="userSpaceOnUse">
         <circle cx="10" cy="10" r="1" fill="rgba(0,0,0,0.2)" />
         <circle cx="30" cy="40" r="1" fill="rgba(0,0,0,0.2)" />
         <path d="M20,20 L22,22 M40,10 L42,12" stroke="rgba(0,0,0,0.2)" strokeWidth="1"/>
      </pattern>

      {/* Water / Waves */}
      <pattern id="pattern-waves" width="20" height="10" patternUnits="userSpaceOnUse">
         <path d="M0,5 Q5,0 10,5 T20,5" fill="none" stroke="black" strokeWidth="0.5" />
      </pattern>

      <pattern id="grid-bg" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
      </pattern>
      
      {/* Arrow Marker */}
      <marker id="arrowhead" markerWidth="10" markerHeight="7" 
        refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-foreground)" />
      </marker>
      <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" 
        refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-accent)" />
      </marker>
    </defs>
  </svg>
);

// --- Main Page ---

export default function Home() {
  // State
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>("pen");
  const [settings, setSettings] = useState({
    strokeWidth: 2,
    strokeColor: "#000000",
    fillColor: "none",
    snapping: true
  });
  
  // Interaction State
  const [drawingState, setDrawingState] = useState<{
    active: boolean;
    startPoint?: Point;
    currentPoint?: Point;
    polyPoints?: Point[];
    splinePoints?: Point[];
  }>({ active: false });

  // Selection State
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dragSelection, setDragSelection] = useState<{start: Point, current: Point} | null>(null);
  const [movingState, setMovingState] = useState<{active: boolean, lastPos: Point, elementId?: string, pointIndex?: number} | null>(null);

  // History
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Panel Position
  const [panelPosition, setPanelPosition] = useState<Point>({ x: window.innerWidth - 304, y: 16 });

  // Shift key state for constraining lines
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // Hover position for showing snap preview before first click
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // --- History Management ---
  const addToHistory = (newElements: CanvasElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setElements([]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track Shift key
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
         if (selection.size > 0) {
           const newElements = elements.filter(el => !selection.has(el.id));
           addToHistory(newElements);
           setSelection(new Set());
         }
      } else if (e.key === 'v') setActiveTool('select');
      else if (e.key === 'p') setActiveTool('pen');
      else if (e.key === 's') setActiveTool('spline');
      else if (e.key === 'e') setActiveTool('eraser');

      // Enter to finish drawing or Escape to cancel
      if (e.key === 'Enter') {
        if (drawingState.active) {
           // Finish poly/spline if possible
           if (activeTool === 'pen' && drawingState.polyPoints && drawingState.polyPoints.length > 1) {
               // Commit open poly
               const newId = generateId();
               const newPoly: PolyElement = {
                  id: newId,
                  type: "poly",
                  points: drawingState.polyPoints,
                  fillColor: "none",
                  strokeColor: settings.strokeColor,
                  strokeWidth: settings.strokeWidth,
                  opacity: 1,
                  isClosed: false
               };
               addToHistory([...elements, newPoly]);
               setSelection(new Set([newId]));
               setActiveTool('select');
           } else if (activeTool === 'spline' && drawingState.splinePoints && drawingState.splinePoints.length > 1) {
               // Commit open spline
               const newId = generateId();
               const newSpline: SplineElement = {
                  id: newId,
                  type: "spline",
                  points: drawingState.splinePoints,
                  strokeColor: settings.strokeColor,
                  strokeWidth: settings.strokeWidth,
                  fillColor: "none",
                  opacity: 1
               };
               addToHistory([...elements, newSpline]);
               setSelection(new Set([newId]));
               setActiveTool('select');
           }
           setDrawingState({ active: false });
        } else {
           setSelection(new Set());
        }
      } else if (e.key === 'Escape') {
        if (drawingState.active) {
           // Cancel drawing
           setDrawingState({ active: false });
        } else {
           setSelection(new Set());
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [history, historyIndex, selection, elements, drawingState, activeTool]);

  // Zoom with Alt/Option + Scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();

        const delta = -e.deltaY;
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));

        setZoom(newZoom);
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoom]);

  const updateElement = (id: string, props: Partial<CanvasElement>) => {
     const newElements = elements.map(el => el.id === id ? { ...el, ...props } : el) as CanvasElement[];
     addToHistory(newElements);
  };

  // --- Geometry Helpers ---
  const getSnapPoint = (p: Point): Point => {
    if (!settings.snapping) return p;

    let closest = p;
    let minDist = SNAP_RADIUS;

    // Collect all significant points
    const snapPoints: Point[] = [];
    elements.forEach(el => {
      if (el.type === "poly") {
        // Snap to all vertices
        snapPoints.push(...el.points);
      } else if (el.type === "rect") {
         // Snap to corners and midpoints
         snapPoints.push(
           // Corners
           {x: el.x, y: el.y},
           {x: el.x + el.width, y: el.y},
           {x: el.x, y: el.y + el.height},
           {x: el.x + el.width, y: el.y + el.height},
           // Midpoints of edges
           {x: el.x + el.width / 2, y: el.y},
           {x: el.x + el.width / 2, y: el.y + el.height},
           {x: el.x, y: el.y + el.height / 2},
           {x: el.x + el.width, y: el.y + el.height / 2}
         );
      } else if (el.type === "circle") {
         // Snap to center and cardinal points (top, bottom, left, right)
         snapPoints.push(
           {x: el.cx, y: el.cy}, // Center
           {x: el.cx, y: el.cy - el.r}, // Top
           {x: el.cx, y: el.cy + el.r}, // Bottom
           {x: el.cx - el.r, y: el.cy}, // Left
           {x: el.cx + el.r, y: el.cy}  // Right
         );
      } else if (el.type === "spline") {
         // Snap to all control points
         el.points.forEach(pt => snapPoints.push(pt));
      }
    });

    // Also snap to current drawing points
    if (drawingState.active) {
       if (drawingState.polyPoints && drawingState.polyPoints.length > 0) {
          // Snap to all points in current poly, not just first
          snapPoints.push(...drawingState.polyPoints);
       }
       if (drawingState.splinePoints && drawingState.splinePoints.length > 0) {
          // Snap to all points in current spline, not just first
          snapPoints.push(...drawingState.splinePoints);
       }
    }

    snapPoints.forEach(sp => {
      const d = distance(p, sp);
      if (d < minDist) {
        minDist = d;
        closest = sp;
      }
    });

    return closest;
  };

  // Constrain point to horizontal or vertical from reference point
  const constrainToOrtho = (point: Point, refPoint: Point): Point => {
    const dx = Math.abs(point.x - refPoint.x);
    const dy = Math.abs(point.y - refPoint.y);

    // Snap to horizontal or vertical based on which is closer
    if (dx > dy) {
      // Horizontal
      return { x: point.x, y: refPoint.y };
    } else {
      // Vertical
      return { x: refPoint.x, y: point.y };
    }
  };

  // Snap rectangle edges to existing rectangle edges
  const snapRectangleEdges = (startPoint: Point, currentPoint: Point): Point => {
    if (!settings.snapping) return currentPoint;

    let snappedPoint = { ...currentPoint };
    const EDGE_SNAP_RADIUS = SNAP_RADIUS;

    // Determine which edges can be moved based on drag direction
    const isDraggingRight = currentPoint.x > startPoint.x;
    const isDraggingLeft = currentPoint.x < startPoint.x;
    const isDraggingDown = currentPoint.y > startPoint.y;
    const isDraggingUp = currentPoint.y < startPoint.y;

    // Calculate the current rectangle bounds
    const left = Math.min(startPoint.x, currentPoint.x);
    const right = Math.max(startPoint.x, currentPoint.x);
    const top = Math.min(startPoint.y, currentPoint.y);
    const bottom = Math.max(startPoint.y, currentPoint.y);

    // Collect all rectangle edges from existing elements
    elements.forEach(el => {
      if (el.type === "rect") {
        const rectLeft = el.x;
        const rectRight = el.x + el.width;
        const rectTop = el.y;
        const rectBottom = el.y + el.height;

        // Snap horizontal position (X)
        if (isDraggingRight) {
          // Can snap right edge
          if (Math.abs(right - rectLeft) < EDGE_SNAP_RADIUS) {
            snappedPoint.x = rectLeft;
          } else if (Math.abs(right - rectRight) < EDGE_SNAP_RADIUS) {
            snappedPoint.x = rectRight;
          }
        } else if (isDraggingLeft) {
          // Can snap left edge
          if (Math.abs(left - rectLeft) < EDGE_SNAP_RADIUS) {
            snappedPoint.x = rectLeft;
          } else if (Math.abs(left - rectRight) < EDGE_SNAP_RADIUS) {
            snappedPoint.x = rectRight;
          }
        }

        // Snap vertical position (Y)
        if (isDraggingDown) {
          // Can snap bottom edge
          if (Math.abs(bottom - rectTop) < EDGE_SNAP_RADIUS) {
            snappedPoint.y = rectTop;
          } else if (Math.abs(bottom - rectBottom) < EDGE_SNAP_RADIUS) {
            snappedPoint.y = rectBottom;
          }
        } else if (isDraggingUp) {
          // Can snap top edge
          if (Math.abs(top - rectTop) < EDGE_SNAP_RADIUS) {
            snappedPoint.y = rectTop;
          } else if (Math.abs(top - rectBottom) < EDGE_SNAP_RADIUS) {
            snappedPoint.y = rectBottom;
          }
        }
      }
    });

    return snappedPoint;
  };

  // --- NURBS Curve Generation ---
  // Implements a Non-Uniform Rational B-Spline curve
  // Uses cubic B-spline basis functions for smooth curves

  // Cox-de Boor recursion formula for B-spline basis functions
  const basisFunction = (i: number, degree: number, t: number, knots: number[]): number => {
    if (degree === 0) {
      return (t >= knots[i] && t < knots[i + 1]) ? 1 : 0;
    }

    let left = 0;
    let right = 0;

    const denomLeft = knots[i + degree] - knots[i];
    if (denomLeft !== 0) {
      left = ((t - knots[i]) / denomLeft) * basisFunction(i, degree - 1, t, knots);
    }

    const denomRight = knots[i + degree + 1] - knots[i + 1];
    if (denomRight !== 0) {
      right = ((knots[i + degree + 1] - t) / denomRight) * basisFunction(i + 1, degree - 1, t, knots);
    }

    return left + right;
  };

  // Generate uniform knot vector for B-spline
  const generateKnotVector = (numPoints: number, degree: number): number[] => {
    const numKnots = numPoints + degree + 1;
    const knots: number[] = [];

    // Clamped knot vector (curve passes through first and last control points)
    for (let i = 0; i < numKnots; i++) {
      if (i <= degree) {
        knots.push(0);
      } else if (i >= numKnots - degree - 1) {
        knots.push(numPoints - degree);
      } else {
        knots.push(i - degree);
      }
    }

    return knots;
  };

  const getSplinePath = (points: Point[], isClosed: boolean = false) => {
    if (points.length < 2) return "";

    if (points.length === 2) {
      // Just draw a line for 2 points
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    const degree = Math.min(3, points.length - 1); // Cubic or lower if fewer points
    const knots = generateKnotVector(points.length, degree);

    // Number of curve segments to generate (higher = smoother)
    const resolution = 50;
    const steps = resolution * (points.length - 1);

    let d = "";

    // Evaluate the NURBS curve at many parameter values
    for (let step = 0; step <= steps; step++) {
      const t = (step / steps) * (points.length - degree) + knots[degree];

      // Clamp t to valid range
      const tClamped = Math.max(knots[degree], Math.min(knots[knots.length - degree - 1] - 0.0001, t));

      let x = 0;
      let y = 0;

      // Sum the contributions of all control points
      for (let i = 0; i < points.length; i++) {
        const basis = basisFunction(i, degree, tClamped, knots);
        x += points[i].x * basis;
        y += points[i].y * basis;
      }

      if (step === 0) {
        d = `M ${x} ${y}`;
      } else {
        d += ` L ${x} ${y}`;
      }
    }

    return d;
  };


  // --- Event Handlers ---

  const getMousePos = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rawPos = getMousePos(e);
    let pos = getSnapPoint(rawPos);

    // Apply ortho constraint when shift is pressed
    if (isShiftPressed) {
      if (activeTool === 'pen' && drawingState.polyPoints && drawingState.polyPoints.length > 0) {
        const lastPoint = drawingState.polyPoints[drawingState.polyPoints.length - 1];
        pos = constrainToOrtho(pos, lastPoint);
      } else if (activeTool === 'spline' && drawingState.splinePoints && drawingState.splinePoints.length > 0) {
        const lastPoint = drawingState.splinePoints[drawingState.splinePoints.length - 1];
        pos = constrainToOrtho(pos, lastPoint);
      }
    }

    // 1. Handle Control Point Dragging logic if in Select Mode
    if (activeTool === "select") {
       // Check if clicking on a control point
       // We need to iterate elements and see if we hit a point
       // This is expensive but fine for low element count
       let hitPoint = false;
       
       // Prioritize selected elements
       elements.forEach(el => {
          if (selection.has(el.id)) {
             if (el.type === 'poly' || el.type === 'spline') {
                el.points.forEach((pt, idx) => {
                   if (distance(rawPos, pt) < 8) {
                      setMovingState({ active: true, lastPos: rawPos, elementId: el.id, pointIndex: idx });
                      hitPoint = true;
                   }
                });
             } else if (el.type === 'rect') {
                // Vertices
                const pts = [
                   {x: el.x, y: el.y}, {x: el.x + el.width, y: el.y},
                   {x: el.x + el.width, y: el.y + el.height}, {x: el.x, y: el.y + el.height}
                ];
                // TODO: Implement resizing logic
             }
          }
       });
       
       if (hitPoint) return;

       // 2. Handle Element Moving
       // Check if we clicked ON an element
       // Simplified hit test
       let hitElementId: string | null = null;
       // Reverse to hit top elements first
       for (let i = elements.length - 1; i >= 0; i--) {
          const el = elements[i];
          // Simple bbox/point check
          let hit = false;
          if (el.type === 'poly' || el.type === 'spline') {
             // Check points (simplified) or bounding box
             // Real hit test for lines is complex
             const xs = el.points.map(p => p.x);
             const ys = el.points.map(p => p.y);
             if (rawPos.x >= Math.min(...xs) && rawPos.x <= Math.max(...xs) &&
                 rawPos.y >= Math.min(...ys) && rawPos.y <= Math.max(...ys)) {
                 hit = true;
             }
          } else if (el.type === 'rect') {
             if (rawPos.x >= el.x && rawPos.x <= el.x + el.width &&
                 rawPos.y >= el.y && rawPos.y <= el.y + el.height) hit = true;
          } else if (el.type === 'circle') {
             if (distance(rawPos, {x: el.cx, y: el.cy}) <= el.r) hit = true;
          }
          
          if (hit) {
             hitElementId = el.id;
             break;
          }
       }

       if (hitElementId) {
          if (!selection.has(hitElementId) && !e.shiftKey) {
             setSelection(new Set([hitElementId]));
          } else if (e.shiftKey) {
             const newSel = new Set(selection);
             if (newSel.has(hitElementId)) newSel.delete(hitElementId);
             else newSel.add(hitElementId);
             setSelection(newSel);
             return;
          }
          setMovingState({ active: true, lastPos: rawPos });
       } else {
          // Start Drag Selection
          setDragSelection({ start: rawPos, current: rawPos });
          if (!e.shiftKey) setSelection(new Set());
       }
       return;
    }

    // 3. Drawing Tools
    if (activeTool === "pen" || activeTool === "spline") {
      // Clear hover point since we're now actively drawing
      setHoverPoint(null);

      const currentPoints = activeTool === "pen" ? (drawingState.polyPoints || []) : (drawingState.splinePoints || []);

      // Check close loop
      if (currentPoints.length > 2 && distance(pos, currentPoints[0]) < SNAP_RADIUS) {
         // Close it
         const newId = generateId();
         const newEl: any = {
             id: newId,
             type: activeTool === "pen" ? "poly" : "spline",
             points: currentPoints,
             fillColor: settings.fillColor,
             strokeColor: settings.strokeColor,
             strokeWidth: settings.strokeWidth,
             opacity: 1,
             isClosed: true
         };
         addToHistory([...elements, newEl]);
         setSelection(new Set([newId]));
         setActiveTool('select');
         setDrawingState({ active: false });
      } else {
         // Add point
         setDrawingState({
            active: true,
            polyPoints: activeTool === "pen" ? [...currentPoints, pos] : undefined,
            splinePoints: activeTool === "spline" ? [...currentPoints, pos] : undefined,
            currentPoint: pos
         });
      }
    } else if (activeTool === "rect" || activeTool === "circle") {
       if (!drawingState.active) {
         // First click - start drawing
         setHoverPoint(null);
         setDrawingState({ active: true, startPoint: pos, currentPoint: pos });
       } else if (drawingState.startPoint) {
         // Second click - finish drawing
         if (activeTool === "rect") {
           const x = Math.min(drawingState.startPoint.x, pos.x);
           const y = Math.min(drawingState.startPoint.y, pos.y);
           const width = Math.abs(drawingState.startPoint.x - pos.x);
           const height = Math.abs(drawingState.startPoint.y - pos.y);
           if (width > 5 && height > 5) {
             const newId = generateId();
             const newRect: RectElement = {
               id: newId,
               type: "rect",
               x, y, width, height,
               fillColor: settings.fillColor,
               strokeColor: settings.strokeColor,
               strokeWidth: settings.strokeWidth,
               opacity: 1
             };
             addToHistory([...elements, newRect]);
             setSelection(new Set([newId]));
             setActiveTool('select');
           }
         } else if (activeTool === "circle") {
           const r = distance(drawingState.startPoint, pos);
           if (r > 5) {
             const newId = generateId();
             const newCircle: CircleElement = {
               id: newId,
               type: "circle",
               cx: drawingState.startPoint.x,
               cy: drawingState.startPoint.y,
               r,
               fillColor: settings.fillColor,
               strokeColor: settings.strokeColor,
               strokeWidth: settings.strokeWidth,
               opacity: 1
             };
             addToHistory([...elements, newCircle]);
             setSelection(new Set([newId]));
             setActiveTool('select');
           }
         }
         setDrawingState({ active: false });
       }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rawPos = getMousePos(e);
    let pos = getSnapPoint(rawPos);

    // Apply ortho constraint when shift is pressed
    if (isShiftPressed && drawingState.active) {
      if (activeTool === 'pen' && drawingState.polyPoints && drawingState.polyPoints.length > 0) {
        const lastPoint = drawingState.polyPoints[drawingState.polyPoints.length - 1];
        pos = constrainToOrtho(pos, lastPoint);
      } else if (activeTool === 'spline' && drawingState.splinePoints && drawingState.splinePoints.length > 0) {
        const lastPoint = drawingState.splinePoints[drawingState.splinePoints.length - 1];
        pos = constrainToOrtho(pos, lastPoint);
      }
    }

    if (drawingState.active) {
      // Apply edge-to-edge snapping for rectangles
      if (activeTool === 'rect' && drawingState.startPoint) {
        pos = snapRectangleEdges(drawingState.startPoint, pos);
      }
      setDrawingState(prev => ({ ...prev, currentPoint: pos }));
    } else if (activeTool === 'pen' || activeTool === 'spline' || activeTool === 'rect' || activeTool === 'circle') {
      // Track hover position for snap preview even before first click
      setHoverPoint(pos);
    } else {
      setHoverPoint(null);
    }

    if (dragSelection) {
       setDragSelection(prev => prev ? ({ ...prev, current: rawPos }) : null);
    }

    if (movingState && movingState.active) {
       const dx = rawPos.x - movingState.lastPos.x;
       const dy = rawPos.y - movingState.lastPos.y;
       
       if (movingState.elementId && movingState.pointIndex !== undefined) {
          // Moving a specific control point
          const newElements = elements.map(el => {
             if (el.id === movingState.elementId) {
                if (el.type === 'poly' || el.type === 'spline') {
                   const newPoints = [...el.points];
                   newPoints[movingState.pointIndex!] = { 
                      x: newPoints[movingState.pointIndex!].x + dx, 
                      y: newPoints[movingState.pointIndex!].y + dy 
                   };
                   return { ...el, points: newPoints };
                }
             }
             return el;
          });
          setElements(newElements as CanvasElement[]);
       } else {
          // Moving entire selection
          const newElements = elements.map(el => {
             if (selection.has(el.id)) {
                if (el.type === 'rect') {
                   return { ...el, x: el.x + dx, y: el.y + dy };
                } else if (el.type === 'circle') {
                   return { ...el, cx: el.cx + dx, cy: el.cy + dy };
                } else if (el.type === 'poly' || el.type === 'spline') {
                   return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
                }
             }
             return el;
          });
          setElements(newElements as CanvasElement[]);
       }
       
       setMovingState(prev => prev ? ({ ...prev, lastPos: rawPos }) : null);
    }
  };

  const handleMouseUp = () => {
    if (movingState && movingState.active) {
       addToHistory(elements); // Commit
       setMovingState(null);
    }

    if (dragSelection) {
       // Calculate selection box
       const x1 = Math.min(dragSelection.start.x, dragSelection.current.x);
       const y1 = Math.min(dragSelection.start.y, dragSelection.current.y);
       const x2 = Math.max(dragSelection.start.x, dragSelection.current.x);
       const y2 = Math.max(dragSelection.start.y, dragSelection.current.y);
       
       const newSelected = new Set(selection);
       if (!movingState) { // Don't change selection if we just moved something
           elements.forEach(el => {
              let elX1, elY1, elX2, elY2;
              if (el.type === "poly" || el.type === "spline") {
                 const xs = el.points.map(p => p.x);
                 const ys = el.points.map(p => p.y);
                 elX1 = Math.min(...xs); elY1 = Math.min(...ys);
                 elX2 = Math.max(...xs); elY2 = Math.max(...ys);
              } else if (el.type === "rect") {
                 elX1 = el.x; elY1 = el.y;
                 elX2 = el.x + el.width; elY2 = el.y + el.height;
              } else if (el.type === "circle") {
                 elX1 = el.cx - el.r; elY1 = el.cy - el.r;
                 elX2 = el.cx + el.r; elY2 = el.cy + el.r;
              }
    
              if (elX1! < x2 && elX2! > x1 && elY1! < y2 && elY2! > y1) {
                 newSelected.add(el.id);
              }
           });
           setSelection(newSelected);
       }
       setDragSelection(null);
    }
  };
  
  // --- Control Points Rendering ---
  const renderControlPoints = (el: CanvasElement) => {
    if (!selection.has(el.id)) return null;

    const points: {p: Point, idx: number, type: 'vertex' | 'control'}[] = [];
    
    if (el.type === "rect") {
       // Simple corner points (visual only for now)
       points.push(
          {p: {x: el.x, y: el.y}, idx: 0, type: 'vertex'},
          {p: {x: el.x + el.width, y: el.y + el.height}, idx: 1, type: 'vertex'}
       );
    } else if (el.type === "circle") {
       points.push({p: {x: el.cx + el.r, y: el.cy}, idx: 0, type: 'vertex'});
    } else if (el.type === "poly" || el.type === "spline") {
       el.points.forEach((p, i) => points.push({p, idx: i, type: 'vertex'}));
    }

    return (
       <>
         {points.map((pt, i) => (
             <circle 
                key={i} 
                cx={pt.p.x} 
                cy={pt.p.y} 
                r={4} 
                fill="white" 
                stroke="var(--color-accent)" 
                strokeWidth={1}
                className="cursor-pointer hover:scale-150 transition-transform"
             />
          ))}
       </>
    );
  };

  // --- Rendering ---

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col select-none">
      <Patterns />
      
      {/* Header */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between z-40 relative">
        <div className="flex items-center gap-2">
           <div className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center font-bold rounded-sm">
             A
           </div>
           <span className="font-mono font-bold tracking-tighter">PARTI.DRAW</span>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="text-xs text-muted-foreground font-mono hidden md:block">
              {activeTool.toUpperCase()} MODE
           </div>
           <Button size="sm" variant="outline" className="gap-2 font-mono text-xs">
             <Download className="h-4 w-4" /> EXPORT
           </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 relative">
        <Toolbar 
          activeTool={activeTool} 
          setTool={setActiveTool}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyIndex >= 0}
          canRedo={historyIndex < history.length - 1}
          onClear={() => addToHistory([])}
        />
        
        <PropertiesPanel
          settings={settings}
          updateSettings={(k, v) => setSettings(prev => ({ ...prev, [k]: v }))}
          selectedElements={elements.filter(e => selection.has(e.id))}
          updateElement={updateElement}
          position={panelPosition}
          onPositionChange={setPanelPosition}
        />

        {/* Canvas */}
        <div
          ref={canvasRef}
          className={cn(
             "w-full h-full relative",
             activeTool === 'select' ? "cursor-default" : "cursor-crosshair"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setHoverPoint(null)}
        >
          <svg className="w-full h-full pointer-events-none">
            <g transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
            {/* Render existing elements */}
            {elements.map(el => {
               const isSelected = selection.has(el.id);
               
               let content;
               if (el.type === "poly") {
                 const pointsStr = el.points.map(p => `${p.x},${p.y}`).join(" ");
                 if (el.isClosed) {
                    content = (
                      <polygon
                        points={pointsStr}
                        fill={el.fillColor === 'none' ? 'none' : el.fillColor}
                        fillOpacity={el.opacity}
                        stroke={isSelected ? "var(--color-accent)" : el.strokeColor}
                        strokeWidth={el.strokeWidth}
                        className="transition-colors cursor-pointer"
                      />
                    );
                 } else {
                    content = (
                       <polyline
                        points={pointsStr}
                        fill="none"
                        stroke={isSelected ? "var(--color-accent)" : el.strokeColor}
                        strokeWidth={el.strokeWidth}
                        markerEnd={el.isArrow ? (isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)") : undefined}
                        className="transition-colors cursor-pointer"
                       />
                    );
                 }
               } else if (el.type === "rect") {
                  content = (
                     <rect 
                        x={el.x} y={el.y} width={el.width} height={el.height}
                        fill={el.fillColor === 'none' ? 'none' : el.fillColor}
                        fillOpacity={el.opacity}
                        stroke={isSelected ? "var(--color-accent)" : el.strokeColor}
                        strokeWidth={el.strokeWidth}
                        className="transition-colors cursor-pointer"
                     />
                  );
               } else if (el.type === "circle") {
                  content = (
                     <circle 
                        cx={el.cx} cy={el.cy} r={el.r}
                        fill={el.fillColor === 'none' ? 'none' : el.fillColor}
                        fillOpacity={el.opacity}
                        stroke={isSelected ? "var(--color-accent)" : el.strokeColor}
                        strokeWidth={el.strokeWidth}
                        className="transition-colors cursor-pointer"
                     />
                  );
               } else if (el.type === "spline") {
                  const d = getSplinePath(el.points, false);
                  content = (
                     <path 
                        d={d}
                        fill={el.fillColor === 'none' ? 'none' : el.fillColor}
                        fillOpacity={el.opacity}
                        stroke={isSelected ? "var(--color-accent)" : el.strokeColor}
                        strokeWidth={el.strokeWidth}
                        markerEnd={el.isArrow ? (isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)") : undefined}
                        className="transition-colors cursor-pointer"
                     />
                  );
               }

               return (
                  <g key={el.id} className={cn("pointer-events-auto", activeTool === 'select' && "hover:opacity-80")}>
                     {content}
                     {isSelected && renderControlPoints(el)}
                  </g>
               );
            })}

            {/* Render Active Drawing */}
            {drawingState.active && (
               <>
                  {(activeTool === "pen" || activeTool === "spline") && drawingState.currentPoint && (
                     <>
                        {/* Current segment */}
                        {activeTool === 'pen' && drawingState.polyPoints && drawingState.polyPoints.length > 0 && (
                            <line 
                              x1={drawingState.polyPoints[drawingState.polyPoints.length-1].x} 
                              y1={drawingState.polyPoints[drawingState.polyPoints.length-1].y} 
                              x2={drawingState.currentPoint.x} 
                              y2={drawingState.currentPoint.y} 
                              stroke={settings.strokeColor}
                              strokeWidth={settings.strokeWidth}
                            />
                        )}
                        {activeTool === 'spline' && drawingState.splinePoints && drawingState.splinePoints.length > 0 && (
                            <line 
                              x1={drawingState.splinePoints[drawingState.splinePoints.length-1].x} 
                              y1={drawingState.splinePoints[drawingState.splinePoints.length-1].y} 
                              x2={drawingState.currentPoint.x} 
                              y2={drawingState.currentPoint.y} 
                              stroke={settings.strokeColor}
                              strokeWidth={settings.strokeWidth}
                              strokeDasharray="4 4"
                              opacity={0.5}
                            />
                        )}

                        {/* Existing segments */}
                        {activeTool === 'pen' && drawingState.polyPoints && (
                           <polyline
                              points={[...drawingState.polyPoints, drawingState.currentPoint].map(p => `${p.x},${p.y}`).join(" ")}
                              fill="none"
                              stroke={settings.strokeColor}
                              strokeWidth={settings.strokeWidth}
                              opacity={0.7}
                           />
                        )}
                         {activeTool === 'spline' && drawingState.splinePoints && (
                           <path
                              d={getSplinePath([...drawingState.splinePoints, drawingState.currentPoint])}
                              fill="none"
                              stroke={settings.strokeColor}
                              strokeWidth={settings.strokeWidth}
                              opacity={0.7}
                           />
                        )}

                        {/* Closing hint */}
                         {(activeTool === 'pen' || activeTool === 'spline') && 
                          ((drawingState.polyPoints && drawingState.polyPoints.length > 2) || (drawingState.splinePoints && drawingState.splinePoints.length > 2)) &&
                          distance(drawingState.currentPoint, (drawingState.polyPoints || drawingState.splinePoints)![0]) < SNAP_RADIUS && (
                            <circle 
                              cx={(drawingState.polyPoints || drawingState.splinePoints)![0].x} 
                              cy={(drawingState.polyPoints || drawingState.splinePoints)![0].y} 
                              r={6} fill="none" stroke="var(--color-accent)" strokeWidth={2} 
                            />
                         )}
                     </>
                  )}
                  
                  {activeTool === "rect" && drawingState.startPoint && drawingState.currentPoint && (
                     <rect
                        x={Math.min(drawingState.startPoint.x, drawingState.currentPoint.x)}
                        y={Math.min(drawingState.startPoint.y, drawingState.currentPoint.y)}
                        width={Math.abs(drawingState.startPoint.x - drawingState.currentPoint.x)}
                        height={Math.abs(drawingState.startPoint.y - drawingState.currentPoint.y)}
                        fill={settings.fillColor}
                        stroke={settings.strokeColor}
                        strokeWidth={settings.strokeWidth}
                        opacity={0.5}
                     />
                  )}
                   {activeTool === "circle" && drawingState.startPoint && drawingState.currentPoint && (
                     <circle
                        cx={drawingState.startPoint.x}
                        cy={drawingState.startPoint.y}
                        r={distance(drawingState.startPoint, drawingState.currentPoint)}
                        fill={settings.fillColor}
                        stroke={settings.strokeColor}
                        strokeWidth={settings.strokeWidth}
                        opacity={0.5}
                     />
                  )}
               </>
            )}
            
            {/* Drag Selection Box */}
            {dragSelection && (
               <rect 
                  x={Math.min(dragSelection.start.x, dragSelection.current.x)}
                  y={Math.min(dragSelection.start.y, dragSelection.current.y)}
                  width={Math.abs(dragSelection.start.x - dragSelection.current.x)}
                  height={Math.abs(dragSelection.start.y - dragSelection.current.y)}
                  fill="var(--color-accent)"
                  fillOpacity={0.1}
                  stroke="var(--color-accent)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
               />
            )}

            {/* Snapping Indicator */}
            {settings.snapping && (drawingState.currentPoint || hoverPoint) && activeTool !== 'select' && (
               <circle
                 cx={(drawingState.currentPoint || hoverPoint)!.x}
                 cy={(drawingState.currentPoint || hoverPoint)!.y}
                 r={4}
                 fill="none"
                 stroke="var(--color-accent)"
                 strokeWidth={1}
                 className="pointer-events-none"
               />
            )}
            </g>
          </svg>

          {/* Hint text */}
          {(activeTool === "pen" || activeTool === "spline") && drawingState.active && (
            <div
              className="absolute pointer-events-none bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded shadow-lg font-mono"
              style={{
                left: (drawingState.currentPoint?.x || 0) + 15,
                top: (drawingState.currentPoint?.y || 0) + 15
              }}
            >
               'Enter' to finish, 'Esc' to cancel
            </div>
          )}
          {(activeTool === "rect" || activeTool === "circle") && drawingState.active && (
            <div
              className="absolute pointer-events-none bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded shadow-lg font-mono"
              style={{
                left: (drawingState.currentPoint?.x || 0) + 15,
                top: (drawingState.currentPoint?.y || 0) + 15
              }}
            >
               Click to finish, 'Esc' to cancel
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
