"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, ChevronDown, MessageCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

interface ChatWindowProps {
    conversationId: string;
}

/** Mirrors the shape returned by api.messages.list */
type MessageWithSender = {
    _id: Id<"messages">;
    _creationTime: number;
    conversationId: Id<"conversations">;
    senderId: Id<"users">;
    content: string;
    createdAt: number;
    deleted: boolean;
    readBy: Id<"users">[];
    reactions?: Array<{ userId: Id<"users">; emoji: string }>;
    sender: {
        _id: Id<"users">;
        name: string;
        imageUrl: string;
        isOnline: boolean;
        clerkId: string;
        email: string;
        lastSeen: number;
    } | null;
};

// How long after the user stops typing before we clear the typing indicator (ms).
const TYPING_TIMEOUT_MS = 2000;

/**
 * ChatWindow — the main chat interface.
 *
 * Real-time flow:
 *   1. useQuery(api.messages.list) subscribes to messages for this conversation.
 *      Convex pushes updates via WebSocket whenever a message is inserted.
 *   2. useQuery(api.typing.getTyping) subscribes to active typers.
 *
 * Auto-scroll logic:
 *   An IntersectionObserver watches a "sentinel" div at the bottom.
 *   When visible → user is at the bottom → auto-scroll on new messages.
 *   When not visible → show a "↓ New messages" button instead.
 */
