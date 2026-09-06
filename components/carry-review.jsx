"use client";

import { useEffect, useState } from "react";
import { ReviewPipeline } from "@/components/review-pipeline";
import { CarryCalculator } from "@/components/carry-calculator";
import { COLOR } from "@/lib/theme";

function useGoogleFont() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

// ---------- App shell with tabs ----------
export default function App() {
  useGoogleFont();
  const [tab, setTab] = useState("review");

  return (
    <div className="min-h-screen w-full" style={{ background: COLOR.void }}>
      <div className="max-w-5xl mx-auto px-5 pt-8">
        <div className="flex gap-1 mb-2">
          {[
            { key: "review", label: "Branch 1 — Disclosure Review" },
            { key: "calc", label: "Branch 2 — Carry Calculator" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-xs rounded-t-md"
              style={{
                background: tab === t.key ? COLOR.void : "transparent",
                color: tab === t.key ? COLOR.gold : COLOR.brass,
                border: `1px solid ${tab === t.key ? COLOR.panelEdge : "transparent"}`,
                borderBottom: tab === t.key ? `1px solid ${COLOR.void}` : "none",
                marginBottom: tab === t.key ? "-1px" : "0",
                fontFamily: "IBM Plex Mono, monospace",
                letterSpacing: "0.04em",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="border-t" style={{ borderColor: COLOR.panelEdge }} />
      </div>

      <div className="max-w-5xl mx-auto px-5 py-10">
        <div hidden={tab !== "review"}><ReviewPipeline /></div>
        <div hidden={tab !== "calc"}><CarryCalculator /></div>
      </div>
    </div>
  );
}
