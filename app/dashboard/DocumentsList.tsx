"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DocType = "cover_letter" | "resume" | "tailored_resume" | "other" | string;

type DocumentRow = {
  id: string;
  title: string | null;
  type: DocType | null;
  created_at: string;
  content_text: string | null;
  job_id: string | null;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}



export default function DocumentsList() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<DocType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId]
  );

  const displayText = useMemo(() => {
    const raw = selectedDoc?.content_text ?? "(No content)";
  
    // If the DB stored escaped newlines like "\\n", convert them to real newlines.
    return raw
      .replaceAll("\\r\\n", "\n")
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\n");
  }, [selectedDoc]);
  

  async function loadDocs() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      setError(userErr.message);
      setLoading(false);
      return;
    }

    if (!user) {
      setError("Not logged in");
      setLoading(false);
      return;
    }

    const { data, error: docsErr } = await supabase
      .from("documents")
      .select("id, title, type, created_at, content_text, job_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (docsErr) {
      setError(docsErr.message);
      setLoading(false);
      return;
    }

    setDocs((data ?? []) as DocumentRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadDocs();
  }, []);

  const filtered = useMemo(() => {
    if (filterType === "all") return docs;
    return docs.filter((d) => (d.type ?? "other") === filterType);
  }, [docs, filterType]);

  const availableTypes = useMemo(() => {
    const s = new Set<string>();
    for (const d of docs) s.add(d.type ?? "other");
    return ["all", ...Array.from(s).sort()] as Array<DocType | "all">;
  }, [docs]);

  async function copySelected() {
    if (!selectedDoc?.content_text) return;
    await navigator.clipboard.writeText(selectedDoc.content_text);
    alert("Copied to clipboard!");
  }

  async function deleteDoc(id: string) {
    const ok = confirm("Delete this document? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    // remove locally
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your Documents</h2>

        <div className="flex items-center gap-2">
          <select
            className="rounded-md border bg-transparent p-2 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All types" : t}
              </option>
            ))}
          </select>

          <button
            onClick={loadDocs}
            className="rounded-md border px-3 py-2 text-sm hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading documents...</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-gray-400">
          No documents yet. Generate a cover letter to see it here.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: list */}
        <div className="space-y-2">
          {filtered.map((d) => {
            const active = d.id === selectedId;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={[
                  "w-full text-left rounded-lg border p-3 hover:bg-white/5",
                  active ? "bg-white/5" : "bg-transparent",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">
                    {d.title ?? "(Untitled)"}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(d.created_at)}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  <span className="rounded border px-2 py-0.5">
                    {d.type ?? "other"}
                  </span>
                  {d.job_id && <span className="truncate">job: {d.job_id}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: viewer */}
        <div className="rounded-lg border p-3 min-h-[260px]">
          {!selectedDoc ? (
            <p className="text-sm text-gray-400">Select a document to view it.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">
                    {selectedDoc.title ?? "(Untitled)"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {selectedDoc.type ?? "other"} •{" "}
                    {formatDate(selectedDoc.created_at)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copySelected}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-white/10"
                    disabled={!selectedDoc.content_text}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => deleteDoc(selectedDoc.id)}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-white/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
              

              <div className="max-h-[60vh] overflow-auto rounded-md border p-3">
                <div
                    className="text-sm leading-6"
                    style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    }}
                >
                    {displayText}
                </div>
              </div>


            </div>
          )}
        </div>
      </div>
    </div>
  );
}
