import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Directory from './pages/Directory.jsx';
import Batches from './pages/Batches.jsx';
import Profile from './pages/Profile.jsx';
import UpdateProfile from './pages/UpdateProfile.jsx';
import { Empty, useTitle } from './components/ui.jsx';
import './index.css';

function Later({ title }) {
  useTitle(title);
  return (
    <div className="wrap section">
      <div className="card">
        <Empty icon="info" title={title} action={<Link className="btn btn-primary" to="/">Back to home</Link>}>
          This page is coming soon.
        </Empty>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="directory" element={<Directory />} />
          <Route path="batches" element={<Batches />} />
          <Route path="alumni/:id" element={<Profile />} />
          <Route path="alumni/:id/update" element={<UpdateProfile />} />
          <Route path="join" element={<UpdateProfile />} />
          <Route path="about" element={<Later title="About the Alumni Association" />} />
          <Route path="*" element={<Later title="Page not found" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
