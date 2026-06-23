import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
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
import { MyReports } from "./pages/MyReports";

const queryClient = new QueryClient();

// Route Protection wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireStaff?: boolean }> = ({ children, requireStaff = false }) => {
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
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] text-[#5B6B63] font-mono text-xs">
        AUTHENTICATING SESSION...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireStaff && !authService.isStaff()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F4] text-[#16241D] p-6 text-center">
        <h2 className="text-xl font-serif font-bold text-[#B5562C] mb-2">ACCESS RESTRICTED</h2>
        <p className="text-sm text-[#5B6B63] max-w-md">This dashboard is restricted to authorized municipal staff members only.</p>
        <Link to="/" className="mt-6 bg-[#1A7A52] hover:bg-[#0F3D2E] text-white text-xs font-bold px-5 py-2.5 rounded uppercase tracking-wider">
          Return to Map Home
        </Link>
      </div>
    );
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
    <div className="min-h-screen bg-[#FAF8F4] flex flex-col pb-12">
      {!isLoginPage && <Navbar />}
      <main className="flex-1 w-full max-w-7xl mx-auto px-0">
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public Landing Map Home */}
          <Route path="/" element={<MapExplore />} />
          {/* Public Issue Detail */}
          <Route path="/issues/:id" element={<IssueDetails />} />
          {/* Public Leaderboard */}
          <Route path="/leaderboard" element={<Leaderboard />} />
          
          {/* Protected Citizen Routes */}
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportIssue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-reports"
            element={
              <ProtectedRoute>
                <MyReports />
              </ProtectedRoute>
            }
          />
          
          {/* Protected Staff Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireStaff={true}>
                <Dashboard />
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
