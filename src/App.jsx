import React, { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Sidebar from './components/Sidebar.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Analyze from './pages/Analyze.jsx';
import Results from './pages/Results.jsx';
import Explainability from './pages/Explainability.jsx';
import SafeCorner from './pages/SafeCorner.jsx';
import Performance from './pages/Performance.jsx';
import History from './pages/History.jsx';
import DiseaseInfo from './pages/DiseaseInfo.jsx';
import About from './pages/About.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AccountSettings from './pages/AccountSettings.jsx';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState(null);

  return (
    <BrowserRouter>
      <AuthProvider onLogoutClear={() => setCurrentPrediction(null)}>
        <div className="flex min-h-screen bg-slate-50 text-slate-900">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex flex-1 flex-col min-w-0">
            <Navbar onOpenSidebar={() => setSidebarOpen(true)} />

            <main className="flex-1 p-6 lg:p-8">
              <div className="mx-auto max-w-7xl">
                <Routes>
                  <Route path="/" element={<Home currentPrediction={currentPrediction} />} />
                  <Route
                    path="/analyze"
                    element={<Analyze onPredictionComplete={setCurrentPrediction} />}
                  />
                  <Route path="/results" element={<Results prediction={currentPrediction} />} />
                  <Route
                    path="/explainability"
                    element={<Explainability prediction={currentPrediction} />}
                  />
                  <Route
                    path="/safe-corner"
                    element={<SafeCorner prediction={currentPrediction} />}
                  />
                  <Route path="/performance" element={<Performance />} />
                  <Route path="/model-info" element={<Performance />} />
                  <Route
                    path="/history"
                    element={<History onSelectPrediction={setCurrentPrediction} />}
                  />
                  <Route path="/diseases" element={<DiseaseInfo />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard onSelectPrediction={setCurrentPrediction} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <AccountSettings onAccountDeleted={() => setCurrentPrediction(null)} />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
