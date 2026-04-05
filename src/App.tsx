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
  const [worldSize, setWorldSize] = useState({ width: 800, height: 600 });

  // ビューポートの状態
  const [viewport, setViewport] = useState<Rect>({
    x: 0,
    y: 0,
    width: 800,
    height: 600
  });

  // 操作対象の矩形（ターゲット）の状態
  const [targetRect, setTargetRect] = useState<Rect>({
    x: 100,
    y: 100,
    width: 150,
    height: 100
  });

  // ドラッグ操作の状態
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // リサイズ時の増分（ステップ）
  const [resizeStep, setResizeStep] = useState(100);

  // ユーザー定義のスクリプト（数式）
  const [script, setScript] = useState<string>(`return {
  rect: {
    ...rect,
    x: Math.max(viewport.x, Math.min(rect.x, viewport.x + viewport.width - rect.width)),
    width: Math.min(rect.width, viewport.width)
  },
  worldWidth: 800
  };`);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // スクリプトを適用して矩形とワールド幅を補正する関数
  const applyScript = useCallback((rect: Rect, vp: Rect): { rect: Rect, worldWidth: number } => {
    try {
      const fn = new Function('rect', 'viewport', script);
      const result = fn(rect, vp);
      
      if (result && result.rect && typeof result.worldWidth === 'number') {
        const r = result.rect;
        if (typeof r.x === 'number' && typeof r.y === 'number' && 
            typeof r.width === 'number' && typeof r.height === 'number') {
          setScriptError(null);
          return { rect: r, worldWidth: result.worldWidth };
        }
      }
      throw new Error("Invalid return. Expected { rect: {x,y,w,h}, worldWidth: number }");
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : String(err));
      return { rect, worldWidth: worldSize.width };
    }
  }, [script, worldSize.width]);

  // 手動リサイズ関数
  const handleResize = useCallback((delta: number) => {
    setTargetRect(prev => {
      const newWidth = Math.max(10, prev.width + delta);
      const diff = prev.width - newWidth;
      const next = { 
        ...prev, 
        x: prev.x + (diff / 2),
        width: newWidth 
      };
      const { rect: updatedRect, worldWidth } = applyScript(next, viewport);
      setWorldSize(prevWorld => ({ ...prevWorld, width: worldWidth }));
      return updatedRect;
    });
  }, [applyScript, viewport]);

  // キーボード操作 (+ / - キー)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力欄にフォーカスがある時は無視するガード
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }

      if (e.key === '+' || e.key === '=') {
        handleResize(resizeStep);
      } else if (e.key === '-' || e.key === '_') {
        handleResize(-resizeStep);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resizeStep, handleResize]);

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

    setTargetRect(_ => {
      const next = {
        ...targetRect,
        x: transformedPoint.x - dragOffset.x,
        y: transformedPoint.y - dragOffset.y
      };
      const { rect: updatedRect, worldWidth } = applyScript(next, viewport);
      setWorldSize(prevWorld => ({ ...prevWorld, width: worldWidth }));
      return updatedRect;
    });
  }, [isDragging, dragOffset, viewport, applyScript, targetRect]);

  // スクリプトが変更された時にも即座に適用
  useEffect(() => {
    const { rect: updatedRect, worldWidth } = applyScript(targetRect, viewport);
    setTargetRect(updatedRect);
    setWorldSize(prevWorld => ({ ...prevWorld, width: worldWidth }));
  }, [script, viewport, applyScript]);

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
        <p>Drag to move. Press +/- to resize (unfocused only).</p>
      </header>

      <div className="main-layout">
        <div className="stage-container">
          <svg
            viewBox={`-40 -40 ${worldSize.width + 80} ${worldSize.height + 80}`}
            className="world-svg"
          >
            {/* 仮想ワールドの背景 */}
            <rect x="0" y="0" width={worldSize.width} height={worldSize.height} fill="#f0f0f0" />
            
            {/* グリッド (オプション) */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#ddd" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={worldSize.width} height={worldSize.height} fill="url(#grid)" />

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
            
            {/* 垂直スクロールバー (仮想) */}
            {worldSize.height > viewport.height && (
              <g className="scrollbar-v">
                {/* トラック */}
                <rect 
                  x={viewport.x + viewport.width - 12} 
                  y={viewport.y + 4} 
                  width={8} 
                  height={viewport.height - 8} 
                  fill="#cbd5e1" 
                  fillOpacity="0.3"
                  rx="4"
                />
                {/* つまみ */}
                <rect 
                  x={viewport.x + viewport.width - 11} 
                  y={viewport.y + 4 + (viewport.y / worldSize.height) * (viewport.height - 8)} 
                  width={6} 
                  height={(viewport.height / worldSize.height) * (viewport.height - 8)} 
                  fill="#64748b" 
                  fillOpacity="0.6"
                  rx="3"
                />
              </g>
            )}

            {/* 水平スクロールバー (仮想) */}
            {worldSize.width > viewport.width && (
              <g className="scrollbar-h">
                {/* トラック */}
                <rect 
                  x={viewport.x + 4} 
                  y={viewport.y + viewport.height - 12} 
                  width={viewport.width - 8} 
                  height={8} 
                  fill="#cbd5e1" 
                  fillOpacity="0.3"
                  rx="4"
                />
                {/* つまみ */}
                <rect 
                  x={viewport.x + 4 + (viewport.x / worldSize.width) * (viewport.width - 8)} 
                  y={viewport.y + viewport.height - 11} 
                  width={(viewport.width / worldSize.width) * (viewport.width - 8)} 
                  height={6} 
                  fill="#64748b" 
                  fillOpacity="0.6"
                  rx="3"
                />
              </g>
            )}

            {/* 左上の座標 */}
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
            {/* 右下の座標 */}
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
            {/* Target Rect サイズ表示 (中心) */}
            <text 
              x={targetRect.x + targetRect.width / 2} 
              y={targetRect.y + targetRect.height / 2} 
              fill="#ffffff" 
              fontSize="14" 
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none' }}
            >
              {Math.round(targetRect.width)} x {Math.round(targetRect.height)}
            </text>
            {/* Target Rect 左上の座標 */}
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
            {/* Target Rect 右下の座標 */}
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
            <div className="script-editor">
              <div className="script-header">
                <label>Logic Script (JS)</label>
                {scriptError && <span className="error-msg">{scriptError}</span>}
              </div>
              <textarea 
                value={script}
                onChange={(e) => setScript(e.target.value)}
                spellCheck="false"
                placeholder="return { rect, worldWidth: 800 };"
              />
              <div className="script-footer">
                Arguments: <code>rect</code> (Target), <code>viewport</code><br />
                Return: <code>{`{ rect: {x,y,w,h}, worldWidth: number }`}</code>
              </div>
            </div>
          </div>
        </div>

        <aside className="info-panel">
          <section>
            <h3>Target Controls</h3>
            <div className="control-group">
              <label>Resize Width (±{resizeStep}px)</label>
              <div className="button-group">
                <button onClick={() => handleResize(-resizeStep)}>−</button>
                <button onClick={() => handleResize(resizeStep)}>+</button>
              </div>
            </div>
            <div className="control-group">
              <label>Step Size</label>
              <input 
                type="number" min="1" max="100" 
                value={resizeStep} 
                onChange={(e) => setResizeStep(Number(e.target.value) || 1)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '4px' }}
              />
            </div>
          </section>

          <section>
            <h3>Viewport Controls</h3>
            <div className="control-group">
              <label>Width</label>
              <input 
                type="range" min="100" max="1200" 
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
              <label>Height</label>
              <input 
                type="range" min="100" max="1200" 
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
