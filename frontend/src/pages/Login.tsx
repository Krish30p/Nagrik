import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth";
import { Shield, Sparkles, LogIn, UserPlus } from "lucide-react";

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handlePresetLogin = async (presetEmail: string) => {
    setError(null);
    try {
      await authService.login(presetEmail, "password");
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isLogin) {
        await authService.login(email, password);
      } else {
        await authService.register(name, email, password);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-left flex flex-col justify-center min-h-[calc(100vh-200px)]">
      {/* Brand logo banner */}
      <div className="flex flex-col items-center mb-8">
        <div className="bg-primary text-white p-3 rounded-2xl flex items-center justify-center shadow-md mb-3">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-1.5">
          Nagrik
          <span className="bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Civic AI
          </span>
        </h1>
        <p className="text-xs text-slate-400 font-semibold mt-1">AI Civic Operations Platform</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="government-banner"></div>
        <div className="p-6 md:p-8">
          <div className="flex gap-4 border-b border-slate-100 pb-4 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setError(null);
              }}
              className={`flex-1 text-center font-bold text-sm pb-2 border-b-2 transition-all ${
                isLogin
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError(null);
              }}
              className={`flex-1 text-center font-bold text-sm pb-2 border-b-2 transition-all ${
                !isLogin
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  required
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@nagrik.gov.in"
                required
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md mt-2"
            >
              {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isLogin ? "Sign In" : "Register"}
            </button>
          </form>

          {/* Quick Demo Logins */}
          {isLogin && (
            <div className="mt-6 pt-6 border-t border-slate-150 text-left">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Quick Demo Accounts
              </h4>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handlePresetLogin("admin@nagrik.gov.in")}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-lg border border-slate-200 transition-all flex justify-between items-center"
                >
                  <span>Municipal Officer (Admin)</span>
                  <span className="text-[9px] text-primary uppercase font-bold bg-primary/5 px-2 py-0.5 border border-primary/10 rounded">
                    Officer
                  </span>
                </button>
                <button
                  onClick={() => handlePresetLogin("aarav@gmail.com")}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-lg border border-slate-200 transition-all flex justify-between items-center"
                >
                  <span>Citizen (Aarav Sharma)</span>
                  <span className="text-[9px] text-slate-400 uppercase font-bold bg-slate-200/50 px-2 py-0.5 border border-slate-250 rounded">
                    Citizen
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
