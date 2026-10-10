// All data comes from the Spring Boot backend (NHS-Backend). In dev, Vite proxies /api to it (see vite.config.js).
export const SCHOOL = { short: 'NHS', name: 'Nimsar High School', est: null, city: null };
// A batch is the year its students passed the SSC exam (passed SSC in 2014 = Batch 2014).
export const THIS_YEAR = new Date().getFullYear();
export const isJubilee = y => [10, 25, 40, 50].includes(THIS_YEAR - y);
export const fullName = p => p.name;
// Student ID YYDDSSS (batch, department, serial). Stored as a number, so batch 2006 loses its leading zero: put it back.
export const studentId = id => String(id).padStart(7, '0');

async function get(path, { notFound } = {}) {
  const res = await fetch('/api' + path);
  if (res.status === 404 && notFound !== undefined) return notFound;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** f = { q, batch, decade, groups[], industries[], country, joined, sort, page, size } — all optional */
export function listAlumni(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.batch) p.set('batch', f.batch);
  else if (f.decade) p.set('decade', f.decade);
  (f.groups || []).forEach(g => p.append('group', g));
  (f.industries || []).forEach(g => p.append('field', g));
  (f.blood || []).forEach(b => p.append('blood', b));
  if (f.country) p.set('country', f.country);
  if (f.joined) p.set('joined', 'true');
  if (f.size) p.set('size', f.size);
  p.set('sort', f.sort || 'id');
  p.set('page', f.page || 1);
  return get('/alumni?' + p);
}

export async function getAlumnus(id) {
  const d = await get(`/alumni/${id}`, { notFound: null });
  if (!d) return null;
  const { card, education, career, ...rest } = d;
  const byYear = (a, b) => (b ?? 0) - (a ?? 0);
  return {
    ...card, ...rest,
    // Newest first. Current job (title/org) comes before past jobs; SSC at this school is always the last education row.
    career: [
      ...(card.title || card.org ? [{ when: 'Now', title: card.title || card.industry, org: card.org }] : []),
      ...[...career].sort((a, b) => byYear(a.from, b.from)).map(j => ({
        when: [j.from, j.to ?? 'now'].filter(Boolean).join(' – '), title: j.title, org: j.org,
      })),
    ],
    education: [
      ...[...education].sort((a, b) => byYear(a.year, b.year)).map(e => ({
        when: e.year ? String(e.year) : '', title: e.institution, org: [e.level, e.subject].filter(Boolean).join(', ') || null,
      })),
      { when: String(card.batch), title: SCHOOL.name, org: `School · SSC, ${card.group}` },
    ],
  };
}

export const listFeatured = () => get('/alumni/featured').then(list => list.map(({ card, ...rest }) => ({ ...card, ...rest })));
export const listBatches = () => get('/batches');
export const listCountries = () => get('/countries');
export const getStats = () => get('/stats');
export const listEvents = () => get('/events');

async function post(path, body) {
  const res = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Couldn’t send (${res.status}). Try again.`);
  return res.json();
}

export const getAlumnusRaw = id => get(`/alumni/${id}`, { notFound: null });
/** Profile form, step 1: checks the form and emails a PIN. id = null for a new member (join). Errors carry the server's reason. */
export const requestPin = (id, form) => post(id ? `/alumni/${id}/pin` : '/alumni/join/pin', form);
/** Step 2: save with the PIN from the email. */
export async function saveProfile(id, form, photo) {
  const body = new FormData();
  body.append('form', new Blob([JSON.stringify(form)], { type: 'application/json' }));
  if (photo) body.append('photo', photo, 'photo.jpg');
  const res = await fetch(id ? `/api/alumni/${id}/submit` : '/api/alumni/join', { method: 'POST', body });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Couldn’t save (${res.status}). Try again.`);
  return res.json();
}
