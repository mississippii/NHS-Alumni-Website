import { Link } from 'react-router-dom';
import { Empty } from '../components/page.jsx';
import { useTitle } from '../lib/hooks.js';

/** Placeholder for pages not built yet, and for unknown addresses. */
export default function ComingSoon({ title }) {
  useTitle(title);
  return (
    <div className="wrap section">
      <div className="card">
        <Empty icon="info" title={title} action={<Link className="btn btn-primary" to="/">Back to home</Link>}>
          This page is coming soon.
        </Empty>
      </div>
    </div>
  );
}
