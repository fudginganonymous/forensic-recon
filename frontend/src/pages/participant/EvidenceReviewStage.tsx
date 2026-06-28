/**
 * Stage 2: Evidence Review
 * Participants read all evidence items before generating hypotheses.
 * Read-only — no evaluation at this stage, just familiarisation.
 */
import { useState } from "react";
import type { EvidenceItem } from "../../api/types";
import { Button, Card } from "../../components/ui";

interface Props {
    evidenceItems: EvidenceItem[];
    onAdvance: () => Promise<void>;
}

export default function EvidenceReviewStage({ evidenceItems, onAdvance }: Props) {
    const [advancing, setAdvancing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleAdvance() {
        setAdvancing(true);
        setError(null);
        try {
            await onAdvance();
        } catch {
            setError("Failed to proceed. Please try again.");
        } finally {
            setAdvancing(false);
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-lg font-medium text-slate-800 mb-2">Stage 2: Evidence Review</h2>
                <p className="text-sm text-slate-500">
                    Review all available evidence before forming any hypotheses. Take your time to
                    read each item carefully. You will be able to refer back to this evidence at any
                    point using the sidebar on the left. When you are ready, proceed to hypothesis
                    generation.
                </p>
            </Card>

            {evidenceItems.map((item, idx) => (
                <Card key={item.id}>
                    <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded min-w-[32px] text-center">
                            {idx + 1}
                        </span>
                        <div className="flex-1">
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.description}</p>
                            {item.file_path && (
                                <p className="text-xs text-blue-500 mt-2">📎 File attached</p>
                            )}
                        </div>
                    </div>
                </Card>
            ))}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end">
                <Button onClick={handleAdvance} disabled={advancing || evidenceItems.length === 0}>
                    {advancing ? "Proceeding..." : "I have reviewed all evidence — continue to Hypothesis Generation"}
                </Button>
            </div>
        </div>
    );
}