/**
 * Researcher dashboard home page.
 *
 * Provides quick navigation to case management, participant/session
 * overview, and data export. Implemented as simple in-page tabs to keep
 * routing minimal.
 */
import { useState } from "react";
import { PageTitle } from "../../components/ui";
import CasesPanel from "./CasesPanel";
import SessionsPanel from "./SessionsPanel";
import ExportsPanel from "./ExportsPanel";

type Tab = "cases" | "sessions" | "exports";

export default function ResearcherHomePage() {
  const [tab, setTab] = useState<Tab>("cases");

  const tabs: { key: Tab; label: string }[] = [
    { key: "cases", label: "Cases & Evidence" },
    { key: "sessions", label: "Participants & Sessions" },
    { key: "exports", label: "Data Export" },
  ];

  return (
    <div>
      <PageTitle subtitle="Manage cases, monitor participant sessions, and export data for analysis.">
        Researcher Dashboard
      </PageTitle>

      <div className="flex gap-2 border-b border-slate-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition
              ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cases" && <CasesPanel />}
      {tab === "sessions" && <SessionsPanel />}
      {tab === "exports" && <ExportsPanel />}
    </div>
  );
}
