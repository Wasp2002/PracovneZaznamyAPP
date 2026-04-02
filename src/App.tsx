//import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage';
import EditPage from './pages/EditPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/EditPage" element={<EditPage />} />
        <Route path="/DashboardPage" element={<DashboardPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

