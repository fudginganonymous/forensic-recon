/**
 * ExportsPanel
 *
 * Provides download links for CSV/Excel exports suitable for SPSS/R.
 * Since these are authenticated endpoints, we fetch as a blob with the
 * axios instance (which attaches the auth token) and trigger a download
 * via a temporary object URL.
 */
import { useState } from "react";
import api from "../../api/client";
import type { Case } from "../../api/types";
import { useEffect } from "react";
import { Button, Card, ErrorMessage, Input, Label, PageTitle, extractErrorMessage } from "../../components/ui";

async function downloadFile(url: string, filename: string) {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export default function ExportsPanel() {
  const [cases, setCases] = useState<Case[]>([]);
  const [caseId, setCaseId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api.get<Case[]>("/cases").then((res) => setCases(res.data)).catch(() => {});
  }, []);

  async function handleDownload(key: string, url: string, filename: string) {
    setDownloading(key);
    setError(null);
    try {
      await downloadFile(url, filename);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  }

  const caseQuery = caseId ? `?case_id=${caseId}` : "";

  return (
    <div className="space-y-6">
      <PageTitle subtitle="Export data formatted for SPSS, R, or Excel-based analysis.">
        Data Export
      </PageTitle>
      <ErrorMessage message={error} />

      <Card>
        <h3 className="font-medium text-slate-800 mb-2">Session-level metrics</h3>
        <p className="text-sm text-slate-500 mb-3">
          One row per session with all computed Hypothesis Flexibility, Premature Closure, and
          Confidence Calibration metrics plus their raw components. Optionally filter by case.
        </p>
        <div className="mb-3">
          <Label>Filter by case (optional)</Label>
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleDownload("csv", `/researcher/export/metrics.csv${caseQuery}`, "session_metrics.csv")}
            disabled={downloading === "csv"}
          >
            {downloading === "csv" ? "Downloading..." : "Download CSV"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleDownload("xlsx", `/researcher/export/metrics.xlsx${caseQuery}`, "session_metrics.xlsx")}
            disabled={downloading === "xlsx"}
          >
            {downloading === "xlsx" ? "Downloading..." : "Download Excel (with event log)"}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-medium text-slate-800 mb-2">Raw session data</h3>
        <p className="text-sm text-slate-500 mb-3">
          Export every recorded item (observations, hypotheses, revisions, evidence links,
          acknowledgements, final reconstruction) for a single session as one CSV.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Session ID</Label>
            <Input type="number" value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="e.g. 1" />
          </div>
          <Button
            onClick={() => handleDownload("raw", `/researcher/export/raw-data.csv?session_id=${sessionId}`, `session_${sessionId}_raw_data.csv`)}
            disabled={!sessionId || downloading === "raw"}
          >
            {downloading === "raw" ? "Downloading..." : "Download CSV"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
