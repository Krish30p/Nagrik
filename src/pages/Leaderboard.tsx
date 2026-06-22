import React, { useEffect, useState } from "react";
import { authService } from "../services/auth";
import { User } from "../types";
import { Award, Trophy, Users, ShieldAlert, Sparkles, Star } from "lucide-react";

export const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    // Fetch users from local storage
    const loadUsers = () => {
      const mockUsers = JSON.parse(localStorage.getItem("nagrik_mock_users") || "[]");
      
      // Sort users by points desc
      const sorted = mockUsers.sort((a: User, b: User) => b.points - a.points);
      setUsers(sorted);
    };

    loadUsers();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-lg mb-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-800/40 via-slate-900 to-slate-900 -z-10"></div>
        <div className="text-left">
          <span className="bg-primary/30 border border-primary/40 text-secondary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Gamified Engagement
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-3 text-slate-100">
            Civic Leaderboard
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Earn civic engagement points by reporting infrastructure issues and confirming duplicates. Help keep your city clean, safe, and efficient!
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center gap-3 shrink-0">
          <Trophy className="h-8 w-8 text-amber-500" />
          <div className="text-left leading-tight">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Your Rank</p>
            <p className="text-base font-bold text-slate-200">
              #{currentUser ? users.findIndex(u => u.id === currentUser.id) + 1 || "N/A" : "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
        {/* Rules */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-1 h-fit">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            How to Earn Points
          </h3>
          <div className="space-y-4 text-xs">
            <div className="flex gap-2">
              <span className="h-5 w-5 bg-teal-50 text-primary border border-teal-100 rounded-full flex items-center justify-center shrink-0 font-bold">1</span>
              <div>
                <h4 className="font-bold text-slate-700">Submit Report (+50 pts)</h4>
                <p className="text-slate-400 mt-0.5">Submit an infrastructure incident report with details and coordinates.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="h-5 w-5 bg-teal-50 text-primary border border-teal-100 rounded-full flex items-center justify-center shrink-0 font-bold">2</span>
              <div>
                <h4 className="font-bold text-slate-700">Duplicate Match (+20 pts)</h4>
                <p className="text-slate-400 mt-0.5">Earn verification points when your report is merged into an existing ticket.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="h-5 w-5 bg-teal-50 text-primary border border-teal-100 rounded-full flex items-center justify-center shrink-0 font-bold">3</span>
              <div>
                <h4 className="font-bold text-slate-700">Ticket Resolution (+100 pts)</h4>
                <p className="text-slate-400 mt-0.5">Receive a bonus payout when the municipal board resolves your reported ticket.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden md:col-span-2">
          <div className="government-banner"></div>
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
              <Users className="h-4 w-4 text-primary" /> Leaderboard Standings
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">{users.length} contributors</span>
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((u, index) => {
              const isMe = currentUser?.id === u.id;
              const rank = index + 1;

              let rankBadge = (
                <span className="text-slate-500 font-bold text-sm w-6 text-center">{rank}</span>
              );

              if (rank === 1) {
                rankBadge = <Trophy className="h-5 w-5 text-amber-500 shrink-0 w-6" />;
              } else if (rank === 2) {
                rankBadge = <Trophy className="h-5 w-5 text-slate-400 shrink-0 w-6" />;
              } else if (rank === 3) {
                rankBadge = <Trophy className="h-5 w-5 text-amber-700 shrink-0 w-6" />;
              }

              return (
                <div
                  key={u.id}
                  className={`p-4 flex items-center justify-between transition-colors ${
                    isMe ? "bg-teal-50/40" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {rankBadge}
                    <img
                      src={u.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.name}`}
                      alt={u.name}
                      className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 shrink-0"
                    />
                    <div className="text-left min-w-0">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        {u.name}
                        {isMe && (
                          <span className="bg-primary/10 border border-primary/20 text-primary text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                            You
                          </span>
                        )}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {u.reportsCount} reports · {u.confirmationsCount} confirmations
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right leading-none">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block text-[9px]">
                        Level {u.level}
                      </span>
                      <span className="text-sm font-extrabold text-slate-700 mt-1 block">
                        {u.points} pts
                      </span>
                    </div>
                    <div className="p-1 bg-amber-50 rounded-lg text-amber-500">
                      <Star className="h-4 w-4 fill-amber-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
