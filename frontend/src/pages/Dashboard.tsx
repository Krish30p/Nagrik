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

  const PIE_COLORS = ["#1F3A33", "#C2542D", "#D9A02B", "#2D5A8C", "#4A6B4E"];

  // Chart 2: Ward Breakdown
  const wardsList = ["Ward 1 (Central)", "Ward 2 (West)", "Ward 3 (East)", "Ward 4 (South)"];
  const wardData = wardsList.map((ward) => {
    const total = issues.filter((i) => i.ward.includes(ward)).length;
    const resolved = issues.filter((i) => i.ward.includes(ward) && i.status === "RESOLVED").length;
    const escalated = issues.filter((i) => i.ward.includes(ward) && i.status === "ESCALATED").length;
    return { name: ward.split(" ")[1], Total: total, Resolved: resolved, Escalated: escalated };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-56px)] bg-background text-ink font-ui">
      {/* Welcome Banner */}
      <div className="bg-paper-raised border border-rule rounded-md p-6 md:p-8 mb-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute -right-4 -top-2 opacity-[0.03] pointer-events-none select-none">
          <span className="font-display text-[96px] font-bold text-ink uppercase rotate-12">FILED</span>
        </div>
        <div className="text-left relative z-10">
          <span className="bg-paper border border-rule text-ink font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold">
            Municipal Analytics Console
          </span>
          <h1 className="text-2xl md:text-3xl font-display mt-3 text-ink font-bold leading-tight">
            City Civic Health Dashboard
          </h1>
          <p className="text-ink-muted font-ui text-xs mt-1.5 max-w-xl leading-relaxed">
            Nagrik aggregates and processes reports using autonomous AI agents to close the municipal loop. View real-time SLA metrics below.
          </p>
        </div>
        <Link
          to="/report"
          className="bg-secondary hover:bg-secondary/90 text-paper font-mono text-xs uppercase tracking-wide px-4 py-2.5 rounded shadow-sm transition-all duration-150 shrink-0 flex items-center gap-2 group relative z-10 border border-secondary"
        >
          <Plus className="h-4 w-4" />
          Report Infrastructure Issue
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-paper-raised border border-rule rounded-md p-4 mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 self-start sm:self-center">
          <ListTodo className="h-4 w-4 text-ink-muted" />
          <span className="font-mono text-xs uppercase tracking-wider text-ink font-bold">Filter Analysis:</span>
        </div>
        <div className="flex flex-wrap w-full sm:w-auto gap-3">
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="flex-1 sm:flex-initial bg-paper border border-rule text-ink font-mono text-xs rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-seal"
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
            className="flex-1 sm:flex-initial bg-paper border border-rule text-ink font-mono text-xs rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-seal"
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-ledger-gap bg-rule border border-rule rounded-md overflow-hidden mb-8">
        {/* Total */}
        <div className="bg-paper-raised p-4 flex flex-col justify-between text-left">
          <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-bold">Total Reports</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-2xl font-bold text-ink">{totalReports}</span>
            <span className="font-mono text-[9px] text-ink-muted uppercase">tickets</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[9px] font-bold font-mono text-ink-muted border-t border-rule/50 pt-2 uppercase">
            <FileSpreadsheet className="h-3.5 w-3.5 text-ink-muted/50" />
            <span>Registry Entries</span>
          </div>
        </div>

        {/* Open */}
        <div className="bg-paper-raised p-4 flex flex-col justify-between text-left">
          <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-bold">Active Open</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-2xl font-bold text-seal">{openIssues}</span>
            <span className="font-mono text-[9px] text-ink-muted uppercase">pending</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[9px] font-bold font-mono text-seal border-t border-rule/50 pt-2 uppercase">
            <AlertCircle className="h-3.5 w-3.5 text-seal/50" />
            <span>Active Investigation</span>
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-paper-raised p-4 flex flex-col justify-between text-left">
          <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-bold">Resolved Files</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-2xl font-bold text-status-resolved">{resolvedIssues}</span>
            <span className="font-mono text-[9px] text-ink-muted uppercase">fixed</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[9px] font-bold font-mono text-status-resolved border-t border-rule/50 pt-2 uppercase">
            <CheckCircle2 className="h-3.5 w-3.5 text-status-resolved/50" />
            <span>Closed Audits</span>
          </div>
        </div>

        {/* Escalated */}
        <div className="bg-paper-raised p-4 flex flex-col justify-between text-left">
          <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-bold">Escalated SLA</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-2xl font-bold text-status-escalated">{escalatedIssues}</span>
            <span className="font-mono text-[9px] text-ink-muted uppercase">breached</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[9px] font-bold font-mono text-status-escalated border-t border-rule/50 pt-2 uppercase">
            <AlertTriangle className="h-3.5 w-3.5 text-status-escalated/50" />
            <span>Escalation Active</span>
          </div>
        </div>

        {/* Rate */}
        <div className="bg-paper-raised p-4 flex flex-col justify-between text-left col-span-2 lg:col-span-1">
          <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-bold">Resolution Rate</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-2xl font-bold text-seal">{resolutionRate}%</span>
            <span className="font-mono text-[9px] text-ink-muted uppercase">efficiency</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1 text-[9px] font-bold font-mono text-seal border-t border-rule/50 pt-2 uppercase">
            <Shield className="h-3.5 w-3.5 text-seal/50" />
            <span>Target: 95% threshold</span>
          </div>
        </div>
      </div>

      {/* Perforated Divider */}
      <div className="ledger-line mb-8"></div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Ward Comparison */}
        <div className="bg-paper-raised border border-rule rounded-md p-5 text-left">
          <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider mb-4">
            Ward Performance Breakdown
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD6C4" />
                <XAxis dataKey="name" stroke="#5C5A4E" fontSize={10} tickLine={false} />
                <YAxis stroke="#5C5A4E" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1B1B16", border: "1px solid #DDD6C4", borderRadius: "4px" }}
                  itemStyle={{ color: "#F7F3EA", fontSize: "11px", fontFamily: "monospace" }}
                  labelStyle={{ color: "#5C5A4E", fontSize: "10px", fontWeight: "bold", fontFamily: "monospace" }}
                />
                <Bar dataKey="Total" fill="#1B1B16" radius={[2, 2, 0, 0]} barSize={16} />
                <Bar dataKey="Resolved" fill="#4A6B4E" radius={[2, 2, 0, 0]} barSize={16} />
                <Bar dataKey="Escalated" fill="#A23B2E" radius={[2, 2, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 items-center justify-center font-mono text-[9px] font-bold mt-3 text-ink-muted uppercase">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-[#1B1B16]"></span>Total Reports</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-[#4A6B4E]"></span>Resolved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-[#A23B2E]"></span>Escalated</span>
          </div>
        </div>

        {/* Category Breakdown (Pie) */}
        <div className="bg-paper-raised border border-rule rounded-md p-5 text-left col-span-1">
          <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider mb-4">
            Issue Category Distribution
          </h3>
          <div className="h-56 relative flex items-center justify-center">
            {categoryData.length === 0 ? (
              <p className="text-ink-muted italic font-mono text-xs">[NO ISSUES DETECTED]</p>
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
                    contentStyle={{ backgroundColor: "#1B1B16", border: "1px solid #DDD6C4", borderRadius: "4px" }}
                    itemStyle={{ color: "#F7F3EA", fontSize: "11px", fontFamily: "monospace" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center text-[9px] mt-2 font-mono font-bold text-ink-muted uppercase">
            {categoryData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard Notes snippet */}
        <div className="bg-paper-raised border border-rule rounded-md p-5 text-left">
          <h3 className="font-mono text-xs font-bold text-secondary uppercase tracking-wider mb-4 border-b border-dashed border-rule pb-2">
            DAILY LEDGER NOTE
          </h3>
          <div className="space-y-4 font-mono text-[11px] text-ink">
            <div className="border-l-2 border-secondary pl-3 py-1">
              <span className="text-ink-muted block text-[9px] mb-1">24-MAY 13:20</span>
              <p className="leading-tight text-ink">Sector 4 main inspected. Severe corrosion consistent with file #221. Dispatched repair crew.</p>
            </div>
            <div className="border-l-2 border-secondary pl-3 py-1">
              <span className="text-ink-muted block text-[9px] mb-1">24-MAY 10:45</span>
              <p className="leading-tight text-ink">MG Road bridge pothole verified by Intake Agent. Hazard signs installed by ward officer.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Issues Feed */}
      <div className="text-left bg-paper-raised border border-rule rounded-md p-5">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
            RECENT CIVIC REGISTRY
          </h3>
          <Link
            to="/"
            className="font-mono text-xs font-bold text-secondary hover:underline flex items-center gap-1 uppercase"
          >
            Open Map Explorer
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="text-center py-12 text-ink-muted italic font-mono text-xs border border-dashed border-rule rounded">
            [NO REGISTERED RECORDS MATCHING FILTERS]
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
