import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const Register = () => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const { handleRegister, loading } = useAuth();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await handleRegister(form);
    } catch (err) {
      setError(err?.message || "Registration failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner"></div>
          <p className="text-sm text-text-secondary">Creating your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-2.5 animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
          <span className="text-accent text-sm font-bold">AI</span>
        </div>
        <span className="text-text-primary font-semibold tracking-tight">Interview Mastery</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Create account</h1>
          <p className="text-sm text-text-secondary">Start your interview preparation journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Username</label>
            <input
              type="text"
              name="username"
              placeholder="Choose a username"
              value={form.username}
              onChange={handleChange}
              className="input-field"
              required
              id="register-username"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Email</label>
            <input
              type="email"
              name="email"
              placeholder="Your email address"
              value={form.email}
              onChange={handleChange}
              className="input-field"
              required
              id="register-email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Password</label>
            <input
              type="password"
              name="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              className="input-field"
              required
              id="register-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
            id="register-submit"
          >
            {loading ? "Creating..." : "Continue"}
          </button>

          <p className="text-sm text-text-secondary text-center pt-2">
            Already have an account?{" "}
            <Link to="/login" className="text-accent hover:text-accent-light transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;