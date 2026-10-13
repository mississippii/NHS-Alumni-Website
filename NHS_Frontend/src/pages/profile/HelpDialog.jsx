import { useEffect, useRef, useState } from 'react';
import { sendHelp } from '../../api/public.js';
import { Icon } from '../../components/Icon.jsx';

/** "Help" popup: a note to the admin for what the student can't change themselves, like a misspelled name.
 * Native <dialog>: focus trap, Escape and the backdrop come with it. */
export default function HelpDialog({ id, onClose }) {
  const ref = useRef(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState(null); // null | 'busy' | 'sent' | error text
  useEffect(() => { ref.current.showModal(); }, []);
  const submit = e => {
    e.preventDefault();
    if (state === 'sent') return ref.current.close();
    setState('busy');
    sendHelp(id, { message }).then(() => setState('sent'), err => setState(err.message));
  };
  return (
    <dialog ref={ref} className="pin-dialog help-dialog" onClose={onClose} aria-labelledby="help-title">
      <form onSubmit={submit}>
        <span className="pin-icon"><Icon name={state === 'sent' ? 'verified' : 'info'} /></span>
        {state === 'sent' ? (
          <>
            <h2 id="help-title">Request sent</h2>
            <p className="text-2" role="status">The admin will check it and fix your profile.</p>
            <button className="btn btn-primary" type="submit" autoFocus>OK</button>
          </>
        ) : (
          <>
            <h2 id="help-title">What needs fixing?</h2>
            <textarea className="input" rows={4} required maxLength={1000} value={message} onChange={e => setMessage(e.target.value)}
              aria-label="What needs fixing?" placeholder="e.g. My name is spelled wrong. It should be …" autoFocus />
            {state && state !== 'busy' && <p className="err" role="alert">{state}</p>}
            <div className="btn-row">
              <button className="btn btn-ghost" type="button" onClick={() => ref.current.close()}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={state === 'busy'}>Submit</button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
