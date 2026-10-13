// The fetch layer. All data comes from the Spring Boot backend (NHS-Backend); in dev, Vite proxies /api to it (see vite.config.js).
export async function get(path, { notFound } = {}) {
  const res = await fetch('/api' + path);
  if (res.status === 404 && notFound !== undefined) return notFound;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
export async function post(path, body) {
  const res = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Couldn’t send (${res.status}). Try again.`);
  return res.json();
}
/** Admin calls carry the token from the admin page; a wrong token comes back as status 401. */
export async function admin(path, token, method = 'GET', body) {
  const headers = { 'X-Admin-Token': token, ...(body && { 'Content-Type': 'application/json' }) };
  const res = await fetch('/api/admin' + path, { method, headers, body: body && JSON.stringify(body) });
  if (!res.ok) {
    const msg = (await res.json().catch(() => null))?.message;
    throw Object.assign(new Error(msg || `Request failed (${res.status})`), { status: res.status });
  }
  return method === 'GET' || body ? res.json() : null;
}
/** A JSON form plus an optional photo, sent as multipart (stories, memorials). */
export async function sendForm(path, headers, form, photo) {
  const body = new FormData();
  body.append('form', new Blob([JSON.stringify(form)], { type: 'application/json' }));
  if (photo) body.append('photo', photo, 'photo.jpg');
  const res = await fetch('/api' + path, { method: 'POST', headers, body });
  if (!res.ok) {
    const msg = (await res.json().catch(() => null))?.message;
    throw Object.assign(new Error(msg || `Couldn’t send (${res.status}). Try again.`), { status: res.status });
  }
  return res.status === 200 && res.headers.get('content-type')?.includes('json') ? res.json() : null;
}
