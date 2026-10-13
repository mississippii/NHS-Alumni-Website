import { useRef } from 'react';
import { Icon } from './Icon.jsx';

/** Swipeable row (native scroll-snap). Arrow buttons only when there is more than a desktop row holds; touch screens just swipe. */
export function Carousel({ children, arrows }) {
  const ref = useRef(null);
  const go = dir => ref.current.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div className="carousel">
      {arrows && <button type="button" className="carousel-btn prev" onClick={() => go(-1)} aria-label="Previous"><Icon name="chevron" /></button>}
      <div className="carousel-track" ref={ref}>{children}</div>
      {arrows && <button type="button" className="carousel-btn next" onClick={() => go(1)} aria-label="Next"><Icon name="chevron" /></button>}
    </div>
  );
}
