// Admin calls carry the login token from the admin page; a wrong or expired token comes back as status 401.
import { admin, post, sendForm } from './client.js';

export const adminLogin = (email, password) => post('/admin/login', { email, password }).then(r => r.token);
export const adminLogout = token => admin('/logout', token, 'POST');
export const listPending = token => admin('/pending', token);
export const approveJoin = (token, id) => admin(`/alumni/${id}/approve`, token, 'POST');
export const rejectJoin = (token, id) => admin(`/alumni/${id}/reject`, token, 'POST');
/** Admin: every story as { story, status: 'PENDING' | 'PUBLISHED', contact }, waiting ones first. */
export const listAllStories = token => admin('/stories', token);
export const approveStory = (token, id) => admin(`/stories/${id}/approve`, token, 'POST');
export const deleteStory = (token, id) => admin(`/stories/${id}`, token, 'DELETE');
/** Admin events: every event (past too), newest first; form = { id, date, time, title, place, details }. */
export const listAdminEvents = token => admin('/events', token);
export const saveEvent = (token, form) => admin('/events', token, 'POST', form);
export const deleteEvent = (token, id) => admin(`/events/${id}`, token, 'DELETE');
export const adminStudent = (token, id) => admin(`/alumni/${id}`, token);
export const listIssues = token => admin('/issues', token);
export const deleteIssue = (token, id) => admin(`/issues/${id}`, token, 'DELETE');
/** Admin: edit a student or add someone who passed away. id = null adds a person with no record (form then needs batch + group). */
export const saveMemorial = (token, id, form, photo) =>
  sendForm(id ? `/admin/alumni/${id}/memorial` : '/admin/memorials', { 'X-Admin-Token': token }, form, photo);
/** Admin add/edit, live at once. form = { id, studentId, name, batch, kind, title, role, quote, body, removePhoto }; photo = Blob or null. */
export const saveStory = (token, form, photo) => sendForm('/admin/stories', { 'X-Admin-Token': token }, form, photo);
export const deleteReply = (token, id) => admin(`/replies/${id}`, token, 'DELETE');
