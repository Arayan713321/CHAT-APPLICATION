"use client";

import { Id } from "@/convex/_generated/dataModel";

// Shape of typing user data returned by api.typing.getTyping
interface TypingUser {
    _id: Id<"typingStatus">;
    userId: Id<"users">;
    isTyping: boolean;
    updatedAt: number;
    user: {
        _id: Id<"users">;
        name: string;
        imageUrl: string;
    } | null;
}

interface TypingIndicatorProps {
    typingUsers: TypingUser[];
}

/**
 * TypingIndicator shows an animated "..." bubble when someone is typing.
 *
 * The component mounts/unmounts based on whether typingUsers is non-empty.
 * Since it's driven by a real-time Convex subscription, it automatically
 * disappears when the server stops receiving typing updates (stale guard).
 *
 * We show the typer's name for multi-user scalability (group chats).
 */
export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
    if (typingUsers.length === 0) return null;

    const names = typingUsers
        .map((u) => u.user?.name.split(" ")[0] ?? "Someone")
        .join(", ");

    const label = typingUsers.length === 1 ? `${names} is typing` : `${names} are typing`;

    return (
        <div className="flex items-end gap-2 mb-1">
            {/* Animated dots bubble */}
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                <span className="sr-only">{label}</span>
                <Dot delay="0ms" />
                <Dot delay="160ms" />
                <Dot delay="320ms" />
            </div>
            <span className="text-[10px] text-muted-foreground mb-1">{label}</span>
        </div>
    );
}

function Dot({ delay }: { delay: string }) {
    return (
        <span
            className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: delay, animationDuration: "1s" }}
        />
    );
}
