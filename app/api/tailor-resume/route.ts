// app/api/tailor-resume/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, resumeText, style = "balanced" } = body as {
      jobId: string;
      resumeText: string;
      style?: "ats" | "balanced" | "concise";
    };

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    if (!resumeText || resumeText.trim().length < 200) {
      return NextResponse.json(
        { error: "resumeText is required (min ~200 chars)" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    // Get user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json(
        { error: userErr?.message ?? "Unauthorized" },
        { status: 401 }
      );
    }
    const userId = userData.user.id;

    // Check credits
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("credits_remaining")
      .eq("user_id", userId)
      .single();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }
    if (!profile || profile.credits_remaining <= 0) {
      return NextResponse.json({ error: "No credits remaining" }, { status: 402 });
    }

    // Load job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("company, role, job_description, location, notes")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: jobErr?.message ?? "Job not found" },
        { status: 404 }
      );
    }

    const styleInstruction =
      style === "ats"
        ? "Optimize heavily for ATS keywords while staying truthful. Prefer keyword-rich bullet points."
        : style === "concise"
        ? "Make it concise and high-impact. Remove fluff. Keep bullets tight."
        : "Balanced: ATS-friendly but still readable and human.";

    const prompt = `
You are an expert resume editor.

TASK:
Tailor the resume to match the job. Keep everything truthful—do NOT invent employers, degrees, or achievements.
You may rewrite bullets to better align with the job, reorder sections, and emphasize relevant experience.

OUTPUT REQUIREMENTS:
- Return ONLY plain text (no markdown fences).
- Keep a clean resume structure:
  SUMMARY
  SKILLS
  EXPERIENCE
  PROJECTS
  EDUCATION (if present)
- Use bullet points for experience/projects.
- Add a "Targeted Skills" section only if it already exists; otherwise incorporate into SKILLS.
- Include job keywords where appropriate (but do not keyword-stuff).

STYLE:
${styleInstruction}

JOB:
Company: ${job.company ?? ""}
Role: ${job.role ?? ""}
Location: ${job.location ?? ""}
Job Notes: ${job.notes ?? ""}
Job Description:
${job.job_description ?? ""}

RESUME (RAW TEXT):
${resumeText}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "You write high-quality tailored resumes." },
        { role: "user", content: prompt },
      ],
    });

    const tailored = completion.choices[0]?.message?.content?.trim() || "";
    if (!tailored) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    // Save document first (so user gets output even if credit deduction fails)
    const title = `Tailored Resume — ${job.company ?? "Company"} — ${job.role ?? "Role"}`;

    const { data: docInsert, error: docErr } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        job_id: jobId,
        type: "tailored_resume",
        title,
        content_text: tailored,
        content_json: {}, // keep if your table expects it
      })
      .select("id, title, type, created_at, content_text, job_id")
      .single();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 400 });
    }

    // Deduct credit + ledger
    const { error: creditUpdateErr } = await supabase
      .from("profiles")
      .update({ credits_remaining: profile.credits_remaining - 1 })
      .eq("user_id", userId);

    if (!creditUpdateErr) {
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        delta: -1,
        reason: "tailor_resume",
        metadata: { jobId },
      });
    }

    return NextResponse.json({ document: docInsert }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
