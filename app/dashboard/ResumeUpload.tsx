// app/dashboard/ResumeUpload.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client"; // ✅ ADD THIS

export default function ResumeUpload({ onUploaded }: { onUploaded?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload() {
    setMsg(null);

    if (!file) {
      setMsg("Pick a file first.");
      return;
    }

    setLoading(true);
    try {
      // ✅ Get access token from the client session
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No active session. Please log in again.");

      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/resume-upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`, // ✅ THIS IS THE KEY
        },
        body: form,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);

      setMsg(`✅ Uploaded: ${json.document?.title ?? file.name}`);
      setFile(null);
      onUploaded?.();
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Upload failed"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Upload Your Resume</h2>

      <p className="text-sm text-gray-400">
        Supported: PDF, DOCX, TXT. We extract text and save it as a “resume” document.
      </p>

      <input
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          setMsg(f ? `Selected: ${f.name}` : null);
        }}
        className="block w-full text-sm"
      />

      <button
        type="button"
        onClick={upload}
        disabled={loading}
        className="rounded-md border px-4 py-2 hover:bg-white/10 disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload Resume"}
      </button>

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
