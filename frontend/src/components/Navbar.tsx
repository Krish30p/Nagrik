import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authService } from "../services/auth";
import { dbService, subscribeToCollection } from "../services/db";
import { User, Notification } from "../types";
import { Shield, Bell, Award, Map, BarChart3, PlusCircle, LogOut, FileText } from "lucide-react";

export const Navbar: React.FC = () => {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userId = user?.id;
  const isStaffUser = authService.isStaff();

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = authService.onAuthStateChanged((currUser) => {
      setUser(currUser);
    });

    // Notifications Loader & Listener
    const loadNotifs = async () => {
      if (userId) {
        const notifs = await dbService.getNotifications();
        setNotifications(notifs);
      } else {
        setNotifications([]);
      }
    };

    loadNotifs();
    const unsubscribeDb = subscribeToCollection("notifications", loadNotifs);
    const unsubscribeUsers = subscribeToCollection("users", loadNotifs);

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
      unsubscribeUsers();
    };
  }, [userId]);

  const handleLogout = async () => {
    await authService.logout();
    navigate("/login");
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await dbService.markNotificationRead(id);
    if (user) {
      const notifs = await dbService.getNotifications();
      setNotifications(notifs);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const linkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-wide transition-all duration-150 ${
      isActive
        ? "bg-seal text-paper border border-seal"
        : "text-ink-muted hover:text-seal hover:bg-seal-tint/40 border border-transparent"
    }`;
  };

  return (
    <header className="sticky top-0 z-40 bg-paper-raised border-b border-rule">
      <div className="border-t-4 border-seal"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="bg-seal text-paper p-1.5 rounded flex items-center justify-center border border-seal">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="text-lg font-display font-bold tracking-tight text-ink flex items-center gap-1.5">
                NAGRIK
                {isStaffUser && (
                  <span className="bg-seal-tint border border-seal/30 text-seal text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold tracking-widest">
                    STAFF
                  </span>
                )}
              </span>
              <p className="font-mono text-[9px] text-ink-muted leading-none">AI CIVIC LEDGER PLATFORM</p>
            </div>
          </Link>

          {/* Navigation Links */}
          {user && (
            <nav className="hidden md:flex space-x-1.5">
              <Link to="/" className={linkClass("/")}>
                <Map className="h-3.5 w-3.5" />
                City Map
              </Link>
              {isStaffUser && (
                <Link to="/dashboard" className={linkClass("/dashboard")}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Operations Ledger
                </Link>
              )}
              <Link to="/report" className={linkClass("/report")}>
                <PlusCircle className="h-3.5 w-3.5" />
                Report File
              </Link>
              <Link to="/my-reports" className={linkClass("/my-reports")}>
                <FileText className="h-3.5 w-3.5" />
                My Files
              </Link>
              <Link to="/leaderboard" className={linkClass("/leaderboard")}>
                <Award className="h-3.5 w-3.5" />
                Registry Rank
              </Link>
            </nav>
          )}

          {/* User Section & Notifications */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Gamified Score */}
                <div className="hidden sm:flex items-center gap-2 bg-paper border border-rule px-2.5 py-1 rounded">
                  <Award className="h-3.5 w-3.5 text-secondary" />
                  <div className="text-left leading-none font-mono">
                    <p className="text-[8px] font-bold text-ink-muted uppercase tracking-wider">LEVEL {user.level}</p>
                    <p className="text-[10px] font-bold text-ink">{user.points} PTS</p>
                  </div>
                </div>

                {/* Notifications Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    className="relative p-1.5 rounded text-ink-muted hover:text-seal hover:bg-seal-tint/40 transition-colors"
                  >
                    <Bell className="h-4.5 w-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-status-escalated text-[8px] font-bold text-paper ring-1 ring-paper">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-paper-raised border border-rule rounded shadow-lg z-50 overflow-hidden font-ui">
                      <div className="p-2 border-b border-rule bg-paper flex justify-between items-center font-mono">
                        <span className="text-[10px] font-bold text-ink uppercase">NOTIFICATIONS</span>
                        <span className="text-[9px] bg-rule/50 text-ink-muted px-1.5 py-0.2 rounded font-semibold">
                          {unreadCount} UNREAD
                        </span>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-xs text-ink-muted italic">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-3 border-b border-rule/50 hover:bg-paper transition-colors text-left flex gap-2 cursor-pointer ${
                                !notif.read ? "bg-seal-tint/20" : ""
                              }`}
                            >
                              <div className="flex-1">
                                <h4 className="text-xs font-bold text-ink">{notif.title}</h4>
                                <p className="text-[11px] text-ink-muted mt-0.5 leading-tight">{notif.body}</p>
                                <span className="font-mono text-[9px] text-ink-muted/70 mt-1 block">
                                  {new Date(notif.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              {!notif.read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(notif.id, e)}
                                  className="text-[9px] font-mono text-secondary hover:underline self-start uppercase"
                                >
                                  Mark
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User avatar and logout */}
                <div className="flex items-center gap-2">
                  <img
                    src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="h-8 w-8 rounded bg-paper border border-rule"
                  />
                  <div className="hidden lg:block text-left leading-none font-mono">
                    <p className="text-[10px] font-bold text-ink">{user.name.split(" ")[0].toUpperCase()}</p>
                    <p className="text-[8px] text-ink-muted mt-0.5">{user.email.substring(0, 15)}...</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 rounded text-ink-muted hover:text-status-escalated hover:bg-status-escalated/10 transition-all"
                    title="Log Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-seal text-paper text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded border border-seal hover:bg-seal/90"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
