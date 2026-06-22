import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authService } from "../services/auth";
import { dbService, subscribeToCollection } from "../services/db";
import { User, Notification } from "../types";
import { Shield, Bell, Award, Map, BarChart3, PlusCircle, LogOut } from "lucide-react";

export const Navbar: React.FC = () => {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = authService.onAuthStateChanged((currUser) => {
      setUser(currUser);
    });

    // Notifications Loader & Listener
    const loadNotifs = async () => {
      if (user) {
        const notifs = await dbService.getNotifications(user.id);
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
  }, [user?.id]);

  const handleLogout = async () => {
    await authService.logout();
    navigate("/login");
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await dbService.markNotificationRead(id);
    if (user) {
      const notifs = await dbService.getNotifications(user.id);
      setNotifications(notifs);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const linkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium text-sm transition-all duration-250 ${
      isActive
        ? "bg-primary text-white shadow-sm"
        : "text-slate-600 hover:text-primary hover:bg-slate-100"
    }`;
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="government-banner"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="bg-primary text-white p-2 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
                Nagrik
                <span className="bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Civic AI
                </span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium">AI Civic Operations Platform</p>
            </div>
          </Link>

          {/* Navigation Links */}
          {user && (
            <nav className="hidden md:flex space-x-2">
              <Link to="/" className={linkClass("/")}>
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </Link>
              <Link to="/map" className={linkClass("/map")}>
                <Map className="h-4 w-4" />
                City Map
              </Link>
              <Link to="/report" className={linkClass("/report")}>
                <PlusCircle className="h-4 w-4" />
                Report Issue
              </Link>
              <Link to="/leaderboard" className={linkClass("/leaderboard")}>
                <Award className="h-4 w-4" />
                Leaderboard
              </Link>
            </nav>
          )}

          {/* User Section & Notifications */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {/* Gamified Score */}
                <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                  <Award className="h-4 w-4 text-secondary" />
                  <div className="text-left leading-none">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level {user.level}</p>
                    <p className="text-xs font-bold text-slate-700">{user.points} Points</p>
                  </div>
                </div>

                {/* Notifications Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    className="relative p-2 rounded-full text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white ring-2 ring-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Notifications</span>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                          {unreadCount} unread
                        </span>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left flex gap-2 cursor-pointer ${
                                !notif.read ? "bg-teal-50/50" : ""
                              }`}
                            >
                              <div className="flex-1">
                                <h4 className="text-xs font-bold text-slate-800">{notif.title}</h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">{notif.body}</p>
                                <span className="text-[9px] text-slate-400 mt-1 block">
                                  {new Date(notif.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              {!notif.read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(notif.id, e)}
                                  className="text-[10px] text-primary hover:underline font-medium self-start"
                                >
                                  Read
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
                <div className="flex items-center gap-3">
                  <img
                    src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200"
                  />
                  <div className="hidden lg:block text-left leading-none">
                    <p className="text-xs font-bold text-slate-800">{user.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-full text-slate-400 hover:text-danger hover:bg-red-50 transition-all"
                    title="Log Out"
                  >
                    <LogOut className="h-4.5 w-4.5" />
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-hover shadow-sm"
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
