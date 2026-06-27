import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dbService, subscribeToCollection } from "../services/db";
import { Issue } from "../types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, ListTodo, Plus, Shield } from "lucide-react";
import { IssueCard } from "../components/IssueCard";

export const Dashboard: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedWard, setSelectedWard] = useState<string>("All Wards");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");

  const loadData = async () => {
    const data = await dbService.getIssues();
    setIssues(data);
  };

  useEffect(() => {
    dbService.initialize(); // Ensure DB is initialized
    void Promise.resolve().then(loadData);
    const unsubscribe = subscribeToCollection("issues", loadData);
    return unsubscribe;
  }, []);

  // Filter Issues
  const filteredIssues = issues.filter((issue) => {
    const matchesWard = selectedWard === "All Wards" || issue.ward.includes(selectedWard);
    const matchesCat = selectedCategory === "All Categories" || issue.category === selectedCategory;
    return matchesWard && matchesCat;
  });

  // Calculate statistics
  const totalReports = filteredIssues.length;
  const openIssues = filteredIssues.filter((i) => i.status !== "RESOLVED").length;
  const resolvedIssues = filteredIssues.filter((i) => i.status === "RESOLVED").length;
  const escalatedIssues = filteredIssues.filter((i) => i.status === "ESCALATED").length;
  const resolutionRate = totalReports > 0 ? Math.round((resolvedIssues / totalReports) * 100) : 0;

  // Chart 1: Category Distribution
  const categories = ["Garbage", "Streetlight", "Pothole", "Water Leakage", "Critical Infrastructure"];
  const categoryData = categories.map((cat) => {
    const count = filteredIssues.filter((i) => i.category === cat).length;
    return { name: cat, value: count };
  }).filter(c => c.value > 0);

  const PIE_COLORS = ["#0D9488", "#3B82F6", "#F59E0B", "#10B981", "#EF4444"];

  // Chart 2: Ward Breakdown
  const wardsList = ["Ward 1 (Central)", "Ward 2 (West)", "Ward 3 (East)", "Ward 4 (South)"];
  const wardData = wardsList.map((ward) => {
    const total = issues.filter((i) => i.ward.includes(ward)).length;
    const resolved = issues.filter((i) => i.ward.includes(ward) && i.status === "RESOLVED").length;
    const escalated = issues.filter((i) => i.ward.includes(ward) && i.status === "ESCALATED").length;
    return { name: ward.split(" ")[1], Total: total, Resolved: resolved, Escalated: escalated };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-64px)] bg-background text-on-surface font-body-md">
      {/* Welcome Banner */}
      <div className="bg-primary-container text-on-primary-container rounded-2xl p-6 md:p-8 shadow-sm mb-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-left relative z-10">
          <span className="bg-background text-on-surface text-[10px] font-label-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            Municipal Analytics Console
          </span>
          <h1 className="text-2xl md:text-3xl font-headline-lg mt-3">
            City Civic Health Dashboard
          </h1>
          <p className="text-on-primary-container/80 font-body-sm mt-1.5 max-w-xl">
            Nagrik aggregates and processes reports using autonomous AI agents to close the municipal loop. View real-time SLA metrics below.
          </p>
        </div>
        <Link
          to="/report"
          className="bg-primary hover:bg-primary-hover text-on-primary font-label-bold px-5 py-3 rounded-xl shadow-sm transition-all duration-200 shrink-0 flex items-center gap-2 group relative z-10"
        >
          <Plus className="h-4 w-4" />
          Report Infrastructure Issue
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 self-start sm:self-center">
          <ListTodo className="h-4 w-4 text-on-surface-variant" />
          <span className="font-label-bold text-on-surface">Filter Analysis:</span>
        </div>
        <div className="flex flex-wrap w-full sm:w-auto gap-3">
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="flex-1 sm:flex-initial bg-surface-container-low border border-outline-variant text-on-surface font-body-sm rounded-lg px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="All Wards">All Wards</option>
            <option value="Ward 1">Ward 1 (Central)</option>
            <option value="Ward 2">Ward 2 (West)</option>
            <option value="Ward 3">Ward 3 (East)</option>
            <option value="Ward 4">Ward 4 (South)</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 sm:flex-initial bg-surface-container-low border border-outline-variant text-on-surface font-body-sm rounded-lg px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="All Categories">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Total */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between text-left">
          <p className="font-label-md text-on-surface-variant uppercase tracking-wider">Total Reports</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-headline-lg text-on-surface">{totalReports}</span>
            <span className="font-body-sm text-on-surface-variant">tickets</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[10px] font-semibold text-on-surface-variant border-t border-outline-variant pt-2">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Civic Ledger Entries</span>
          </div>
        </div>

        {/* Open */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between text-left">
          <p className="font-label-md text-on-surface-variant uppercase tracking-wider">Active Open</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-headline-lg text-primary">{openIssues}</span>
            <span className="font-body-sm text-on-surface-variant">pending</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[10px] font-semibold text-primary border-t border-outline-variant pt-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Requiring attention</span>
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between text-left">
          <p className="font-label-md text-on-surface-variant uppercase tracking-wider">Resolved Issues</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-headline-lg text-primary-container">{resolvedIssues}</span>
            <span className="font-body-sm text-on-surface-variant">fixed</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[10px] font-semibold text-primary-container border-t border-outline-variant pt-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Remediation complete</span>
          </div>
        </div>

        {/* Escalated */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between text-left">
          <p className="font-label-md text-on-surface-variant uppercase tracking-wider">Escalated SLA</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-headline-lg text-error">{escalatedIssues}</span>
            <span className="font-body-sm text-on-surface-variant">breached</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[10px] font-semibold text-error border-t border-outline-variant pt-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Escalation Agent active</span>
          </div>
        </div>

        {/* Rate */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between text-left col-span-2 lg:col-span-1">
          <p className="font-label-md text-on-surface-variant uppercase tracking-wider">Resolution Rate</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-headline-lg text-primary">{resolutionRate}%</span>
            <span className="font-body-sm text-on-surface-variant">efficiency</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[10px] font-semibold text-primary border-t border-outline-variant pt-2">
            <Shield className="h-3.5 w-3.5" />
            <span>Target: 95% threshold</span>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Ward Comparison */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm lg:col-span-2 text-left">
          <h3 className="font-label-bold text-on-surface uppercase tracking-wider mb-4">
            Ward Performance Breakdown
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0F172A", border: "none", borderRadius: "8px" }}
                  itemStyle={{ color: "#F8FAFC", fontSize: "12px" }}
                  labelStyle={{ color: "#94A3B8", fontSize: "11px", fontWeight: "bold" }}
                />
                <Bar dataKey="Total" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Resolved" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Escalated" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 items-center justify-center font-body-sm mt-3 text-on-surface-variant font-medium">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>Total Reports</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>Resolved</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>Escalated</span>
          </div>
        </div>

        {/* Category Breakdown (Pie) */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm text-left">
          <h3 className="font-label-bold text-on-surface uppercase tracking-wider mb-4">
            Issue Category Distribution
          </h3>
          <div className="h-56 relative flex items-center justify-center">
            {categoryData.length === 0 ? (
              <p className="text-on-surface-variant italic font-body-sm">No issues to display</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0F172A", border: "none", borderRadius: "8px" }}
                    itemStyle={{ color: "#F8FAFC", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 justify-center text-[10px] mt-2 font-semibold text-on-surface-variant">
            {categoryData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Issues Feed */}
      <div className="text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-label-bold text-on-surface uppercase tracking-wider">
            Recent Public Safety Reports
          </h3>
          <Link
            to="/map"
            className="font-label-bold text-primary hover:underline flex items-center gap-1"
          >
            View Map Layout
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant italic font-body-sm border border-dashed border-outline-variant rounded-xl">
            No reports matching the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIssues
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 6)
              .map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
