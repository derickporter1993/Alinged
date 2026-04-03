import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Agents from './pages/Agents';
import OrgChart from './pages/OrgChart';
import Tickets from './pages/Tickets';
import Budget from './pages/Budget';
import Collaboration from './pages/Collaboration';
import Automation from './pages/Automation';
import Quality from './pages/Quality';
import Intelligence from './pages/Intelligence';
import Integrations from './pages/Integrations';
import Observability from './pages/Observability';
import Login from './pages/Login';
import { getAuthToken } from './api';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = getAuthToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/org-chart" element={<OrgChart />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/collaboration" element={<Collaboration />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/quality" element={<Quality />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/observability" element={<Observability />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
