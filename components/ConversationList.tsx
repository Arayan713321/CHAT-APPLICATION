"use client";

import { memo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatConversationTimestamp } from "@/lib/formatTimestamp";

interface ConversationListProps {
    clerkId: string;
    search: string;
    activeConversationId?: string;
}

/**
 * Shows the sidebar list of conversations for the current user.
 *
 * This is subscribed in real-time: any new message or conversation update
 * triggers a re-render automatically via Convex's reactive query system.
 *
 * Each item shows: avatar, name, last message preview, timestamp, unread badge.
 */
export function ConversationList({
    clerkId,
    search,
    activeConversationId,
}: ConversationListProps) {
    const me = useQuery(api.users.getMe, { clerkId });
    const conversations = useQuery(
        api.conversations.list,
        me ? { userId: me._id } : "skip"
    );

    if (conversations === undefined || me === undefined) {
        return (
            <div className="flex flex-col gap-0.5 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <ConversationSkeleton key={i} />
                ))}
            </div>
        );
    }

    // Client-side filter: search by other user's name or last message
    type ConvItem = NonNullable<typeof conversations>[number];
    const filtered: ConvItem[] = search.trim()
        ? conversations.filter((conv: ConvItem) =>
            conv.otherUser?.name.toLowerCase().includes(search.toLowerCase().trim())
        )
        : conversations;

    if (filtered.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                    {search
                        ? `No chats found for "${search}"`
                        : "No conversations yet. Search for a person to start chatting."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5 p-2">
            {filtered.map((conv: ConvItem) => {
                const isActive = conv._id === activeConversationId;
                const other = conv.otherUser;

                return (
                    <Link
                        key={conv._id}
                        href={`/chat/${conv._id}`}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/70 text-foreground"
                        )}
                    >
                        {/* Avatar with online dot */}
                        <div className="relative flex-shrink-0">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={other?.imageUrl} alt={other?.name ?? ""} />
                                <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                                    {getInitials(other?.name ?? "?")}
                                </AvatarFallback>
                            </Avatar>
                            {other?.isOnline && (
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
                            )}
                        </div>

                        {/* Conversation info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                                <p className="text-sm font-medium truncate">
                                    {other?.name ?? "Unknown"}
                                </p>
                                {conv.lastMessageAt > 0 && (
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                                        {formatConversationTimestamp(conv.lastMessageAt)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                                <p
                                    className={cn(
                                        "text-xs truncate",
                                        conv.unreadCount > 0 && !isActive
                                            ? "font-medium text-foreground"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {conv.lastMessage || "Start a conversation"}
                                </p>
                                {/*
                                 * Unread badge: count of messages in this conversation
                                 * where the current user is not in readBy and is not
                                 * the sender. Capped at 99+ for display.
                                 */}
                                {conv.unreadCount > 0 && !isActive && (
                                    <Badge
                                        variant="default"
                                        className="h-4 min-w-4 rounded-full px-1 text-[10px] flex-shrink-0 ml-1"
                                    >
                                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}

const ConversationSkeleton = memo(function ConversationSkeleton() {
    return (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                    <div className="h-3.5 w-24 rounded bg-muted" />
                    <div className="h-3 w-10 rounded bg-muted" />
                </div>
                <div className="h-3 w-36 rounded bg-muted" />
            </div>
        </div>
    );
});

function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
}
