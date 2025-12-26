// app/dashboard/ResumeGenerator.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ExperienceLevel = "student" | "entry" | "mid" | "senior";

export default function ResumeGenerator() {
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [targetRole, setTargetRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("entry");

  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");
  const [projects, setProjects] = useState("");
  const [skills, setSkills] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function generateResume() {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      if (
        !education.trim() &&
        !experience.trim() &&
        !projects.trim() &&
        !skills.trim()
      ) {
        throw new Error(
          "Please provide at least one of: education, experience, projects, or skills."
        );
      }

      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: fullName || undefined,
          location: location || undefined,
          phone: phone || undefined,
          email: email || undefined,

          targetRole: targetRole || undefined,
          experienceLevel,

          education: education || undefined,
          experience: experience || undefined,
          projects: projects || undefined,
          skills: skills || undefined,
          additionalInfo: additionalInfo || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate resume");

      setResult(json.document.content_text);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3 max-w-full min-w-0">
      <div>
        <h2 className="text-lg font-semibold">Generate Resume</h2>
        <p className="text-sm text-gray-400">
          Generates an ATS-friendly resume and saves it to your Documents (cost: 1 credit).
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border bg-transparent p-2"
          placeholder="Full Name (optional)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="rounded-md border bg-transparent p-2"
          placeholder="Location (City, ST) (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          className="rounded-md border bg-transparent p-2"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="rounded-md border bg-transparent p-2"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded-md border bg-transparent p-2"
          placeholder="Target Role (e.g., Software Engineer Intern)"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
        />

        <select
          className="rounded-md border bg-transparent p-2"
          value={experienceLevel}
          onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
        >
          <option value="student">Student</option>
          <option value="entry">Entry</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
        </select>
      </div>

      <textarea
        className="rounded-md border bg-transparent p-2 min-h-[90px]"
        placeholder="Education (paste anything you have: degree, school, grad date, coursework, GPA, etc.)"
        value={education}
        onChange={(e) => setEducation(e.target.value)}
      />

      <textarea
        className="rounded-md border bg-transparent p-2 min-h-[120px]"
        placeholder="Experience (paste bullet notes or a rough history. Include company/role/dates if you know them.)"
        value={experience}
        onChange={(e) => setExperience(e.target.value)}
      />

      <textarea
        className="rounded-md border bg-transparent p-2 min-h-[120px]"
        placeholder="Projects (optional) — include tech stack + what you built + impact"
        value={projects}
        onChange={(e) => setProjects(e.target.value)}
      />

      <textarea
        className="rounded-md border bg-transparent p-2 min-h-[90px]"
        placeholder="Skills (optional) — languages, tools, frameworks, cloud, etc."
        value={skills}
        onChange={(e) => setSkills(e.target.value)}
      />

      <textarea
        className="rounded-md border bg-transparent p-2 min-h-[90px]"
        placeholder="Additional info (optional) — links, certs, awards, leadership, etc."
        value={additionalInfo}
        onChange={(e) => setAdditionalInfo(e.target.value)}
      />

      <button
        onClick={generateResume}
        disabled={loading}
        className="rounded-md border px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate Resume (1 credit)"}
      </button>

      {error && <p className="text-sm text-red-600">Error: {error}</p>}

      {result && (
        <div className="rounded-lg border p-3 max-w-full overflow-hidden min-w-0">
          <div className="text-sm text-gray-400 mb-2">
            Preview (also saved in Documents):
          </div>

          <div
            className="text-sm leading-6 w-full max-w-full"
            style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
            }}
            >
            {result
                .replaceAll("\\r\\n", "\n")
                .replaceAll("\\n", "\n")
                .replaceAll("\\r", "\n")}
          </div>

        </div>
      )}
    </div>
  );
}
