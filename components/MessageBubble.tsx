"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatTimestamp } from "@/lib/formatTimestamp";
import { cn } from "@/lib/utils";

// The shape returned by api.messages.list (message joined with sender)
interface MessageWithSender {
    _id: Id<"messages">;
    _creationTime: number;
    conversationId: Id<"conversations">;
    senderId: Id<"users">;
    content: string;
    createdAt: number;
    deleted: boolean;
    readBy: Id<"users">[];
    type?: "text" | "image";
    imageUrl?: string;
    status?: "sending" | "sent" | "error";
    reactions?: { userId: Id<"users">; emoji: string }[];
    sender: {
        _id: Id<"users">;
        name: string;
        imageUrl: string;
    } | null;
}

// Add state for getting the image URL from storage ID
import { useQuery as useConvexQuery } from "convex/react";
import { Loader2 } from "lucide-react";

interface MessageBubbleProps {
    message: MessageWithSender;
    isOwn: boolean;
    currentUserId: Id<"users">;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

/**
 * MessageBubble renders a single message.
 *
 * Own messages are right-aligned; other messages are left-aligned.
 * Deleted messages show italic placeholder text.
 * Reactions are shown below the bubble with group counts.
 * Hovering reveals a quick-reaction picker.
 */
export function MessageBubble({ message, isOwn, currentUserId }: MessageBubbleProps) {
    const react = useMutation(api.messages.react);

    const handleReact = (emoji: string) => {
        react({ messageId: message._id, userId: currentUserId, emoji });
    };

    // Group reactions by emoji for display
    const reactionGroups = (message.reactions ?? []).reduce<
        Record<string, { count: number; isMine: boolean }>
    >((acc, r) => {
        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, isMine: false };
        acc[r.emoji].count++;
        if (r.userId === currentUserId) acc[r.emoji].isMine = true;
        return acc;
    }, {});

    return (
        <div
            className={cn(
                "group flex items-end gap-2 mb-1",
                isOwn ? "flex-row-reverse" : "flex-row"
            )}
        >
            {/* Message bubble */}
            <div className={cn("flex flex-col max-w-[72%] min-w-0", isOwn ? "items-end" : "items-start")}>
                <div
                    className={cn(
                        "relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        message.type === "image" ? "p-1 overflow-hidden" : "px-3.5 py-2",
                        isOwn
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm",
                        message.deleted && "opacity-60 italic",
                        message.status === "sending" && "opacity-70"
                    )}
                >
                    {message.deleted ? (
                        <span className="text-xs">This message was deleted</span>
                    ) : message.type === "image" ? (
                        <div className="space-y-1">
                            <ImageDisplay storageId={message.imageUrl!} />
                            {message.content && message.content !== "📷 Image" && (
                                <p className="px-2 py-1">{message.content}</p>
                            )}
                        </div>
                    ) : (
                        message.content
                    )}
                </div>

                {/* Reactions display */}
                {Object.keys(reactionGroups).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {Object.entries(reactionGroups).map(([emoji, { count, isMine }]) => (
                            <button
                                key={emoji}
                                onClick={() => handleReact(emoji)}
                                className={cn(
                                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border transition-colors",
                                    isMine
                                        ? "bg-primary/15 border-primary/30 text-primary"
                                        : "bg-muted border-border hover:bg-muted/80"
                                )}
                            >
                                {emoji}
                                {count > 1 && <span className="ml-0.5 font-medium">{count}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {/* Timestamp & Status */}
                <div className="flex items-center gap-1.5 mt-0.5 px-1">
                    <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(message.createdAt)}
                    </span>
                    {isOwn && (
                        <div className="flex items-center gap-0.5">
                            {message.status === "sending" ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
                            ) : message.status === "error" ? (
                                <span className="text-[10px] text-destructive font-bold">Failed</span>
                            ) : message.readBy.length > 1 ? (
                                <span className="text-[10px] text-primary font-bold">Read</span>
                            ) : (
                                <span className="text-[10px] text-muted-foreground">Sent</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick reaction picker — visible on hover */}
            {!message.deleted && (
                <div
                    className={cn(
                        "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                        "bg-card border border-border rounded-full px-1.5 py-1 shadow-sm mb-5 flex-shrink-0"
                    )}
                >
                    {QUICK_REACTIONS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => handleReact(emoji)}
                            className="text-sm leading-none hover:scale-125 transition-transform p-0.5"
                            title={emoji}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ImageDisplay({ storageId }: { storageId: string }) {
    const imageUrl = useConvexQuery(api.images.getUrl, { storageId });

    if (!imageUrl) {
        return (
            <div className="flex aspect-square h-48 w-full items-center justify-center bg-muted animate-pulse rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt="Uploaded content"
            className="h-auto max-h-60 w-full rounded-lg object-contain bg-background cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(imageUrl, "_blank")}
        />
    );
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
}

