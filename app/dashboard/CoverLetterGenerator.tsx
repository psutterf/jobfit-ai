// app/dashboard/CoverLetterGenerator.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Tone =
  | "professional"
  | "concise"
  | "friendly"
  | "technical"
  | "confident"
  | "enthusiastic";

type Job = {
    id: string;
    company: string | null;
    role: string | null;
    created_at: string;
};
  

export default function CoverLetterGenerator() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
    

  const [jobId, setJobId] = useState("");
  const [tone, setTone] = useState<Tone>("professional");

  const [fullName, setFullName] = useState("");
  const [address1, setAddress1] = useState("");
  const [cityStateZip, setCityStateZip] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setResult(null);
    setLoading(true);

    if (!jobId) {
        setError("Please select a job first");
        setLoading(false);
        return;
      }      

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId,
          tone,
          userFullName: fullName || undefined,
          userAddressLine1: address1 || undefined,
          userCityStateZip: cityStateZip || undefined,
          userPhone: phone || undefined,
          userEmail: email || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate");

      setResult(json.document.content_text);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadJobs() {
      setJobsLoading(true);
  
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
  
      if (userErr || !user) {
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
  
  

  return (
    
    <div style={{ marginTop: "2rem" }}>
      <h2>Generate Cover Letter</h2>

      <div className="space-y-1">
        <label className="text-sm text-gray-500">Select Job *</label>
        <select
            className="w-full rounded-md border bg-transparent p-2"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={jobsLoading}>
            
            <option value="">
            {jobsLoading ? "Loading jobs..." : "Choose a job"}
            </option>

            {jobs.map((job) => (
            <option key={job.id} value={job.id}>
                {(job.company ?? "Company") + " — " + (job.role ?? "Role")}
            </option>
            ))}
        </select>

        {!jobsLoading && jobs.length === 0 && (
            <p className="text-xs text-gray-500">
            No jobs yet. Add one above, then come back here.
            </p>
        )}
      </div>


      <select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
        <option value="professional">Professional</option>
        <option value="concise">Concise</option>
        <option value="friendly">Friendly</option>
        <option value="technical">Technical</option>
        <option value="confident">Confident</option>
        <option value="enthusiastic">Enthusiastic</option>
      </select>

      <input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <input placeholder="Address" value={address1} onChange={(e) => setAddress1(e.target.value)} />
      <input placeholder="City, State ZIP" value={cityStateZip} onChange={(e) => setCityStateZip(e.target.value)} />
      <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <button onClick={generate} disabled={loading}>
        {loading ? "Generating..." : "Generate Cover Letter"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>
          {result}
        </pre>
      )}
    </div>
  );
}
