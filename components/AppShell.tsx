"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { UserSync } from "@/components/UserSync";
import { MessageSquare } from "lucide-react";

interface AppShellProps {
    conversationId?: string;
    children?: React.ReactNode;
}

/**
 * AppShell is the top-level layout component for authenticated users.
 */
export function AppShell({ conversationId, children }: AppShellProps) {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(!conversationId);
    const pathname = usePathname();

    const isInChat = Boolean(conversationId || children);

    return (
        <>
            {/* UserSync runs the heartbeat & upserts the Clerk user on every route. */}
            <UserSync />
            <div className="flex h-screen w-screen overflow-hidden bg-background">
                {/* ── Sidebar ───────────────────────────────────────────────────────── */}
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
                    {children ? (
                        children
                    ) : conversationId ? (
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
