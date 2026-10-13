"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/api-client";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const user = localStorage.getItem("fastonmed_user");
    if (user) {
      router.push(window.innerWidth < 768 ? "/dashboard" : "/hub");
    } else {
      router.push("/login");
    }
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
