import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';

const RESEND_SECONDS = 60;
/** The "enter your PIN" box. Native <dialog>: focus trap, Escape and the backdrop come with it. */
export default function PinDialog({ email, onClose, onConfirm, onResend }) {
  const ref = useRef(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => { ref.current.showModal(); }, []);
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const run = async (fn, after) => {
    setBusy(true); setMsg(null);
    try { await fn(); after?.(); } catch (err) { setMsg({ err: true, text: err.message }); } finally { setBusy(false); }
  };
  const confirm = e => { e.preventDefault(); run(() => onConfirm(pin)); };
  const resend = () => run(onResend, () => { setWait(RESEND_SECONDS); setPin(''); setMsg({ text: 'A new PIN is on its way.' }); });

  return (
    <dialog ref={ref} className="pin-dialog" onClose={onClose} aria-labelledby="pin-title">
      <form onSubmit={confirm}>
        <span className="pin-icon"><Icon name="mail" /></span>
        <h2 id="pin-title">Check your email</h2>
        <p className="text-2">We sent a 6-digit PIN to <b>{email}</b>. It works for 10 minutes.</p>
        <input className="input pin-input num" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}"
          maxLength={6} placeholder="••••••" aria-label="PIN" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        {msg && <p className={msg.err ? 'err' : 'text-2'} role={msg.err ? 'alert' : 'status'}>{msg.text}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || pin.length !== 6}>{busy ? 'Saving…' : 'Confirm'}</button>
        <div className="pin-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current.close()}>Change email</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={busy || wait > 0}>
            {wait > 0 ? `Resend in ${wait}s` : 'Resend PIN'}
          </button>
        </div>
        <p className="pin-note">Not in your inbox? Check the spam folder.</p>
      </form>
    </dialog>
  );
}
