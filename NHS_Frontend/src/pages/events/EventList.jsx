import { EventDetails } from '../../components/EventDetails.jsx';
import { Icon } from '../../components/Icon.jsx';

const fmtDate = iso => {
  const d = new Date(iso + 'T00:00:00');
  return { day: d.getDate(), mon: d.toLocaleString('en', { month: 'short' }).toUpperCase() };
};

/** Upcoming events, soonest first, or a note that none are announced. */
export default function EventList({ list }) {
  return list?.length > 0 ? (
    <div className="events">
      {list.map(e => {
        const d = fmtDate(e.date);
        return (
          <article className="card event" key={e.id}>
            <time className="event-date" dateTime={e.date}><span>{d.mon}</span><b className="num">{d.day}</b></time>
            <div>
              <h3>{e.title}</h3>
              {(e.place || e.time) && <p>{[e.place, e.time].filter(Boolean).join(' · ')}</p>}
              {e.details && <EventDetails text={e.details} />}
            </div>
          </article>
        );
      })}
    </div>
  ) : (
    <div className="card events-empty"><Icon name="calendar" />No reunions announced yet. Check back soon.</div>
  );
}
