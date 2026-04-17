import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Category from './pages/Category';
import ExpertDetail from './pages/ExpertDetail';
import ServiceRequest from './pages/ServiceRequest';
import RequestBoard from './pages/RequestBoard';
import Community from './pages/Community';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category" element={<Category />} />
        <Route path="/expert" element={<ExpertDetail />} />
        <Route path="/request" element={<ServiceRequest />} />
        <Route path="/requests" element={<RequestBoard />} />
        <Route path="/community" element={<Community />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
