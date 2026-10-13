import { useEffect, useState } from 'react';
import { deleteEvent, listAdminEvents, saveEvent } from '../../api/admin.js';
import { EventDetails } from '../../components/EventDetails.jsx';
import { Field } from '../../components/form/Field.jsx';
import { Empty } from '../../components/page.jsx';

const NO_EVENT = { id: null, date: '', time: '', title: '', place: '', details: '' };

/** Events: the editor on top, then every event, newest first (past ones marked). */
export default function AdminEvents({ token }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState(NO_EVENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const today = new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd, local time

  const reload = () => listAdminEvents(token).then(setList, e => setError(e.message));
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await saveEvent(token, f); setF(NO_EVENT); reload(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const remove = async ev => {
    if (!window.confirm(`Delete “${ev.title}”?`)) return;
    try { await deleteEvent(token, ev.id); if (f.id === ev.id) setF(NO_EVENT); reload(); } catch (err) { setError(err.message); }
  };
  const edit = ev => {
    setF({ id: ev.id, date: ev.date, time: ev.time || '', title: ev.title, place: ev.place || '', details: ev.details || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="wrap form admin-page">
      <form className="card card-pad form-card form-one" onSubmit={submit}>
        <h2 className="card-title">{f.id ? 'Edit event' : 'New event'}</h2>
        <div className="form-grid">
          <Field label="Title" wide required><input className="input" required maxLength={150} placeholder="e.g. Batch 2010 reunion" value={f.title} onChange={set('title')} /></Field>
          <Field label="Date" required><input className="input" type="date" required value={f.date} onChange={set('date')} /></Field>
          <Field label="Time"><input className="input" maxLength={30} placeholder="e.g. 4:00 PM" value={f.time} onChange={set('time')} /></Field>
          <Field label="Place" wide><input className="input" maxLength={150} placeholder="e.g. School field" value={f.place} onChange={set('place')} /></Field>
          <Field label="Details" wide><textarea className="input textarea" rows="4" maxLength={2000} value={f.details} onChange={set('details')} /></Field>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="admin-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : f.id ? 'Save changes' : 'Add event'}</button>
          {f.id && <button className="btn btn-secondary" type="button" onClick={() => setF(NO_EVENT)}>Cancel</button>}
        </div>
      </form>

      {list?.length === 0 && <div className="card"><Empty icon="calendar" title="No events yet" /></div>}
      {list?.map(ev => {
        const d = new Date(ev.date + 'T00:00:00');
        return (
          <section key={ev.id} className="card event">
            <div className="event-date"><span>{d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</span><b>{d.getDate()}</b></div>
            <div>
              <h3>{ev.title} {ev.date < today && <span className="badge">Past</span>}</h3>
              <p>{[d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), ev.time, ev.place].filter(Boolean).join(' · ')}</p>
              {ev.details && <EventDetails text={ev.details} />}
              <div className="admin-actions">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => edit(ev)}>Edit</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(ev)}>Delete</button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
