"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";

export default function LoginPage() {
  const { login, isAuthenticated, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError("Please fill in all fields.");
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setLocalError(err.message || "Failed to log in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Decorative Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-indigo-500/20 blur-[80px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-fuchsia-500/20 blur-[100px]" />

      <div className="z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400">
            Budgy
          </h1>
          <p className="mt-2 text-sm text-slate-400">Take control of your money</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-slate-100">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {(localError || error) && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                  {localError || error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-slate-800 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-200">
                    Password
                  </Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-slate-800 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500/20"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 border-t border-slate-800 bg-slate-900/40 p-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Button>
              <div className="text-center text-xs text-slate-400">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Create one now
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
