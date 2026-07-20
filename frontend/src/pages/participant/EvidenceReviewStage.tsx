/**
 * Stage 2: Evidence Review
 * Participants read all evidence items before generating hypotheses.
 * Supports file/photo viewing with zoom.
 */
import { useState } from "react";
import type { EvidenceItem } from "../../api/types";
import { Button, Card } from "../../components/ui";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

interface Props {
    evidenceItems: EvidenceItem[];
    onAdvance: () => Promise<void>;
}

function getFileUrl(filePath: string) {
    // If already a full URL (Cloudinary), use it directly
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return filePath;
    }
    // Local fallback
    const filename = filePath.split(/[\\/]/).pop();
    return `${API_BASE}/uploads/${filename}`;
}

function isImage(filePath: string) {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filePath);
}

export default function EvidenceReviewStage({ evidenceItems, onAdvance }: Props) {
    const [advancing, setAdvancing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lightboxItem, setLightboxItem] = useState<EvidenceItem | null>(null);
    const [zoom, setZoom] = useState(1);

    function openLightbox(item: EvidenceItem) {
        setLightboxItem(item);
        setZoom(1);
    }

    function closeLightbox() {
        setLightboxItem(null);
        setZoom(1);
    }

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
                    Review all available evidence carefully before forming any hypotheses. For items
                    with attached photographs or files, click the thumbnail or link to view them in
                    full size — you can zoom in and out using the + and − controls. You may refer
                    back to any evidence at any time using the sidebar on the left.
                </p>
            </Card>

            {evidenceItems.map((item, idx) => (
                <Card key={item.id}>
                    <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded min-w-[32px] text-center shrink-0">
                            {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                                {item.description}
                            </p>

                            {/* File attachment */}
                            {item.file_path && (
                                <div className="mt-3">
                                    {isImage(item.file_path) ? (
                                        <div className="space-y-2">
                                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 inline-block cursor-zoom-in" onClick={() => openLightbox(item)}>
                                                <img
                                                    src={getFileUrl(item.file_path)}
                                                    alt={item.label}
                                                    className="max-h-64 max-w-full object-contain"
                                                />
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => openLightbox(item)}
                                                    className="text-sm text-blue-600 hover:underline font-medium"
                                                >
                                                    🔍 View full size / zoom
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <a
                                            href={getFileUrl(item.file_path)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-1.5 rounded"
                                        >
                                            📎 Open attached file
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            ))
            }

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end">
                <Button onClick={handleAdvance} disabled={advancing || evidenceItems.length === 0}>
                    {advancing ? "Proceeding..." : "I have reviewed all evidence — continue to Hypothesis Generation"}
                </Button>
            </div>

            {/* Lightbox */}
            {
                lightboxItem && lightboxItem.file_path && (
                    <div
                        className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center"
                        onClick={closeLightbox}
                    >
                        <div
                            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black bg-opacity-70 px-4 py-2 rounded-full z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="text-white text-xl font-bold px-3 py-1 bg-slate-700 rounded hover:bg-slate-600">−</button>
                            <span className="text-white text-sm min-w-[52px] text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom((z) => Math.min(5, z + 0.25))} className="text-white text-xl font-bold px-3 py-1 bg-slate-700 rounded hover:bg-slate-600">+</button>
                            <button onClick={() => setZoom(1)} className="text-white text-xs px-3 py-1 bg-slate-700 rounded hover:bg-slate-600">Reset</button>
                            <button onClick={closeLightbox} className="text-white text-xs px-3 py-1 bg-red-700 rounded hover:bg-red-600 ml-2">✕ Close</button>
                        </div>
                        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-60 px-4 py-1 rounded-full">
                            {lightboxItem.label}
                        </div>
                        <div
                            className="overflow-auto max-w-full max-h-full mt-24 mb-8 flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={getFileUrl(lightboxItem.file_path)}
                                alt={lightboxItem.label}
                                style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.15s ease", maxWidth: zoom <= 1 ? "90vw" : "none", maxHeight: zoom <= 1 ? "75vh" : "none" }}
                            />
                        </div>
                        <p className="absolute bottom-4 text-slate-400 text-xs">Click outside to close  •  Use + / − to zoom</p>
                    </div>
                )
            }
        </div >
    );
}