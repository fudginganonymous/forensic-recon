/**
 * CasesPanel
 *
 * Researcher case management: create cases, toggle the Bayesian
 * module per case, and add/edit/remove evidence items (with optional
 * file upload and a "contradictory by design" flag used for the
 * "ignored contradictory evidence" metric).
 */
import { useEffect, useState, type FormEvent } from "react";
import api from "../../api/client";
import type { CaseDetail } from "../../api/types";
import {
  Button, Card, ErrorMessage, Input, Label, Textarea, extractErrorMessage,
} from "../../components/ui";

export default function CasesPanel() {
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);

  // New case form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bayesianEnabled, setBayesianEnabled] = useState(false);
  const [groundTruth, setGroundTruth] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await api.get<CaseDetail[]>("/cases");
      setCases(res.data as CaseDetail[]);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateCase(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post("/cases", {
        title,
        description: description || null,
        bayesian_enabled: bayesianEnabled,
        ground_truth_summary: groundTruth || null,
      });
      setTitle("");
      setDescription("");
      setBayesianEnabled(false);
      setGroundTruth("");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function toggleBayesian(caseId: number, current: boolean) {
    setError(null);
    try {
      await api.patch(`/cases/${caseId}`, { bayesian_enabled: !current });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function toggleActive(caseId: number, current: boolean) {
    setError(null);
    try {
      await api.patch(`/cases/${caseId}`, { is_active: !current });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function loadCaseDetail(caseId: number) {
    try {
      const res = await api.get<CaseDetail>(`/cases/${caseId}`);
      setCases((prev) => prev.map((c) => (c.id === caseId ? res.data : c)));
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <ErrorMessage message={error} />

      {/* Create new case form */}
      <Card>
        <h2 className="text-lg font-medium text-slate-800 mb-3">Create a new case</h2>
        <form onSubmit={handleCreateCase} className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Mock Burglary Scene A"
            />
          </div>
          <div>
            <Label>Description (shown to participants)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Ground truth summary (researcher-only, used for scoring accuracy)</Label>
            <Textarea
              value={groundTruth}
              onChange={(e) => setGroundTruth(e.target.value)}
              rows={2}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={bayesianEnabled}
              onChange={(e) => setBayesianEnabled(e.target.checked)}
            />
            Enable optional Bayesian module for this case
          </label>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create case"}
          </Button>
        </form>
      </Card>

      {/* Case list */}
      <div className="space-y-3">
        {cases.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-slate-800">{c.title}</h3>
                {c.description && (
                  <p className="text-sm text-slate-500 mt-1">{c.description}</p>
                )}
              </div>
              <div className="flex gap-2 text-xs shrink-0 ml-2">
                <span
                  className={`px-2 py-1 rounded ${c.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-500"
                    }`}
                >
                  {c.is_active ? "Active" : "Inactive"}
                </span>
                <span
                  className={`px-2 py-1 rounded ${c.bayesian_enabled
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-500"
                    }`}
                >
                  Bayesian {c.bayesian_enabled ? "ON" : "OFF"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                variant="secondary"
                onClick={() => toggleBayesian(c.id, c.bayesian_enabled)}
              >
                Toggle Bayesian
              </Button>
              <Button
                variant="secondary"
                onClick={() => toggleActive(c.id, !!c.is_active)}
              >
                {c.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (expandedCaseId === c.id) {
                    setExpandedCaseId(null);
                  } else {
                    setExpandedCaseId(c.id);
                    loadCaseDetail(c.id);
                  }
                }}
              >
                {expandedCaseId === c.id ? "Hide evidence" : "Manage evidence"}
              </Button>
            </div>

            {expandedCaseId === c.id && (
              <EvidenceManager
                caseDetail={c}
                onChanged={() => loadCaseDetail(c.id)}
              />
            )}
          </Card>
        ))}
        {cases.length === 0 && (
          <p className="text-sm text-slate-400">No cases created yet.</p>
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Evidence manager (shown when a case is expanded)
// ---------------------------------------------------------------------------

function EvidenceManager({
  caseDetail,
  onChanged,
}: {
  caseDetail: CaseDetail;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isContradictory, setIsContradictory] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("label", label);
      formData.append("description", description);
      formData.append("is_contradictory_by_design", String(isContradictory));
      if (file) formData.append("file", file);

      await api.post(`/cases/${caseDetail.id}/evidence`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLabel("");
      setDescription("");
      setIsContradictory(false);
      setFile(null);
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(evidenceId: number) {
    setError(null);
    try {
      await api.delete(`/cases/${caseDetail.id}/evidence/${evidenceId}`);
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <ErrorMessage message={error} />
      <h4 className="text-sm font-medium text-slate-700 mb-2">Evidence items</h4>

      {/* Evidence list */}
      <ul className="space-y-2 mb-4">
        {caseDetail.evidence_items?.map((item) => (
          <li
            key={item.id}
            className="bg-slate-50 rounded-md p-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {item.label}
                  {item.is_contradictory_by_design && (
                    <span className="ml-2 text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                      contradictory by design
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{item.description}</p>
                {item.file_path && (
                  <p className="text-xs text-slate-400 mt-1">
                    File: {item.file_path}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  className="text-xs"
                  onClick={() =>
                    setEditingItemId(editingItemId === item.id ? null : item.id)
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(item.id)}
                  className="text-red-500 text-xs"
                >
                  Remove
                </Button>
              </div>
            </div>

            {/* Inline edit form */}
            {editingItemId === item.id && (
              <EvidenceEditForm
                caseId={caseDetail.id}
                item={item}
                onSaved={() => {
                  setEditingItemId(null);
                  onChanged();
                }}
                onCancel={() => setEditingItemId(null)}
              />
            )}
          </li>
        ))}
        {(!caseDetail.evidence_items || caseDetail.evidence_items.length === 0) && (
          <p className="text-sm text-slate-400">No evidence items added yet.</p>
        )}
      </ul>

      {/* Add new evidence form */}
      <form
        onSubmit={handleAdd}
        className="space-y-2 bg-white border border-slate-100 rounded-md p-3"
      >
        <p className="text-sm font-medium text-slate-700">Add new evidence item</p>
        <div>
          <Label>Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            placeholder="e.g. Item 4: Blood spatter pattern"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={2}
          />
        </div>
        <div>
          <Label>Optional file (photo/document)</Label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isContradictory}
            onChange={(e) => setIsContradictory(e.target.checked)}
          />
          Mark as "contradictory by design" (used in premature-closure scoring)
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Add evidence item"}
        </Button>
      </form>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Inline evidence edit form
// ---------------------------------------------------------------------------

function EvidenceEditForm({
  caseId,
  item,
  onSaved,
  onCancel,
}: {
  caseId: number;
  item: {
    id: number;
    label: string;
    description: string;
    is_contradictory_by_design?: boolean;
  };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [description, setDescription] = useState(item.description);
  const [isContradictory, setIsContradictory] = useState(
    item.is_contradictory_by_design ?? false
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("label", label);
      formData.append("description", description);
      formData.append("is_contradictory_by_design", String(isContradictory));
      if (file) formData.append("file", file);

      await api.patch(`/cases/${caseId}/evidence/${item.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSaved();
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 bg-white border border-slate-200 rounded-md p-3 space-y-2">
      <ErrorMessage message={error} />
      <div>
        <Label>Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div>
        <Label>Replace file (optional)</Label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isContradictory}
          onChange={(e) => setIsContradictory(e.target.checked)}
        />
        Contradictory by design
      </label>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
