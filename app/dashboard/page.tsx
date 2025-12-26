"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import LogoutButton from "./LogoutButton";
import CoverLetterGenerator from "./CoverLetterGenerator";
import JobCreator from "./JobCreator";
import DocumentsList from "./DocumentsList";
import ResumeTailor from "./ResumeTailor";

type Profile = {
  email: string | null;
  credits_remaining: number;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error: profileErr } = await supabase
        .from("profiles")
        .select("email, credits_remaining, created_at")
        .eq("user_id", user.id)
        .single();

      if (profileErr) {
        setError(profileErr.message);
        setLoading(false);
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    }

    load();
  }, [router, supabase]);

  if (loading) {
    return (
      <main className="p-6">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-red-600 text-sm">Error: {error}</p>
        <p className="text-sm text-gray-600">
          If this is a Row Level Security error, it means the user is logged in
          but the policy/trigger isn’t creating the profile row correctly.
        </p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <LogoutButton />
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-sm text-gray-500">Email</p>
        <p className="font-medium">{profile?.email ?? "Unknown"}</p>

        <p className="mt-3">
          <span className="text-sm text-gray-500">Credits: </span>
          <span className="font-semibold">{profile?.credits_remaining ?? 0}</span>
        </p>
      </div>
      <JobCreator />
      <CoverLetterGenerator />
      <ResumeTailor />
      <DocumentsList />
    </main>
  );
}
