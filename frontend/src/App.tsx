import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authService } from "./services/auth";
import { dbService } from "./services/db";
import { Navbar } from "./components/Navbar";
import { AgentConsole } from "./components/AgentConsole";
import { Dashboard } from "./pages/Dashboard";
import { MapExplore } from "./pages/MapExplore";
import { ReportIssue } from "./pages/ReportIssue";
import { IssueDetails } from "./pages/IssueDetails";
import { Leaderboard } from "./pages/Leaderboard";
import { Login } from "./pages/Login";

const queryClient = new QueryClient();

// Route Protection wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold text-sm">
        Authenticating session...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Main App Container to handle layout wrapping
const AppContent: React.FC = () => {
  const [user, setUser] = useState(authService.getCurrentUser());
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((currUser) => {
      setUser(currUser);
    });
    return unsubscribe;
  }, []);

  const isLoginPage = location.pathname === "/login";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      {!isLoginPage && <Navbar />}
      <main className="flex-1 w-full max-w-7xl mx-auto px-0">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <MapExplore />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportIssue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/issues/:id"
            element={
              <ProtectedRoute>
                <IssueDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {user && <AgentConsole />}
    </div>
  );
};

function App() {
  useEffect(() => {
    // Seed and initialize local database
    dbService.initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
