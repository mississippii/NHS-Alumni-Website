import { useEffect, useRef, useState } from 'react';

const OUT = 800;    // the square JPEG sent to the server, in px
const MAX_ZOOM = 4;

/**
 * "Adjust your photo": the picked photo in a square frame; drag to move it, pinch / slider / mouse wheel to zoom.
 * onDone(blob) gets exactly the square shown in the frame, so the server's own square crop changes nothing.
 * Native <dialog>: focus trap, Escape and the backdrop come with it.
 */
export function PhotoCrop({ file, onDone, onCancel, onError }) {
  const ref = useRef(null);
  const frame = useRef(null);
  const ptrs = useRef(new Map()); // fingers / mouse on the frame: id → last {x, y}
  const [src, setSrc] = useState(null);
  const [img, setImg] = useState(null);  // { w, h, bitmap }
  const [side, setSide] = useState(0);   // frame size on screen, px
  const [v, setV] = useState({ zoom: 1, x: 0, y: 0 }); // x, y: image centre's offset from the frame centre, screen px

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let bitmap;
    createImageBitmap(file).then(b => { bitmap = b; setSrc(url); setImg({ w: b.width, h: b.height, bitmap: b }); }, onError);
    ref.current.showModal();
    return () => { URL.revokeObjectURL(url); bitmap?.close(); };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (img) setSide(frame.current.clientWidth); }, [img]);

  // the photo always covers the frame: zoom 1 = its short side fills it
  const scale = img && side ? (side / Math.min(img.w, img.h)) * v.zoom : 0;
  const fit = ({ zoom, x, y }) => {
    zoom = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const k = (side / Math.min(img.w, img.h)) * zoom;
    const mx = (img.w * k - side) / 2, my = (img.h * k - side) / 2;
    return { zoom, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };
  const zoomTo = zoom => setV(s => fit({ ...s, zoom, x: s.x * zoom / s.zoom, y: s.y * zoom / s.zoom }));

  const down = e => { e.currentTarget.setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const up = e => ptrs.current.delete(e.pointerId);
  const move = e => {
    const p = ptrs.current;
    const last = p.get(e.pointerId);
    if (!last) return;
    const now = { x: e.clientX, y: e.clientY };
    if (p.size === 2) { // pinch: zoom by how much the two fingers spread
      const other = [...p.entries()].find(([id]) => id !== e.pointerId)[1];
      const before = Math.hypot(last.x - other.x, last.y - other.y), after = Math.hypot(now.x - other.x, now.y - other.y);
      if (before > 0) setV(s => { const zoom = s.zoom * after / before; return fit({ zoom, x: s.x * zoom / s.zoom, y: s.y * zoom / s.zoom }); });
    } else {
      setV(s => fit({ ...s, x: s.x + now.x - last.x, y: s.y + now.y - last.y }));
    }
    p.set(e.pointerId, now);
  };

  const done = () => {
    const cut = side / scale; // the frame's side, in photo px
    const sx = img.w / 2 - v.x / scale - cut / 2, sy = img.h / 2 - v.y / scale - cut / 2;
    const out = Math.min(OUT, Math.round(cut));
    const c = Object.assign(document.createElement('canvas'), { width: out, height: out });
    c.getContext('2d').drawImage(img.bitmap, sx, sy, cut, cut, 0, 0, out, out);
    c.toBlob(b => (b ? onDone(b) : onError()), 'image/jpeg', 0.9);
  };

  return (
    <dialog ref={ref} className="pin-dialog crop-dialog" aria-labelledby="crop-title" onCancel={e => { e.preventDefault(); onCancel(); }}>
      <div className="crop-sheet">
        <h2 id="crop-title">Adjust your photo</h2>
        <p className="text-2">Drag to move · pinch or slide to zoom</p>
        <div className="crop-frame" ref={frame} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onWheel={e => zoomTo(v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))}>
          {src && scale > 0 && (
            <img src={src} alt="" draggable={false}
              style={{ width: img.w * scale, height: img.h * scale, transform: `translate(calc(-50% + ${v.x}px), calc(-50% + ${v.y}px))` }} />
          )}
        </div>
        <input className="crop-zoom" type="range" min="1" max={MAX_ZOOM} step="0.01" value={v.zoom} aria-label="Zoom"
          onChange={e => zoomTo(+e.target.value)} disabled={!scale} />
        <div className="crop-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={done} disabled={!scale}>Use photo</button>
        </div>
      </div>
    </dialog>
  );
}
