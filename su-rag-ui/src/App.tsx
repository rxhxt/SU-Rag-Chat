import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import ChatPage from './pages/Chat';
import UserProfile from './pages/UserProfile';
import Settings from './pages/Settings';

function useAuth() {
  const token = localStorage.getItem('token');
  return !!token;
}

// Protect /chat
function PrivateRoute({ children }: { children: React.ReactNode }): React.ReactElement {
  return useAuth() ? <>{children}</> : <Navigate to="/login" />;
}

const App: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/chat/*"
      element={
        <PrivateRoute>
          <ChatPage />
        </PrivateRoute>
      }
    />
    <Route path="/profile" element={ <PrivateRoute>
          <UserProfile />
        </PrivateRoute>} />
    <Route path="/settings" element={<Settings />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default App;