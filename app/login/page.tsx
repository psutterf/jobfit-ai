"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
  
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMsg(error.message);
          return;
        }
  
        // If email confirmations are ON, session may be null
        if (!data.session) {
          setMsg("Account created! Please check your email to confirm, then log in.");
          setMode("login");
          return;
        }
  
        router.push("/dashboard");
        return;
      }
  
      // login
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }
  
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }
  

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">JobFit AI</h1>
        <p className="text-sm text-gray-500">
          {mode === "signup" ? "Create an account" : "Log in"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border rounded-md p-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <input
            className="w-full border rounded-md p-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />

          <button
            className="w-full rounded-md border p-2"
            disabled={loading}
            type="submit"
          >
            {loading
              ? "Working..."
              : mode === "signup"
              ? "Sign up"
              : "Log in"}
          </button>
        </form>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <button
          className="text-sm underline"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup"
            ? "Already have an account? Log in"
            : "Need an account? Sign up"}
        </button>
      </div>
    </main>
  );
}
