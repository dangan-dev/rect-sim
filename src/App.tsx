import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function App() {
  // シミュレーションの状態を一つにまとめて管理（サクサク動くように！）
  const [state, setState] = useState({
    worldSize: { width: 800, height: 600 },
    targetRect: { x: 100, y: 100, width: 150, height: 100 }
  });

  // ビューポートの状態
  const [viewport, setViewport] = useState<Rect>({
    x: 0,
    y: 0,
    width: 800,
    height: 600
  });

  // ドラッグ操作の状態
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // ドラッグのオフセットをRefで保持

  // リサイズ時の増分（ステップ）
  const [resizeStep, setResizeStep] = useState(100);

  // ユーザー定義のスクリプト
  const [script, setScript] = useState<string>(`const maxW = Math.max(world.width, rect.width);
return {
  rect: {
    ...rect,
    x: Math.max(viewport.x, Math.min(rect.x, viewport.x + viewport.width - rect.width)),
    width: Math.min(rect.width, viewport.width)
  },
  worldWidth: maxW,
  worldHeight: world.height
};`);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // スクリプトを適用する純粋な関数
  const applyScriptInternal = useCallback((rect: Rect, vp: Rect, world: {width: number, height: number}, currentScript: string) => {
    try {
      const fn = new Function('rect', 'viewport', 'world', currentScript);
      const result = fn(rect, vp, world);
      
      let ww = world.width;
      let wh = world.height;
      let r = rect;

      if (result) {
        if (typeof result.worldWidth === 'number') ww = result.worldWidth;
        if (typeof result.worldHeight === 'number') wh = result.worldHeight;
        if (result.rect && typeof result.rect.x === 'number') r = result.rect;
      }
      
      return { rect: r, worldWidth: ww, worldHeight: wh, error: null };
    } catch (err) {
      return { rect, worldWidth: world.width, worldHeight: world.height, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  // 状態を更新するコアロジック（常に最新の state を使うように functional update を使用）
  const updateSim = useCallback((proposedRect: Rect) => {
    setState(prev => {
      const { rect, worldWidth, worldHeight, error } = applyScriptInternal(proposedRect, viewport, prev.worldSize, script);
      setScriptError(error);
      return {
        targetRect: rect,
        worldSize: { width: worldWidth, height: worldHeight }
      };
    });
  }, [applyScriptInternal, viewport, script]);

  // 手動リサイズ関数
  const handleResize = useCallback((delta: number) => {
    setState(prev => {
      const newWidth = Math.max(10, prev.targetRect.width + delta);
      const diff = prev.targetRect.width - newWidth;
      const proposed = { 
        ...prev.targetRect, 
        x: prev.targetRect.x + (diff / 2),
        width: newWidth 
      };
      const { rect, worldWidth, worldHeight, error } = applyScriptInternal(proposed, viewport, prev.worldSize, script);
      setScriptError(error);
      return {
        targetRect: rect,
        worldSize: { width: worldWidth, height: worldHeight }
      };
    });
  }, [applyScriptInternal, viewport, script]);

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
      if (e.key === '+' || e.key === '=') handleResize(resizeStep);
      else if (e.key === '-' || e.key === '_') handleResize(-resizeStep);
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
    dragOffsetRef.current = {
      x: transformedPoint.x - state.targetRect.x,
      y: transformedPoint.y - state.targetRect.y
    };
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

    setState(prev => {
      const proposed = {
        ...prev.targetRect,
        x: transformedPoint.x - dragOffsetRef.current.x,
        y: transformedPoint.y - dragOffsetRef.current.y
      };
      const { rect, worldWidth, worldHeight, error } = applyScriptInternal(proposed, viewport, prev.worldSize, script);
      setScriptError(error);
      return {
        targetRect: rect,
        worldSize: { width: worldWidth, height: worldHeight }
      };
    });
  }, [isDragging, viewport, script, applyScriptInternal]);

  // スクリプトやViewportが変更された時にも即座に適用
  useEffect(() => {
    updateSim(state.targetRect);
  }, [script, viewport]); // state.targetRect は依存関係から外して、変更時のみ反応させる

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
            viewBox={`-40 -40 ${state.worldSize.width + 80} ${state.worldSize.height + 80}`}
            className="world-svg"
          >
            {/* 仮想ワールドの背景 */}
            <rect x="0" y="0" width={state.worldSize.width} height={state.worldSize.height} fill="#f0f0f0" />
            
            {/* 仮想ワールドのサイズ表示 (中心) */}
            <text 
              x={state.worldSize.width / 2} 
              y={state.worldSize.height / 2} 
              fill="#94a3b8" 
              fontSize="24" 
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none', opacity: 0.5 }}
            >
              {Math.round(state.worldSize.width)} x {Math.round(state.worldSize.height)}
            </text>
            
            {/* グリッド (オプション) */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#ddd" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={state.worldSize.width} height={state.worldSize.height} fill="url(#grid)" />

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
            
            {/* スクロールバー */}
            {state.worldSize.height > viewport.height && (
              <g className="scrollbar-v">
                <rect x={viewport.x + viewport.width - 12} y={viewport.y + 4} width={8} height={viewport.height - 8} fill="#cbd5e1" fillOpacity="0.3" rx="4" />
                <rect x={viewport.x + viewport.width - 11} y={viewport.y + 4 + (viewport.y / state.worldSize.height) * (viewport.height - 8)} width={6} height={(viewport.height / state.worldSize.height) * (viewport.height - 8)} fill="#64748b" fillOpacity="0.6" rx="3" />
              </g>
            )}
            {state.worldSize.width > viewport.width && (
              <g className="scrollbar-h">
                <rect x={viewport.x + 4} y={viewport.y + viewport.height - 12} width={viewport.width - 8} height={8} fill="#cbd5e1" fillOpacity="0.3" rx="4" />
                <rect x={viewport.x + 4 + (viewport.x / state.worldSize.width) * (viewport.width - 8)} y={viewport.y + viewport.height - 11} width={(viewport.width / state.worldSize.width) * (viewport.width - 8)} height={6} fill="#64748b" fillOpacity="0.6" rx="3" />
              </g>
            )}

            {/* ビューポート座標 */}
            <text x={viewport.x} y={viewport.y-12} fill="#007bff" fontSize="16" fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}>
              ({Math.round(viewport.x)}, {Math.round(viewport.y)})
            </text>
            <text x={viewport.x + viewport.width} y={viewport.y + viewport.height+12} fill="#007bff" fontSize="16" fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}>
              ({Math.round(viewport.x + viewport.width)}, {Math.round(viewport.y + viewport.height)})
            </text>

            {/* 操作対象の矩形 */}
            <rect
              x={state.targetRect.x}
              y={state.targetRect.y}
              width={state.targetRect.width}
              height={state.targetRect.height}
              fill="#ff4757"
              fillOpacity="0.8"
              stroke="#c0392b"
              strokeWidth="2"
              className="draggable-rect"
              onMouseDown={handleMouseDown}
            />
            {/* Target Rect サイズ表示 (中心) */}
            <text x={state.targetRect.x + state.targetRect.width / 2} y={state.targetRect.y + state.targetRect.height / 2} fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>
              {Math.round(state.targetRect.width)} x {Math.round(state.targetRect.height)}
            </text>
            {/* Target Rect 座標 */}
            <text x={state.targetRect.x} y={state.targetRect.y - 15} fill="#c0392b" fontSize="16" fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}>
              ({Math.round(state.targetRect.x)}, {Math.round(state.targetRect.y)})
            </text>
            <text x={state.targetRect.x + state.targetRect.width} y={state.targetRect.y + state.targetRect.height + 15} fill="#c0392b" fontSize="16" fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'white', strokeWidth: '4px' }}>
              ({Math.round(state.targetRect.x + state.targetRect.width)}, {Math.round(state.targetRect.y + state.targetRect.height)})
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
                placeholder="return { rect, worldWidth: 800, worldHeight: 600 };"
              />
              <div className="script-footer">
                Arguments: <code>rect</code>, <code>viewport</code>, <code>world</code><br />
                Return: <code>{`{ rect: {x,y,w,h}, worldWidth, worldHeight }`}</code>
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
              <input type="number" min="1" max="1000" value={resizeStep} onChange={(e) => setResizeStep(Number(e.target.value) || 1)} />
            </div>
          </section>

          <section>
            <h3>World Controls</h3>
            <div className="control-group">
              <label>World Width</label>
              <input type="number" min="100" max="5000" value={state.worldSize.width} onChange={(e) => setState(prev => ({ ...prev, worldSize: { ...prev.worldSize, width: Number(e.target.value) || 100 } }))} />
            </div>
            <div className="control-group">
              <label>World Height</label>
              <input type="number" min="100" max="5000" value={state.worldSize.height} onChange={(e) => setState(prev => ({ ...prev, worldSize: { ...prev.worldSize, height: Number(e.target.value) || 100 } }))} />
            </div>
          </section>

          <section>
            <h3>Viewport Controls</h3>
            <div className="control-group">
              <label>Width</label>
              <input type="range" min="100" max="2000" value={viewport.width} onChange={(e) => setViewport(prev => ({ ...prev, width: parseInt(e.target.value) }))} />
            </div>
            <div className="control-group">
              <label>Height</label>
              <input type="range" min="100" max="2000" value={viewport.height} onChange={(e) => setViewport(prev => ({ ...prev, height: parseInt(e.target.value) }))} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default App
