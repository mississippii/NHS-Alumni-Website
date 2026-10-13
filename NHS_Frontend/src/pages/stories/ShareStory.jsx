import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { submitStory } from '../../api/public.js';
import { Field } from '../../components/form/Field.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { useTitle } from '../../lib/hooks.js';
import { shrink } from '../../lib/photo.js';
import { STORY_KINDS, THIS_YEAR } from '../../lib/school.js';

/** /stories/share: anyone can send a success story or a batch memory; it appears once the admin approves it. */
export default function ShareStory() {
  useTitle('Share a story');
  const [f, setF] = useState({ kind: STORY_KINDS[0], name: '', contact: '', batch: '', title: '', body: '', website: '' });
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));

  const pickPhoto = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const blob = await shrink(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError('That file isn’t a photo we can use. Try a JPEG or PNG.');
    }
  };
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await submitStory({ ...f, batch: f.batch ? +f.batch : null }, photo?.blob);
      setSent(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (sent) return (
    <div className="wrap section"><div className="card">
      <Empty icon="inbox" title="Thank you for sharing!" action={<Link className="btn btn-primary" to="/stories">Back to stories</Link>}>
        An admin will read your story and may contact you. It appears on the Stories page once it’s approved.
      </Empty>
    </div></div>
  );

  const memory = f.kind === 'Batch memory';
  return (
    <>
      <PageHeader crumbs={[['/stories', 'Stories'], [null, 'Share']]} title="Share a story"
        desc="Tell us about an alumnus’s journey, or a memory from your batch days. An admin reads every story before it goes live." />
      <form className="wrap form" onSubmit={submit}>
        <section className="card card-pad form-card form-one">
          <fieldset className="kind-pick">
            <legend className="field-label">What are you sharing?</legend>
            {STORY_KINDS.map(k => (
              <label key={k} className={`kind ${f.kind === k ? 'on' : ''}`}>
                <input type="radio" name="kind" className="sr-only" value={k} checked={f.kind === k} onChange={set('kind')} />
                <Icon name={k === 'Batch memory' ? 'users' : 'cap'} />
                <b>{k}</b>
                <small>{k === 'Batch memory' ? 'Classmates, teachers, the last day of school…' : 'A journey that can inspire today’s students'}</small>
              </label>
            ))}
          </fieldset>
          <div className="form-grid">
            <Field label="Your name" required><input className="input" required maxLength={120} autoComplete="name" value={f.name} onChange={set('name')} /></Field>
            <Field label="Your batch" hint="Year of SSC"><input className="input" type="number" min="1958" max={THIS_YEAR} value={f.batch} onChange={set('batch')} /></Field>
            <Field label="Phone or email" hint="Only the admin sees this" wide required>
              <input className="input" required maxLength={120} value={f.contact} onChange={set('contact')} />
            </Field>
            <Field label="Headline" wide required>
              <input className="input" required maxLength={150} placeholder={memory ? 'e.g. Our last day at Nimsar, 2005' : 'e.g. From Nimsar to a lecturer at BUET'}
                value={f.title} onChange={set('title')} />
            </Field>
            <Field label={memory ? 'The memory' : 'The story'} hint={`${f.body.length}/10000 · leave a blank line between paragraphs`} wide required>
              <textarea className="input textarea story-input" required maxLength={10000} rows="10" value={f.body} onChange={set('body')} />
            </Field>
          </div>
          <div className="photo-pick">
            {photo && <img className="story-thumb" src={photo.url} alt="" />}
            <label className="btn btn-secondary btn-sm">
              <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
              {photo ? 'Change photo' : 'Add a photo'}
            </label>
            {photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>Remove</button>}
          </div>
          {/* honeypot: hidden from people, bots fill it in */}
          <input className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} />
        </section>
        <div className="form-submit">
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send for review'}</button>
        </div>
      </form>
    </>
  );
}
