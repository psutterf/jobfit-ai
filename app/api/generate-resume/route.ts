// app/api/resume/generate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  // Candidate info
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string; // e.g. "Fayetteville, AR"

  // Resume inputs (freeform text is fine for v1)
  targetRole?: string; // e.g. "Software Engineer Intern"
  experienceLevel?: "student" | "entry" | "mid" | "senior";
  education?: string;
  experience?: string;
  projects?: string;
  skills?: string;
  additionalInfo?: string; // certs, links, etc.

  // Optional title override
  title?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = requireEnv("OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are an expert resume writer. Output only the resume text. No markdown fences. No commentary.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned empty content");
  return content;
}

function clamp(str: string, max = 16000) {
  const s = (str ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization Bearer token" },
        { status: 401 }
      );
    }

    // Supabase client scoped to user (RLS works)
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = (await req.json()) as Body;

    // Identify user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user = userData.user;

    // Basic validation: require at least something substantial
    const hasContent =
      (body.education?.trim() ||
        body.experience?.trim() ||
        body.projects?.trim() ||
        body.skills?.trim()) ?? "";

    if (!hasContent) {
      return NextResponse.json(
        {
          error:
            "Please provide at least one of: education, experience, projects, or skills.",
        },
        { status: 400 }
      );
    }

    // Consume 1 credit
    const { data: newBalance, error: creditErr } = await supabase.rpc(
      "consume_credits",
      {
        p_user_id: user.id,
        p_amount: 1,
        p_reason: "resume_generation",
        p_metadata: {
          targetRole: body.targetRole ?? null,
          experienceLevel: body.experienceLevel ?? null,
        },
      }
    );

    if (creditErr) {
      const msg = creditErr.message || "";
      if (msg.includes("INSUFFICIENT_CREDITS")) {
        return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
      }
      return NextResponse.json({ error: `Credit error: ${msg}` }, { status: 500 });
    }

    const fullName =
      body.fullName?.trim() ||
      (user.user_metadata?.full_name as string | undefined) ||
      "Your Name";
    const email = body.email?.trim() || user.email || "you@email.com";
    const phone = body.phone?.trim() || "555-555-5555";
    const location = body.location?.trim() || "City, ST";

    const targetRole = body.targetRole?.trim() || "Target Role";
    const experienceLevel = body.experienceLevel ?? "entry";

    // Keep prompt within safe size
    const education = clamp(body.education ?? "");
    const experience = clamp(body.experience ?? "");
    const projects = clamp(body.projects ?? "");
    const skills = clamp(body.skills ?? "");
    const additional = clamp(body.additionalInfo ?? "");

    const prompt = `
Create an ATS-friendly, one-page resume in plain text.

FORMAT RULES:
- Plain text only. No markdown. No tables.
- Use clear section headers: SUMMARY, SKILLS, EXPERIENCE, PROJECTS, EDUCATION (only include sections if you have content).
- Use bullet points for experience/projects. Start bullets with strong verbs.
- Keep bullets concise (1–2 lines each).
- Do NOT invent employers, degrees, dates, metrics, certifications, or technologies not provided.
- If details are missing, keep statements general and truthful.
- Optimize for the target role with relevant keywords found in the provided content.

CANDIDATE HEADER (use exactly this):
${fullName}
${location} | ${phone} | ${email}

TARGET ROLE: ${targetRole}
EXPERIENCE LEVEL: ${experienceLevel}

RAW INPUTS (authoritative):
EDUCATION:
${education}

EXPERIENCE:
${experience}

PROJECTS:
${projects}

SKILLS:
${skills}

ADDITIONAL INFO:
${additional}
`.trim();

    const resumeText = await callOpenAI(prompt);

    const title =
      body.title?.trim() ||
      `Resume - ${fullName}${body.targetRole ? ` (${body.targetRole})` : ""}`;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        type: "resume",
        title,
        content_text: resumeText,
        content_json: {
          source: "generated",
          targetRole: body.targetRole ?? null,
          experienceLevel,
          credits_after: newBalance,
          generated_at: new Date().toISOString(),
        },
      })
      .select("id, title, content_text, created_at")
      .single();

    if (docErr || !doc) {
      return NextResponse.json(
        { error: "Failed to save document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      document: doc,
      creditsRemaining: newBalance,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
