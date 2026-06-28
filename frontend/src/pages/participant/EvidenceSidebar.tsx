/**
 * EvidenceSidebar
 * Collapsible sidebar showing all case evidence items throughout the
 * workflow. Participants can expand/collapse it at any stage.
 */
import { useState } from "react";
import type { EvidenceItem } from "../../api/types";

interface Props {
    evidenceItems: EvidenceItem[];
}

export default function EvidenceSidebar({ evidenceItems }: Props) {
    const [open, setOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    return (
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex">
            {/* Collapsed tab */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="bg-blue-600 text-white text-xs font-medium px-2 py-6 rounded-r-lg shadow-lg writing-mode-vertical flex items-center gap-1"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                title={open ? "Hide evidence" : "Show evidence"}
            >
                {open ? "◀ Hide" : "▶ Evidence"}
            </button>

            {/* Drawer */}
            {open && (
                <div className="w-72 max-h-[80vh] bg-white border border-slate-200 shadow-xl rounded-r-lg flex flex-col overflow-hidden">
                    <div className="bg-blue-600 text-white px-3 py-2 flex items-center justify-between">
                        <span className="text-sm font-medium">Evidence Items ({evidenceItems.length})</span>
                        <button onClick={() => setOpen(false)} className="text-white hover:text-blue-200 text-lg leading-none">×</button>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {evidenceItems.map((item, idx) => (
                            <div
                                key={item.id}
                                className="border border-slate-100 rounded-md overflow-hidden"
                            >
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
                                    <div className="px-3 py-2 bg-white">
                                        <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                                        {item.file_path && (
                                            <p className="text-xs text-blue-500 mt-1">📎 File attached</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}