/**
 * App - top-level routing.
 *
 * Routes:
 *   /login, /register      - public
 *   /participant           - participant home (case selection / session list)
 *   /participant/sessions/:sessionId - the 5-stage workflow
 *   /researcher            - researcher dashboard
 *   /                       - redirects based on auth state / role
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ConsentPage from "./pages/ConsentPage";
import ParticipantHomePage from "./pages/participant/ParticipantHomePage";
import SessionWorkflowPage from "./pages/participant/SessionWorkflowPage";
import ResearcherHomePage from "./pages/researcher/ResearcherHomePage";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-slate-500">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "researcher" ? "/researcher" : "/participant"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/consent"
            element={
              <ProtectedRoute role="participant">
                <ConsentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/participant"
            element={
              <ProtectedRoute role="participant">
                <AppLayout>
                  <ParticipantHomePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/participant/sessions/:sessionId"
            element={
              <ProtectedRoute role="participant">
                <AppLayout>
                  <SessionWorkflowPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/researcher"
            element={
              <ProtectedRoute role="researcher">
                <AppLayout>
                  <ResearcherHomePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
