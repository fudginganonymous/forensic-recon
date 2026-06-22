/**
 * Registration page.
 *
 * Allows creating either a 'participant' or 'researcher' account.
 * In a real study deployment you may wish to restrict researcher
 * self-registration (see README deployment notes) - this prototype
 * leaves it open for ease of setup.
 */
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../api/types";
import { Button, Card, ErrorMessage, Input, Label, PageTitle, extractErrorMessage } from "../components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("participant");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(username, password, role, email || undefined);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <PageTitle subtitle="Create an account to take part in or run the study">
          Register
        </PageTitle>
        <Card>
          {success ? (
            <p className="text-green-700 text-sm">Account created! Redirecting to sign in...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <ErrorMessage message={error} />
              <div>
                <Label>I am a...</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("participant")}
                    className={`flex-1 border rounded-md py-2 text-sm font-medium ${role === "participant" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}
                  >
                    Participant
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("researcher")}
                    className={`flex-1 border rounded-md py-2 text-sm font-medium ${role === "researcher" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}
                  >
                    Researcher
                  </button>
                </div>
              </div>
              <div>
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} autoFocus />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Creating account..." : "Create account"}
              </Button>
            </form>
          )}
        </Card>
        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
