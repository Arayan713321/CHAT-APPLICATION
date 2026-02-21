"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { UserSync } from "@/components/UserSync";
import { MessageSquare } from "lucide-react";

interface AppShellProps {
    conversationId?: string;
}

/**
 * AppShell is the top-level layout component for authenticated users.
 *
 * Desktop: fixed sidebar (320px) + main content area side by side.
 * Mobile:  sidebar OR chat (full-screen), toggled by the conversationId presence.
 *
 * We use CSS classes rather than JS state for the responsive toggle
 * to avoid layout flicker on navigation.
 */
export function AppShell({ conversationId }: AppShellProps) {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(!conversationId);
    const pathname = usePathname();

    const isInChat = Boolean(conversationId);

    return (
        <>
            {/* UserSync runs the heartbeat & upserts the Clerk user on every route.
            It must live here (not just on page.tsx) because AppShell renders
            on both / and /chat/[id]. Without this, the heartbeat stops the
            moment a user opens a conversation, causing them to appear offline. */}
            <UserSync />
            <div className="flex h-screen w-screen overflow-hidden bg-background">
                {/* ── Sidebar ───────────────────────────────────────────────────────── */}
                {/* Desktop: always visible. Mobile: hidden when a conversation is open. */}
                <div
                    className={`
          flex-shrink-0 border-r border-border bg-card
          w-full sm:w-80
          ${isInChat ? "hidden sm:flex" : "flex"}
          flex-col
        `}
                >
                    <Sidebar activeConversationId={conversationId} />
                </div>

                {/* ── Main content area ─────────────────────────────────────────────── */}
                <div
                    className={`
          flex-1 flex-col
          ${isInChat ? "flex" : "hidden sm:flex"}
          min-w-0
        `}
                >
                    {conversationId ? (
                        <ChatWindow conversationId={conversationId} />
                    ) : (
                        <NoChatSelected />
                    )}
                </div>
            </div>
        </>
    );
}

function NoChatSelected() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Your messages</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                    Select a conversation from the sidebar or search for a person to start
                    chatting.
                </p>
            </div>
        </div>
    );
}
