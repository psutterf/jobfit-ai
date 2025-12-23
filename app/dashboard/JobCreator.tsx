"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function JobCreator({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function createJob() {
    setError(null);
    setSuccessMsg(null);

    if (!company.trim()) return setError("Company is required");
    if (!role.trim()) return setError("Role is required");
    if (!jobDescription.trim()) return setError("Job description is required");

    setLoading(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw new Error(userErr.message);
      if (!user) throw new Error("Not logged in");

      // NOTE: this assumes your jobs table has columns:
      // user_id, company, role, job_description, created_at
      // If you haven't added location/job_url/notes yet, we can skip them
      const insertPayload: any = {
        user_id: user.id,
        company: company.trim(),
        role: role.trim(),
        job_description: jobDescription.trim(),
      };

      // Only include optional fields if your table has them (see Step 2 below)
      if (location.trim()) insertPayload.location = location.trim();
      if (jobUrl.trim()) insertPayload.job_url = jobUrl.trim();
      if (notes.trim()) insertPayload.notes = notes.trim();

      const { error: insertErr } = await supabase.from("jobs").insert(insertPayload);
      if (insertErr) throw new Error(insertErr.message);

      setSuccessMsg("Job saved!");
      setCompany("");
      setRole("");
      setJobDescription("");
      setLocation("");
      setJobUrl("");
      setNotes("");

      onCreated?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Add a Job</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm text-gray-500">Company *</label>
          <input
            className="w-full rounded-md border bg-transparent p-2"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g., Google"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-gray-500">Role *</label>
          <input
            className="w-full rounded-md border bg-transparent p-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Software Engineer Intern"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-gray-500">Location (optional)</label>
          <input
            className="w-full rounded-md border bg-transparent p-2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Remote / Austin, TX"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-gray-500">Job link (optional)</label>
          <input
            className="w-full rounded-md border bg-transparent p-2"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-gray-500">Job description *</label>
        <textarea
          className="w-full min-h-[140px] rounded-md border bg-transparent p-2"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job posting here..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-gray-500">Notes (optional)</label>
        <textarea
          className="w-full min-h-[80px] rounded-md border bg-transparent p-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything to emphasize? (referral, preferred tech, achievements to highlight)"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

      <button
        onClick={createJob}
        disabled={loading}
        className="rounded-md border px-4 py-2 hover:bg-white/10 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save Job"}
      </button>
    </div>
  );
}
