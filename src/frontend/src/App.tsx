import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SessionPage } from './pages/SessionPage';
import { AnalysisPage } from './pages/AnalysisPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
      <Route path="/analysis/:sessionId" element={<AnalysisPage />} />
    </Routes>
  );
}

export default App;
