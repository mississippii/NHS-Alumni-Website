import { listComments, listEvents } from '../../api/public.js';
import { SectionHead } from '../../components/page.jsx';
import { useAsync, useTitle } from '../../lib/hooks.js';
import Comments from './Comments.jsx';
import EventList from './EventList.jsx';

/** /events: every upcoming event and all comments. */
export default function Events() {
  useTitle('Events');
  const events = useAsync(listEvents, []);
  const comments = useAsync(listComments, []);
  return (
    <section className="section">
      <div className="wrap">
        <SectionHead title="Upcoming events" />
        {events.data && <EventList list={events.data} />}
        {comments.data?.length > 0 && <Comments list={comments.data} />}
      </div>
    </section>
  );
}
