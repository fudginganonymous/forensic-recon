/**
 * AuthContext
 *
 * Provides login/register/logout actions and the current user across
 * the app. The JWT access token is persisted to localStorage so the
 * session survives a page refresh; api/client.ts reads it from there
 * automatically on every request.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../api/client";
import type { User, Token, UserRole } from "../api/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string, role: UserRole, email?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_TOKEN_KEY = "access_token";
const STORAGE_USER_KEY = "current_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on first load
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_USER_KEY);
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  async function login(username: string, password: string): Promise<User> {
    // FastAPI's OAuth2PasswordRequestForm expects form-encoded data, not JSON.
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);

    const response = await api.post<Token>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const { access_token, user: loggedInUser } = response.data;
    localStorage.setItem(STORAGE_TOKEN_KEY, access_token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function register(username: string, password: string, role: UserRole, email?: string): Promise<void> {
    await api.post("/auth/register", { username, password, role, email });
  }

  function logout() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
