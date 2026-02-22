"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PushNotificationManager } from "@/components/PushNotificationManager";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Instantiate once at module level — safe because NEXT_PUBLIC_ vars are
// embedded at build time and never change at runtime.
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: React.ReactNode }) {
    // NEXT_PUBLIC_CONVEX_URL is required. If missing, show a plain error
    // message without rendering <html>/<body> (layout.tsx owns those).
    if (!convex) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    flexDirection: "column",
                    gap: "1rem",
                    fontFamily: "system-ui, sans-serif",
                    color: "#e2e8f0",
                }}
            >
                <span style={{ fontSize: 40 }}>💬</span>
                <strong style={{ color: "#818cf8", fontSize: "1.25rem" }}>TARS Chat</strong>
                <p style={{ color: "#64748b", margin: 0 }}>
                    Set <code>NEXT_PUBLIC_CONVEX_URL</code> and run{" "}
                    <code>npx convex dev</code>.
                </p>
            </div>
        );
    }

    return (
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <TooltipProvider>
                <PushNotificationManager />
                {children}
            </TooltipProvider>
        </ConvexProviderWithClerk>
    );
}
