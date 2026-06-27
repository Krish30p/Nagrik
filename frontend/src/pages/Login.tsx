import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth";
import { Shield, Sparkles, LogIn, UserPlus } from "lucide-react";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Login failed"));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Authentication failed"));
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md h-[calc(100vh-64px)] flex flex-col md:flex-row -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Left Panel: Hero */}
      <div className="hidden md:flex md:w-5/12 lg:w-1/2 bg-primary-container relative flex-col justify-between p-12 lg:p-20 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12 text-on-primary">
              <Shield className="h-10 w-10" />
              <span className="text-3xl font-bold tracking-tight">Nagrik</span>
          </div>
          <h1 className="font-headline-lg text-on-primary mb-6 max-w-md">Report Once.<br/>We Handle The Rest.</h1>
          <p className="font-body-lg text-on-primary-container max-w-md opacity-90">
            Secure, transparent, and efficient civic reporting designed for modern governance.
          </p>
        </div>
      </div>

      {/* Right Panel: Form Area */}
      <div className="w-full md:w-7/12 lg:w-1/2 flex flex-col justify-center items-center p-6 md:p-12 lg:p-20 bg-background overflow-y-auto">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm relative">
          {/* Database Mode Status */}
          <div className="mb-6 p-3 bg-surface-container border border-outline-variant rounded-xl flex items-center justify-between gap-4">
            <span className="text-xs font-bold text-on-surface-variant">Database Engine:</span>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-surface-container-lowest text-on-surface border border-outline-variant shadow-sm rounded-lg">
              MongoDB Server Connected
            </span>
          </div>

          {/* Tabs */}
          <div className="flex mb-8 border-b border-outline-variant">
            <button
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 pb-4 font-label-bold text-center transition-colors duration-200 border-b-2 ${
                isLogin ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 pb-4 font-label-bold text-center transition-colors duration-200 border-b-2 ${
                !isLogin ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="bg-error-container border border-error text-on-error-container text-xs font-bold p-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            {!isLogin && (
              <div>
                <label className="block mb-2 font-label-bold text-on-surface-variant text-sm">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  required
                  className="block w-full bg-surface-container-lowest border border-outline-variant rounded-md py-3 px-4 focus:ring-0 focus:border-primary-container focus:border-2 transition-all duration-200 outline-none font-body-md text-on-surface"
                />
              </div>
            )}

            <div>
              <label className="block mb-2 font-label-bold text-on-surface-variant text-sm">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@nagrik.gov.in"
                required
                className="block w-full bg-surface-container-lowest border border-outline-variant rounded-md py-3 px-4 focus:ring-0 focus:border-primary-container focus:border-2 transition-all duration-200 outline-none font-body-md text-on-surface"
              />
            </div>

            <div>
              <label className="block mb-2 font-label-bold text-on-surface-variant text-sm">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="block w-full bg-surface-container-lowest border border-outline-variant rounded-md py-3 px-4 focus:ring-0 focus:border-primary-container focus:border-2 transition-all duration-200 outline-none font-body-md text-on-surface"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary-container text-on-primary font-label-bold py-3 px-4 rounded-md hover:bg-primary transition-colors duration-200 flex justify-center items-center gap-2 h-12 shadow-sm"
            >
              {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              <span>{isLogin ? "Sign In" : "Register"}</span>
            </button>
          </form>

          {/* Quick Demo Logins */}
          {isLogin && (
            <div className="mt-6 pt-6 border-t border-outline-variant text-left">
              <h4 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Quick Demo Accounts
              </h4>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handlePresetLogin("admin@nagrik.gov.in")}
                  className="w-full bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold py-2.5 px-3 rounded-lg border border-outline-variant transition-all flex justify-between items-center"
                >
                  <span>Municipal Officer (Admin)</span>
                  <span className="text-[9px] text-primary uppercase font-bold bg-primary-container/10 px-2 py-0.5 border border-primary/20 rounded">
                    Officer
                  </span>
                </button>
                <button
                  onClick={() => handlePresetLogin("aarav@gmail.com")}
                  className="w-full bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold py-2.5 px-3 rounded-lg border border-outline-variant transition-all flex justify-between items-center"
                >
                  <span>Citizen (Aarav Sharma)</span>
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold bg-surface-container-highest px-2 py-0.5 border border-outline-variant rounded">
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
