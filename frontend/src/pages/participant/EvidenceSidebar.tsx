/**
 * EvidenceSidebar — collapsible sidebar showing all case evidence.
 * Supports file/photo viewing with zoom in/out.
 */
import { useState } from "react";
import type { EvidenceItem } from "../../api/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

interface Props {
    evidenceItems: EvidenceItem[];
}

export default function EvidenceSidebar({ evidenceItems }: Props) {
    const [open, setOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
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

    function getFileUrl(filePath: string): string {
        // If already a full URL (e.g. Cloudinary), use directly
        if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
            return filePath;
        }
        // Extract just the filename from whatever path is stored
        // e.g. ./uploads/case_1/photo.jpg → photo.jpg
        const filename = filePath.split(/[/\\]/).pop() ?? filePath;
        return `${API_BASE}/uploads/${filename}`;
    }

    function isImage(filePath: string) {
        return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filePath);
    }

    return (
        <>
            {/* Sidebar */}
            <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex">
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="bg-blue-600 text-white text-xs font-medium px-2 py-6 rounded-r-lg shadow-lg"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                    title={open ? "Hide evidence" : "Show evidence"}
                >
                    {open ? "◀ Hide" : "▶ Evidence"}
                </button>

                {open && (
                    <div className="w-80 max-h-[80vh] bg-white border border-slate-200 shadow-xl rounded-r-lg flex flex-col overflow-hidden">
                        <div className="bg-blue-600 text-white px-3 py-2 flex items-center justify-between">
                            <span className="text-sm font-medium">Evidence Items ({evidenceItems.length})</span>
                            <button onClick={() => setOpen(false)} className="text-white hover:text-blue-200 text-lg leading-none">×</button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {evidenceItems.map((item, idx) => (
                                <div key={item.id} className="border border-slate-100 rounded-md overflow-hidden">
                                    <button
                                        className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center gap-2"
                                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                    >
                                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded">
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs font-medium text-slate-700 flex-1 text-left line-clamp-1">
                                            {item.label}
                                        </span>
                                        <span className="text-slate-400 text-xs">{expandedId === item.id ? "▲" : "▼"}</span>
                                    </button>

                                    {expandedId === item.id && (
                                        <div className="px-3 py-2 bg-white space-y-2">
                                            <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>

                                            {/* File attachment */}
                                            {item.file_path && (
                                                <div className="mt-2">
                                                    {isImage(item.file_path) ? (
                                                        <div className="space-y-1">
                                                            <img
                                                                src={getFileUrl(item.file_path)}
                                                                alt={item.label}
                                                                className="w-full rounded border border-slate-200 cursor-zoom-in object-cover max-h-40"
                                                                onClick={() => openLightbox(item)}
                                                            />
                                                            <button
                                                                onClick={() => openLightbox(item)}
                                                                className="text-xs text-blue-600 hover:underline"
                                                            >
                                                                🔍 View full size
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <a
                                                            href={getFileUrl(item.file_path)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            📎 Open attached file
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div >

            {/* Lightbox with zoom */}
            {
                lightboxItem && lightboxItem.file_path && (
                    <div
                        className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center"
                        onClick={closeLightbox}
                    >
                        {/* Toolbar */}
                        <div
                            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black bg-opacity-70 px-4 py-2 rounded-full z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                                className="text-white text-xl font-bold px-3 py-1 bg-slate-700 rounded hover:bg-slate-600"
                                title="Zoom out"
                            >
                                −
                            </button>
                            <span className="text-white text-sm min-w-[52px] text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
                                className="text-white text-xl font-bold px-3 py-1 bg-slate-700 rounded hover:bg-slate-600"
                                title="Zoom in"
                            >
                                +
                            </button>
                            <button
                                onClick={() => setZoom(1)}
                                className="text-white text-xs px-3 py-1 bg-slate-700 rounded hover:bg-slate-600"
                            >
                                Reset
                            </button>
                            <button
                                onClick={closeLightbox}
                                className="text-white text-xs px-3 py-1 bg-red-700 rounded hover:bg-red-600 ml-2"
                            >
                                ✕ Close
                            </button>
                        </div>

                        {/* Label */}
                        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-60 px-4 py-1 rounded-full">
                            {lightboxItem.label}
                        </div>

                        {/* Zoomable image */}
                        <div
                            className="overflow-auto max-w-full max-h-full mt-24 mb-8 flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={getFileUrl(lightboxItem.file_path)}
                                alt={lightboxItem.label}
                                style={{
                                    transform: `scale(${zoom})`,
                                    transformOrigin: "center center",
                                    transition: "transform 0.15s ease",
                                    maxWidth: zoom <= 1 ? "90vw" : "none",
                                    maxHeight: zoom <= 1 ? "75vh" : "none",
                                }}
                            />
                        </div>

                        <p className="absolute bottom-4 text-slate-400 text-xs">
                            Click outside image to close  •  Use + / − to zoom
                        </p>
                    </div>
                )
            }
        </>
    );
}