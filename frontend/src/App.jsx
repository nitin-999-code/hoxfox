import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { HeroScreen } from './screens/HeroScreen';
import CallbackPage from './pages/CallbackPage';
import Dashboard from './pages/Dashboard';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = React.useContext(AuthContext);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

import PlaylistDetail from './pages/PlaylistDetail';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={
        <>
          <div className="noise" />
          <HeroScreen onNext={() => {
            window.location.href = 'http://localhost:5001/auth/login';
          }} />
        </>
      } />
      <Route path="/callback" element={<CallbackPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/playlist/:id" 
        element={
          <ProtectedRoute>
            <PlaylistDetail />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
