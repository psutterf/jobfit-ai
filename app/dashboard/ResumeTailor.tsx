"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Job = {
  id: string;
  company: string | null;
  role: string | null;
  created_at: string;
};

export default function ResumeTailor({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [jobId, setJobId] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [style, setStyle] = useState<"ats" | "balanced" | "concise">("balanced");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      setJobsLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setJobs([]);
        setJobsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("jobs")
        .select("id, company, role, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) setJobs(data as Job[]);
      setJobsLoading(false);
    }

    loadJobs();
  }, []);

  async function tailor() {
    setError(null);
    setResult(null);

    if (!jobId) return setError("Please select a job.");
    if (resumeText.trim().length < 200)
      return setError("Please paste your resume text (min ~200 characters).");

    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/tailor-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId, resumeText, style }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to tailor resume");

      setResult(json.document.content_text);
      onCreated?.(); // refresh documents list if you wire it
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tailor Resume</h2>

        <select
          className="rounded-md border bg-transparent p-2 text-sm"
          value={style}
          onChange={(e) => setStyle(e.target.value as any)}
        >
          <option value="balanced">Balanced</option>
          <option value="ats">ATS-heavy</option>
          <option value="concise">Concise</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-gray-500">Select Job *</label>
        <select
          className="w-full rounded-md border bg-transparent p-2"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          disabled={jobsLoading}
        >
          <option value="">
            {jobsLoading ? "Loading jobs..." : "Choose a job"}
          </option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {(j.company ?? "Company") + " — " + (j.role ?? "Role")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-gray-500">Paste Resume Text *</label>
        <textarea
          className="w-full min-h-[180px] rounded-md border bg-transparent p-2"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your resume text here (for v1). PDF upload comes next."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={tailor}
        disabled={loading}
        className="rounded-md border px-4 py-2 hover:bg-white/10 disabled:opacity-50"
      >
        {loading ? "Tailoring..." : "Tailor Resume (uses 1 credit)"}
      </button>

      {result && (
        <div className="rounded-md border p-3 max-h-[60vh] overflow-auto">
          <div
            className="text-sm leading-6"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
