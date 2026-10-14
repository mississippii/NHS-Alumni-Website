import { get, post, sendForm } from './client.js';

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
  const { card, ...rest } = d;
  return { ...card, ...rest };
}
export const getAlumnusRaw = id => get(`/alumni/${id}`, { notFound: null });
export const listBatches = () => get('/batches');
export const getStats = () => get('/stats');
export const listEvents = () => get('/events');
/** Members' comments (the profile form's comment box), newest first. */
export const listComments = () => get('/comments');
/** Anonymous like: the server keeps only the count. */
/** Reply to a comment as the student with this ID; parentId = the reply being answered. */
export const addReply = (commentId, studentId, text, parentId) => post(`/comments/${commentId}/replies`, { studentId: +studentId, text, parentId });
export const likeComment = (id, undo) => post(`/comments/${id}/like${undo ? '?undo=true' : ''}`);
export const checkRoll = (id, roll) => post(`/alumni/${id}/roll`, { roll: +roll });
/** Home page: batch + group + SSC roll → { id } of that student's record. */
export const findByRoll = (batch, group, roll) => post('/roll', { batch: +batch, group, roll: +roll });
/** Profile form, step 1: checks the form and emails a PIN. id = null for a new member (join). Errors carry the server's reason. */
export const requestPin = (id, form) => post(id ? `/alumni/${id}/pin` : '/alumni/join/pin', form);
/** "Edit profile" on a claimed profile: a PIN to the saved email → { email: masked }; then the PIN → its private fields. */
export const unlockProfile = id => post(`/alumni/${id}/unlock`, {});
export const checkUnlock = (id, pin) => post(`/alumni/${id}/unlock/check`, { pin });
/** Step 2: save with the PIN from the email. */
export async function saveProfile(id, form, photo) {
  const body = new FormData();
  body.append('form', new Blob([JSON.stringify(form)], { type: 'application/json' }));
  if (photo) body.append('photo', photo, 'photo.jpg');
  const res = await fetch(id ? `/api/alumni/${id}/submit` : '/api/alumni/join', { method: 'POST', body });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Couldn’t save (${res.status}). Try again.`);
  return res.json();
}
/** "Help" from a profile: { message } goes to the admin's notifications. */
export const sendHelp = (id, form) => post(`/alumni/${id}/help`, form);
/** Success stories, most recent first: the website shows the latest `limit`. */
export const listStories = (limit = 12) => get(`/stories?limit=${limit}`);
export const getStory = id => get(`/stories/${id}`, { notFound: null });
/** "Share a story": waits for the admin. form = { studentId, body, website (honeypot) }. */
export const submitStory = (form, photo) => sendForm('/stories/submit', {}, form, photo);
/** The footer's visitor number: counts this browser once a day (the day is remembered here), else just reads it. */
export function visits() {
  const today = new Date().toDateString();
  let seen = null;
  try { seen = localStorage.getItem('nhs-visit'); localStorage.setItem('nhs-visit', today); } catch { /* private mode: counts each load */ }
  return seen === today ? get('/visits') : post('/visits');
}
