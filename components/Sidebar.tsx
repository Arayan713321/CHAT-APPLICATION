"use client";

import { useState, useEffect } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConversationList } from "@/components/ConversationList";
import { UserList } from "@/components/UserList";
import { Input } from "@/components/ui/input";
import { Search, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "chats" | "people";

interface SidebarProps {
    activeConversationId?: string;
}

export function Sidebar({ activeConversationId }: SidebarProps) {
    const [activeTab, setActiveTab] = useState<Tab>("chats");
    const [search, setSearch] = useState("");
    const { user } = useUser();

    // Resolve the Convex user document for the current Clerk user
    const me = useQuery(
        api.users.getMe,
        user ? { clerkId: user.id } : "skip"
    );

    /**
     * Search debounce — 300ms delay prevents a Convex query on every keystroke.
     * Raw `search` updates instantly (input responsive); debouncedSearch drives queries.
     */
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    return (
        <div className="flex h-full flex-col">
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <span className="font-semibold text-sm tracking-wide">TARS</span>
                        {me && (
                            <p className="text-[10px] text-muted-foreground leading-tight">
                                {me.name}
                            </p>
                        )}
                    </div>
                </div>
                {/* Clerk UserButton: shows avatar, profile, sign-out */}
                <UserButton afterSignOutUrl="/" />
            </div>

            {/* ── Search ────────────────────────────────────────────── */}
            <div className="px-3 py-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={activeTab === "chats" ? "Search chats…" : "Search people…"}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-muted/50 border-transparent focus-visible:ring-1"
                    />
                </div>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────── */}
            <div className="flex border-b border-border mx-3">
                <TabButton
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    label="Chats"
                    active={activeTab === "chats"}
                    onClick={() => { setActiveTab("chats"); setSearch(""); }}
                />
                <TabButton
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="People"
                    active={activeTab === "people"}
                    onClick={() => { setActiveTab("people"); setSearch(""); }}
                />
            </div>

            {/* ── Content ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {user && (
                    activeTab === "chats" ? (
                        <ConversationList
                            clerkId={user.id}
                            search={debouncedSearch}
                            activeConversationId={activeConversationId}
                        />
                    ) : (
                        <UserList clerkId={user.id} search={debouncedSearch} />
                    )
                )}
            </div>
        </div>
    );
}

interface TabButtonProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}

function TabButton({ icon, label, active, onClick }: TabButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 transition-colors",
                active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
            )}
        >
            {icon}
            {label}
        </button>
    );
}
