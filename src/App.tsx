import { useState, useEffect, useCallback } from 'react'
import './App.css'

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function App() {
  // 仮想ウィンドウ（ワールド）のサイズ
  const worldSize = { width: 1000, height: 600 };

  // ビューポートの状態
  const [viewport, setViewport] = useState<Rect>({
    x: 100,
    y: 100,
    width: 600,
    height: 400
  });

  // 操作対象の矩形（ターゲット）の状態
  const [targetRect, setTargetRect] = useState<Rect>({
    x: 200,
    y: 150,
    width: 150,
    height: 100
  });

  // ドラッグ操作の状態
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // リサイズ時の増分（ステップ）
  const [resizeStep, setResizeStep] = useState(10);

  // キーボード操作 (+ / - キー)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        setTargetRect(prev => ({ 
          ...prev, 
          x: prev.x - (resizeStep / 2),
          width: prev.width + resizeStep 
        }));
      } else if (e.key === '-' || e.key === '_') {
        setTargetRect(prev => {
          const newWidth = Math.max(10, prev.width - resizeStep);
          const diff = prev.width - newWidth;
          return { 
            ...prev, 
            x: prev.x + (diff / 2),
            width: newWidth 
          };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resizeStep]);

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent) => {
    const svg = e.currentTarget.closest('svg');
    if (!svg) return;

    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const transformedPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());

    setIsDragging(true);
    setDragOffset({
      x: transformedPoint.x - targetRect.x,
      y: transformedPoint.y - targetRect.y
    });
  };

  // ドラッグ中
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const svg = document.querySelector('svg');
    if (!svg) return;

    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const transformedPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());

    setTargetRect(prev => ({
      ...prev,
      x: transformedPoint.x - dragOffset.x,
      y: transformedPoint.y - dragOffset.y
    }));
  }, [isDragging, dragOffset]);

  // ドラッグ終了
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="container">
      <header>
        <h1>viewport-sim</h1>
        <p>Drag to move. Press +/- to resize.</p>
      </header>

      <div className="main-layout">
        <div className="stage-container">
          <svg
            viewBox={`0 0 ${worldSize.width} ${worldSize.height}`}
            className="world-svg"
          >
            {/* 仮想ワールドの背景 */}
            <rect width={worldSize.width} height={worldSize.height} fill="#f0f0f0" />
            
            {/* グリッド (オプション) */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#ddd" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* ビューポートのインジケーター */}
            <rect
              x={viewport.x}
              y={viewport.y}
              width={viewport.width}
              height={viewport.height}
              fill="none"
              stroke="#007bff"
              strokeWidth="4"
              strokeDasharray="8,4"
            />
            {/* 左上の座標 (カンマが角に来るように配置) */}
            <text 
              x={viewport.x} 
              y={viewport.y-12} 
              fill="#007bff" 
              fontSize="16" 
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}
            >
              ({Math.round(viewport.x)}, {Math.round(viewport.y)})
            </text>
            {/* 右下の座標 (カンマが角に来るように配置) */}
            <text 
              x={viewport.x + viewport.width} 
              y={viewport.y + viewport.height+12} 
              fill="#007bff" 
              fontSize="16" 
              fontWeight="bold" 
              textAnchor="middle"
              dominantBaseline="central"
              style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}
            >
              ({Math.round(viewport.x + viewport.width)}, {Math.round(viewport.y + viewport.height)})
            </text>

            {/* 操作対象の矩形 */}
            <rect
              x={targetRect.x}
              y={targetRect.y}
              width={targetRect.width}
              height={targetRect.height}
              fill="#ff4757"
              fillOpacity="0.8"
              stroke="#c0392b"
              strokeWidth="2"
              className="draggable-rect"
              onMouseDown={handleMouseDown}
            />
            {/* Target Rect 左上の座標 (Rectの上に配置) */}
            <text 
              x={targetRect.x} 
              y={targetRect.y - 15} 
              fill="#c0392b" 
              fontSize="16" 
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}
            >
              ({Math.round(targetRect.x)}, {Math.round(targetRect.y)})
            </text>
            {/* Target Rect 右下の座標 (Rectの下に配置) */}
            <text 
              x={targetRect.x + targetRect.width} 
              y={targetRect.y + targetRect.height + 15} 
              fill="#c0392b" 
              fontSize="16" 
              fontWeight="bold" 
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}
            >
              ({Math.round(targetRect.x + targetRect.width)}, {Math.round(targetRect.y + targetRect.height)})
            </text>
          </svg>

          <div className="bottom-info">
            <table className="info-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Top</th>
                  <th>Left</th>
                  <th>Width</th>
                  <th>Height</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="info-label">World</td>
                  <td>-</td>
                  <td>-</td>
                  <td className="info-value">{worldSize.width}</td>
                  <td className="info-value">{worldSize.height}</td>
                </tr>
                <tr>
                  <td className="info-label">Viewport</td>
                  <td className="info-value">{Math.round(viewport.x)}</td>
                  <td className="info-value">{Math.round(viewport.y)}</td>
                  <td className="info-value">{Math.round(viewport.width)}</td>
                  <td className="info-value">{Math.round(viewport.height)}</td>
                </tr>
                <tr>
                  <td className="info-label">Target Rect</td>
                  <td className="info-value">{Math.round(targetRect.x)}</td>
                  <td className="info-value">{Math.round(targetRect.y)}</td>
                  <td className="info-value">{Math.round(targetRect.width)}</td>
                  <td className="info-value">{Math.round(targetRect.height)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside className="info-panel">
          <section>
            <h3>Controls</h3>
            <div className="control-group">
              <label>Resize Step (+/-)</label>
              <input 
                type="number" min="1" max="100" 
                value={resizeStep} 
                onChange={(e) => setResizeStep(Number(e.target.value) || 1)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '4px' }}
              />
            </div>
            <div className="control-group">
              <label>Viewport Width</label>
              <input 
                type="range" min="100" max={worldSize.width} 
                value={viewport.width} 
                onChange={(e) => setViewport(prev => {
                  const newWidth = parseInt(e.target.value);
                  const diff = prev.width - newWidth;
                  return {
                    ...prev,
                    x: prev.x + (diff / 2),
                    width: newWidth
                  };
                })} 
              />
            </div>
            <div className="control-group">
              <label>Viewport Height</label>
              <input 
                type="range" min="100" max={worldSize.height} 
                value={viewport.height} 
                onChange={(e) => setViewport(prev => {
                  const newHeight = parseInt(e.target.value);
                  const diff = prev.height - newHeight;
                  return {
                    ...prev,
                    y: prev.y + (diff / 2),
                    height: newHeight
                  };
                })} 
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default App
