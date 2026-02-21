import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { AppShell } from "@/components/AppShell";
import { MessageSquare, Zap, Shield, Users } from "lucide-react";

/**
 * Root page — entry point for the app.
 * - Unauthenticated users → polished landing page with Google + Phone sign-in.
 * - Authenticated users → UserSync (upserts to Convex) + full chat UI.
 */
export default function HomePage() {
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <AppShell />
      </SignedIn>
    </>
  );
}

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight">TARS</span>
        </div>
        <SignInButton mode="modal">
          <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </button>
        </SignInButton>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center gap-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 ring-1 ring-primary/20">
          <MessageSquare className="h-10 w-10 text-primary" />
        </div>

        <div className="space-y-3 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight">
            Real-time chat,{" "}
            <span className="text-primary">simplified.</span>
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Connect instantly with anyone. Reactions, typing indicators, read
            receipts — all in real-time.
          </p>
        </div>

        {/* ── Auth CTA ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* This opens Clerk's modal with Google + Phone options */}
          <SignInButton mode="modal">
            <button className="flex items-center justify-center gap-3 w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all active:scale-95">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </SignInButton>

          <SignInButton mode="modal">
            <button className="flex items-center justify-center gap-3 w-full rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted/50 transition-all active:scale-95">
              <svg className="h-4 w-4 text-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              Continue with Phone
            </button>
          </SignInButton>
        </div>

        {/* ── Feature pills ───────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {[
            { icon: Zap, text: "Real-time" },
            { icon: Shield, text: "Secure" },
            { icon: Users, text: "1:1 Chat" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <Icon className="h-3 w-3" />
              {text}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
