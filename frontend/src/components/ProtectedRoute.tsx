/**
 * ProtectedRoute
 *
 * Redirects to /login if not authenticated. If `role` is specified,
 * also redirects users of the wrong role to their own home page.
 */
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../api/types";

export default function ProtectedRoute({ children, role }: { children: ReactNode; role?: UserRole }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="text-slate-500 p-8">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "researcher" ? "/researcher" : "/participant"} replace />;
  }
  // Redirect participant to consent page if they haven't consented yet,
  // unless they are already on the consent page
  if (user.role === "participant" && !user.has_consented && window.location.pathname !== "/consent") {
    return <Navigate to="/consent" replace />;
  }
  return <>{children}</>;
}
