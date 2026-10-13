/** Batch cards gliding past in a loop. The list is drawn twice so it wraps seamlessly; the copy is
 * hidden from keyboards and screen readers. Hover or focus pauses it; with "reduce motion" it becomes a plain swipeable row.
 * ponytail: needs a list at least as wide as the screen, or a gap shows before it wraps. */
export default function Marquee({ items, render, secs }) {
  return (
    <div className="marquee" style={{ '--dur': `${items.length * secs}s` }}>
      <div className="marquee-track">
        {items.map(render)}
        <div className="marquee-copy" aria-hidden="true" inert="">{items.map(render)}</div>
      </div>
    </div>
  );
}
