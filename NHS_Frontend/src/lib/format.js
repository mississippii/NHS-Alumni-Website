// How names, IDs, dates and text are shown.
import { GROUPS } from './school.js';

export const fullName = p => p.name || 'Name not added yet';
export const storyName = s => s.name || 'Name not added yet';
export const studentId = id => String(id);
/** Student IDs are YYYYDDSSS (201403005 = batch 2014, Science, 5th). Old 7-digit links (YYDDSSS) still open the right profile. */
export const currentId = id => (id > 0 && id < 1e7 ? (Math.floor(id / 1e5) >= 58 ? 1900 : 2000) * 1e5 + id : id);
export const groupShort = g => (g === 'Business Studies' ? 'Business' : g);
/** Initials take their group's colour: "tint t-science" etc., empty when unknown. */
export const tint = group => {
  const g = GROUPS.find(x => x.name === group);
  return g ? `tint t-${g.cls.slice(2)}` : '';
};
export const initials = name => {
  if (!name) return '?';
  const w = name.split(' ').filter(x => x && x !== 'Md.');
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};
export const deathDate = p => (p.passedOn
  ? new Date(p.passedOn + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : p.passedYear); // only the year is known for some
export const memorialLine = p => `Remembering${deathDate(p) ? ` · ${deathDate(p)}` : ''}`;
/** 12 Oct 2026 */
export const shortDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** Paragraphs are separated by blank lines. */
export const paragraphs = text => text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
export const excerpt = (text, n = 180) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.lastIndexOf(' ', n);
  return t.slice(0, cut > 0 ? cut : n) + '…';
};
