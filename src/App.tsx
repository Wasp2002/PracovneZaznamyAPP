//import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage';
import EditPage from './pages/EditPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/EditPage" element={<EditPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

