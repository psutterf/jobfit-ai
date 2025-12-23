// app/api/cover-letter/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Tone =
  | "professional"
  | "concise"
  | "friendly"
  | "technical"
  | "confident"
  | "enthusiastic";

type Body = {
  jobId: string;
  tone?: Tone;

  // user-provided header fields (optional; can be generated)
  userFullName?: string;
  userAddressLine1?: string;
  userCityStateZip?: string;
  userPhone?: string;
  userEmail?: string;

  // optional overrides
  companyName?: string;
  hiringManagerName?: string; // if blank -> "Hiring Manager"
  dateText?: string; // if blank -> generated like "MONTH DAY, YEAR"
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toneInstructions(tone: Tone): string {
  switch (tone) {
    case "concise":
      return "Write a concise cover letter (~180-250 words). Strong, direct sentences. Minimal fluff.";
    case "friendly":
      return "Write a warm, personable cover letter. Still professional. Natural voice.";
    case "technical":
      return "Write a technical cover letter emphasizing measurable impact, tools, systems, and engineering rigor.";
    case "confident":
      return "Write a confident cover letter with clear claims backed by evidence. No arrogance.";
    case "enthusiastic":
      return "Write an enthusiastic cover letter that shows genuine interest without sounding cheesy.";
    case "professional":
    default:
      return "Write a professional, standard cover letter with a strong opening and clear fit.";
  }
}

function formatDate(dateText?: string) {
  if (dateText && dateText.trim()) return dateText.trim();
  // simple local-ish format without needing libs
  const d = new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = requireEnv("OPENAI_API_KEY");

  // Using Chat Completions for simplicity
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are an expert career writer. Output only the cover letter body text (no header, no signature).",
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

export async function POST(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    // Create a Supabase client scoped to the user by passing the Authorization header.
    // This allows RLS to work correctly on your tables.
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = (await req.json()) as Body;
    if (!body?.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const tone: Tone = body.tone ?? "professional";

    // Identify user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user = userData.user;

    // Load job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, company, role, job_description, created_at")
      .eq("id", body.jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Consume 1 credit (adjust later)
    // Uses the SQL function we created
    const { data: newBalance, error: creditErr } = await supabase.rpc("consume_credits", {
      p_user_id: user.id,
      p_amount: 1,
      p_reason: "cover_letter_generation",
      p_metadata: { jobId: job.id, tone },
    });

    if (creditErr) {
      const msg = creditErr.message || "";
      if (msg.includes("INSUFFICIENT_CREDITS")) {
        return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
      }
      return NextResponse.json({ error: `Credit error: ${msg}` }, { status: 500 });
    }

    // Fill header fields (generate if missing)
    const headerName = (body.userFullName?.trim() || user.user_metadata?.full_name || "John Doe") as string;
    const headerEmail = (body.userEmail?.trim() || user.email || "john.doe@email.com") as string;

    const address1 = body.userAddressLine1?.trim() || "123 Main St";
    const cityStateZip = body.userCityStateZip?.trim() || "City, ST 00000";
    const phone = body.userPhone?.trim() || "555 555-5555";

    const companyName = body.companyName?.trim() || job.company || "Company Name";
    const hiringManager = body.hiringManagerName?.trim() || "Hiring Manager";
    const dateText = formatDate(body.dateText);

    const prompt = `
Write a cover letter for the job below.

STYLE:
${toneInstructions(tone)}

RULES:
- Do NOT include any header lines, addresses, date, "Dear ...", or signature.
- Output only the main cover letter paragraphs.
- Mention the company name and role naturally.
- Use specific, concrete achievements and metrics when possible (if none provided, keep claims reasonable and general).
- Keep it ATS-friendly. No emojis. No markdown.

JOB:
Company: ${companyName}
Role: ${job.role ?? ""}
Job description:
${job.job_description ?? ""}

CANDIDATE (user-provided fields; may be placeholders):
Name: ${headerName}
Email: ${headerEmail}
Phone: ${phone}
Location: ${cityStateZip}
`;

    const letterBody = await callOpenAI(prompt);

    // Combine into final document format following your template
    const fullText =
`${headerName}
${address1}
${cityStateZip}
${phone}
${headerEmail}

${dateText}
${companyName}

Dear ${hiringManager},

${letterBody}

Sincerely,
${headerName}
`;

    // Save to documents
    const title = `Cover Letter - ${companyName}${job.role ? ` (${job.role})` : ""}`;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        job_id: job.id,
        type: "cover_letter",
        title,
        content_text: fullText,
        content_json: {
          tone,
          companyName,
          hiringManager,
          credits_after: newBalance,
          generated_at: new Date().toISOString(),
        },
      })
      .select("id, title, content_text, created_at")
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
    }

    return NextResponse.json({
      document: doc,
      creditsRemaining: newBalance,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
