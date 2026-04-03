import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Agents from './pages/Agents';
import OrgChart from './pages/OrgChart';
import Tickets from './pages/Tickets';
import Budget from './pages/Budget';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/org-chart" element={<OrgChart />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/budget" element={<Budget />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