export function ChatWindow({ conversationId }: ChatWindowProps) {
    const { user: clerkUser } = useUser();

    const me = useQuery(
        api.users.getMe,
        clerkUser ? { clerkId: clerkUser.id } : "skip"
    );

    const conversation = useQuery(api.conversations.get, {
        conversationId: conversationId as Id<"conversations">,
    });

    const messages = useQuery(api.messages.list, {
        conversationId: conversationId as Id<"conversations">,
    });

    const typingUsers = useQuery(
        api.typing.getTyping,
        me
            ? {
                conversationId: conversationId as Id<"conversations">,
                currentUserId: me._id,
            }
            : "skip"
    );

    const sendMessage = useMutation(api.messages.send);
    const markRead = useMutation(api.messages.markRead);
    const setTyping = useMutation(api.typing.setTyping);

    const [inputValue, setInputValue] = useState("");
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [hasNewMessages, setHasNewMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevMessageCountRef = useRef(0);

    // ── Resolve the other participant ──────────────────────────────────────────
    const otherUserId =
        me && conversation
            ? conversation.members.find((id: string) => id !== me._id)
            : null;

    const otherUser = useQuery(
        api.users.getUserById,
        otherUserId ? { userId: otherUserId } : "skip"
    );

    // ── Mark messages as read when this chat window is open ───────────────────
    useEffect(() => {
        if (!me || !messages || messages.length === 0) return;
        markRead({
            conversationId: conversationId as Id<"conversations">,
            userId: me._id,
        });
    }, [messages, me, conversationId, markRead]);

    // ── IntersectionObserver: track whether the user is at the bottom ──────────
    useEffect(() => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsAtBottom(entry.isIntersecting);
                if (entry.isIntersecting) setHasNewMessages(false);
            },
            { root: scrollContainerRef.current, threshold: 0.1 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    // ── Auto-scroll / new message detection ────────────────────────────────────
    useEffect(() => {
        if (!messages) return;
        const newCount = messages.length;
        if (newCount > prevMessageCountRef.current) {
            if (isAtBottom) {
                bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
            } else {
                setHasNewMessages(true);
            }
        }
        prevMessageCountRef.current = newCount;
    }, [messages, isAtBottom]);

    // ── Send message ────────────────────────────────────────────────────────────
    const handleSend = useCallback(async () => {
        const content = inputValue.trim();
        if (!content || !me || isSending) return;

        setIsSending(true);
        setSendError(null);
        setInputValue("");

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTyping({
            conversationId: conversationId as Id<"conversations">,
            userId: me._id,
            isTyping: false,
        });

        try {
            await sendMessage({
                conversationId: conversationId as Id<"conversations">,
                senderId: me._id,
                content,
            });
        } catch {
            setSendError("Failed to send. Try again.");
            setInputValue(content);
        } finally {
            setIsSending(false);
        }
    }, [inputValue, me, conversationId, sendMessage, setTyping, isSending]);

    // ── Typing detection ────────────────────────────────────────────────────────
    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setInputValue(e.target.value);
            if (sendError) setSendError(null);
            if (!me) return;

            setTyping({
                conversationId: conversationId as Id<"conversations">,
                userId: me._id,
                isTyping: true,
            });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setTyping({
                    conversationId: conversationId as Id<"conversations">,
                    userId: me._id,
                    isTyping: false,
                });
            }, TYPING_TIMEOUT_MS);
        },
        [me, conversationId, setTyping, sendError]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    const scrollToBottom = useCallback(() => {
        bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
        setHasNewMessages(false);
    }, []);

    if (!me) return null;

    return (
        <div className="flex h-full flex-col">
            {/* ── Chat header ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3 flex-shrink-0">
                <Link href="/" className="sm:hidden flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>

                {otherUser ? (
                    <>
                        <div className="relative flex-shrink-0">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={otherUser.imageUrl} alt={otherUser.name} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {getInitials(otherUser.name)}
                                </AvatarFallback>
                            </Avatar>
                            {otherUser.isOnline && (
                                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-background bg-green-500" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight truncate">
                                {otherUser.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {otherUser.isOnline ? "Online" : "Offline"}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-3 flex-1">
                        <div className="h-9 w-9 rounded-full bg-muted animate-pulse flex-shrink-0" />
                        <div className="space-y-1">
                            <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
                            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Messages area ─────────────────────────────────────────────── */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-0"
            >
                {messages === undefined ? (
                    <MessageListSkeleton />
                ) : messages.length === 0 ? (
                    <EmptyChatState name={otherUser?.name} />
                ) : (
                    <>
                        {(messages as MessageWithSender[]).map((msg, index: number) => {
                            const prevMsg = index > 0 ? messages[index - 1] : null;
                            const showDateSeparator =
                                !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                            return (
                                <div key={msg._id}>
                                    {showDateSeparator && (
                                        <DateSeparator timestamp={msg.createdAt} />
                                    )}
                                    <MessageBubble
                                        message={msg}
                                        isOwn={msg.senderId === me._id}
                                        currentUserId={me._id}
                                    />
                                </div>
                            );
                        })}
                        {typingUsers && typingUsers.length > 0 && (
                            <TypingIndicator typingUsers={typingUsers} />
                        )}
                        <div ref={bottomSentinelRef} className="h-1" />
                    </>
                )}
            </div>

            {/* ── "↓ New messages" pill ──────────────────────────────────────── */}
            {hasNewMessages && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
                    <Button
                        size="sm"
                        onClick={scrollToBottom}
                        className="shadow-lg rounded-full gap-1.5"
                    >
                        <ChevronDown className="h-3.5 w-3.5" />
                        New messages
                    </Button>
                </div>
            )}

            {/* ── Send error banner ─────────────────────────────────────────── */}
            {sendError && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {sendError}
                </div>
            )}

            {/* ── Message input ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 border-t border-border px-4 py-3 flex-shrink-0">
                <Input
                    placeholder="Type a message…"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-muted/50 border-transparent focus-visible:ring-1 text-sm"
                    autoComplete="off"
                    disabled={isSending}
                />
                <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isSending}
                    className="h-9 w-9 flex-shrink-0"
                >
                    <Send className={`h-4 w-4 ${isSending ? "opacity-50" : ""}`} />
                </Button>
            </div>
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MessageListSkeleton() {
    return (
        <div className="flex flex-col gap-3 py-2">
            {[120, 80, 160, 100, 200, 90].map((w, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <div className="h-8 rounded-2xl bg-muted animate-pulse" style={{ width: w }} />
                </div>
            ))}
        </div>
    );
}

const EmptyChatState = memo(function EmptyChatState({ name }: { name?: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs text-muted-foreground">
                    {name ? `Say hello to ${name}!` : "Start the conversation"}
                </p>
            </div>
        </div>
    );
});

const DateSeparator = memo(function DateSeparator({ timestamp }: { timestamp: number }) {
    const label = new Date(timestamp).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
    });
    return (
        <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">{label}</span>
            <div className="flex-1 h-px bg-border" />
        </div>
    );
});

function isSameDay(ts1: number, ts2: number): boolean {
    const d1 = new Date(ts1), d2 = new Date(ts2);
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function getInitials(name: string): string {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}
