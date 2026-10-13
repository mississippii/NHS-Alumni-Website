import { Icon } from '../Icon.jsx';
import { SOCIAL } from '../SocialLinks.jsx';
import { Field } from './Field.jsx';

const SOCIAL_HINT = { facebook: 'facebook.com/your.name', linkedin: 'linkedin.com/in/your-name', youtube: 'youtube.com/@channel', twitter: 'x.com/username' };
/** Saved links (a [{type, url}] list or a {type: url} map) → form rows; one empty Facebook row when there are none. */
export const socialRows = links => {
  const rows = (Array.isArray(links) ? links.map(l => [l.type, l.url]) : Object.entries(links || {}))
    .filter(([t, u]) => SOCIAL[t] && u).map(([type, url]) => ({ type, url }));
  return rows.length ? rows : [{ type: 'facebook', url: '' }];
};
/** Form rows → the {facebook, linkedin, youtube, twitter} map the API takes ('' clears a site). */
export const socialMap = rows => ({
  ...Object.fromEntries(Object.keys(SOCIAL).map(t => [t, ''])),
  ...Object.fromEntries(rows.filter(r => r.url.trim()).map(r => [r.type, r.url.trim()])),
});

/** Site dropdown + link box per row; each site once (shared with the admin's memorial form). */
export function SocialInputs({ socials, setSocials }) {
  const setRow = (i, k) => e => setSocials(rows => rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const unused = Object.keys(SOCIAL).filter(t => !socials.some(r => r.type === t));
  return (
    <>
      <ol className="edu-rows social-rows">
        {socials.map((r, i) => {
          const s = SOCIAL[r.type];
          return (
            <li key={i} className="edu-row">
              <Field label="Social media">
                <select className="select" value={r.type} onChange={setRow(i, 'type')}>
                  {Object.entries(SOCIAL).map(([t, x]) => (
                    <option key={t} value={t} disabled={t !== r.type && socials.some(o => o.type === t)}>{x.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Profile link">
                <span className="input-brand">
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ color: s.color }}>{s.svg}</svg>
                  <input className="input" inputMode="url" autoCapitalize="off" spellCheck="false" placeholder={SOCIAL_HINT[r.type]}
                    value={r.url} onChange={setRow(i, 'url')} />
                </span>
              </Field>
              {socials.length > 1 && (
                <button type="button" className="btn btn-ghost edu-remove" onClick={() => setSocials(rows => rows.filter((_, j) => j !== i))} aria-label={`Remove ${s.label} link`}>
                  <Icon name="x" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {unused.length > 0 && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSocials(rows => [...rows, { type: unused[0], url: '' }])}>+ Add another</button>
      )}
    </>
  );
}
