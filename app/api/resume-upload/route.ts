// app/api/resume-upload/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createRequire } from "module";
import mammoth from "mammoth";

export const runtime = "nodejs"; // IMPORTANT: pdf-parse/mammoth need node runtime

async function makeSupabase() {
    const cookieStore = await cookies();
  
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          },
        },
      }
    );
}

    function makeSupabaseAuthed(token: string) {
        // Create a Supabase client whose DB calls include the user JWT
        return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            },
            // We’re not using cookies for this client, so provide no-op cookie handlers
            cookies: {
            getAll() {
                return [];
            },
            setAll() {},
            },
        }
        );
    }
  

function normalizeText(raw: string) {
  return raw
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[ \t]+\n/g, "\n") // trim trailing spaces
    .replace(/\n{3,}/g, "\n\n") // collapse huge gaps
    .trim();
}

export async function POST(req: Request) {
  try {
    const supabase = await makeSupabase();

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }
      
    const {
        data: { user },
        error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = file.name || "resume";
    const mime = file.type || "";
    

    // ✅ SAFER: turn ArrayBuffer -> Uint8Array -> Buffer
    const ab = await file.arrayBuffer();
    const u8 = new Uint8Array(ab);
    const buf = Buffer.from(u8);

    console.log("UPLOAD:", filename, mime, "size:", file.size);
    console.log("BUFFER LEN:", buf.length);

    // ✅ HARD GUARD: prevents pdf-parse from falling back to its test file
    if (!buf || buf.length === 0) {
        return NextResponse.json(
            {
            error:
                "Uploaded file was empty after reading. Try re-uploading, or export the PDF again (DOCX works best).",
            },
            { status: 400 }
        );
    }

    let extracted = "";

    // PDF
    if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
        const require = createRequire(import.meta.url);
    
        // ✅ IMPORTANT: load the actual library file, not the package root
        let pdfParse: any;
        try {
            pdfParse = require("pdf-parse/lib/pdf-parse"); // <-- most reliable
        } catch {
            pdfParse = require("pdf-parse"); // fallback
        }
    
        if (typeof pdfParse !== "function") {
            throw new Error("pdf-parse did not resolve to a function.");
        }
    
        const data = await pdfParse(buf);
        extracted = data?.text || "";
    }

    // DOCX
    else if (
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer: buf });
      extracted = result.value || "";
    }
    // TXT
    else if (mime.startsWith("text/") || filename.toLowerCase().endsWith(".txt")) {
      extracted = buf.toString("utf8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, or TXT." },
        { status: 400 }
      );
    }

    const content_text = normalizeText(extracted);

    if (content_text.length < 200) {
      return NextResponse.json(
        {
          error:
            "Could not extract enough text from the file. Try a different format (DOCX often works best), or upload a TXT export.",
        },
        { status: 400 }
      );
    }

    const supabaseAuthed = makeSupabaseAuthed(token);

    const { data: inserted, error: insErr } = await supabaseAuthed
        .from("documents")
        .insert({
            user_id: user.id,
            type: "resume",
            title: filename.replace(/\.[^/.]+$/, ""), // remove extension
            content_text,
        })
        .select("id, title, type, created_at")
        .single();


    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ document: inserted }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
