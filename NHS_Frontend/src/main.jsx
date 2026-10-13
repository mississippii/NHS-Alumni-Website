import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/home/Home.jsx';
import './index.css';

// Home is in the first download; every other page is fetched the first time it is opened, so a phone only loads
// what it shows (and visitors never download the admin panel).
const Batches = lazy(() => import('./pages/alumni/Batches.jsx'));
const Directory = lazy(() => import('./pages/alumni/Directory.jsx'));
const Events = lazy(() => import('./pages/events/Events.jsx'));
const Stories = lazy(() => import('./pages/stories/Stories.jsx'));
const Story = lazy(() => import('./pages/stories/Story.jsx'));
const ShareStory = lazy(() => import('./pages/stories/ShareStory.jsx'));
const Profile = lazy(() => import('./pages/profile/Profile.jsx'));
const UpdateProfile = lazy(() => import('./pages/profile-form/UpdateProfile.jsx'));
const Admin = lazy(() => import('./pages/admin/Admin.jsx'));
const ComingSoon = lazy(() => import('./pages/ComingSoon.jsx'));
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="directory" element={<Directory />} />
          <Route path="alumni" element={<Batches />} />
          <Route path="batches" element={<Navigate to="/alumni" replace />} />
          <Route path="events" element={<Events />} />
          <Route path="stories" element={<Stories />} />
          <Route path="stories/share" element={<ShareStory />} />
          <Route path="stories/:id" element={<Story />} />
          <Route path="alumni/:id" element={<Profile />} />
          <Route path="alumni/:id/update" element={<UpdateProfile />} />
          <Route path="join" element={<UpdateProfile />} />
          <Route path="admin/*" element={<Admin />} />
          <Route path="about" element={<ComingSoon title="About the Alumni Association" />} />
          <Route path="*" element={<ComingSoon title="Page not found" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
