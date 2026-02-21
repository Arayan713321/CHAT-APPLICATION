"use client";

import { memo } from "react";
import { useQuery, useMutation } from "convex/react";
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
    showRequests?: boolean;
}

export function ConversationList({
    clerkId,
    search,
    activeConversationId,
    showRequests = false,
}: ConversationListProps) {
    const me = useQuery(api.users.getMe, { clerkId });
    const conversations = useQuery(
        api.conversations.list,
        me ? { userId: me._id } : "skip"
    );

    const acceptRequest = useMutation(api.conversations.acceptRequest);
    const rejectRequest = useMutation(api.conversations.rejectRequest);

    if (conversations === undefined || me === undefined) {
        return (
            <div className="flex flex-col gap-0.5 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <ConversationSkeleton key={i} />
                ))}
            </div>
        );
    }

    // Filter by status and initiator
    // If showRequests is true: show pending where I am NOT the initiator
    // If showRequests is false: show accepted
    const filteredByStatus = conversations.filter((conv) => {
        if (!me) return false;
        if (showRequests) {
            return conv.status === "pending" && conv.initiatorId !== me._id;
        }
        return conv.status === "accepted" || (conv.status === "pending" && conv.initiatorId === me._id);
    });

    // Client-side filter: search by other user's name or last message
    type ConvItem = NonNullable<typeof conversations>[number];
    const filtered: ConvItem[] = search.trim()
        ? filteredByStatus.filter((conv: ConvItem) =>
            conv.otherUser?.name.toLowerCase().includes(search.toLowerCase().trim()) ||
            (conv.otherUser?.username && conv.otherUser.username.toLowerCase().includes(search.toLowerCase().trim()))
        )
        : filteredByStatus;

    if (filtered.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                    {search
                        ? `No ${showRequests ? "requests" : "chats"} found for "${search}"`
                        : showRequests
                            ? "No pending message requests."
                            : "No conversations yet. Search for a person to start chatting."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5 p-2">
            {filtered.map((conv: ConvItem) => {
                if (!me) return null;
                const isActive = conv._id === activeConversationId;
                const other = conv.otherUser;
                const isPendingToMe = conv.status === "pending" && conv.initiatorId !== me._id;

                return (
                    <div key={conv._id} className="relative group">
                        <Link
                            href={`/chat/${conv._id}`}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors w-full",
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
                                            (conv.unreadCount > 0 && !isActive) || isPendingToMe
                                                ? "font-medium text-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {isPendingToMe ? "Sent you a message request" : (conv.lastMessage || "Start a conversation")}
                                    </p>
                                    {conv.unreadCount > 0 && !isActive && !isPendingToMe && (
                                        <Badge
                                            variant="default"
                                            className="h-4 min-w-4 rounded-full px-1 text-[10px] flex-shrink-0 ml-1"
                                        >
                                            {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                                        </Badge>
                                    )}
                                    {conv.status === "pending" && conv.initiatorId === me._id && (
                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Pending</span>
                                    )}
                                </div>
                            </div>
                        </Link>

                        {/* Request Actions */}
                        {isPendingToMe && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-md shadow-sm">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        acceptRequest({ conversationId: conv._id });
                                    }}
                                    className="h-7 w-7 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    title="Accept"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        rejectRequest({ conversationId: conv._id });
                                    }}
                                    className="h-7 w-7 flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                                    title="Reject"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
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
