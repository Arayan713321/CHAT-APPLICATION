"use client";

import { memo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useGetOrCreateConversation } from "@/lib/getOrCreateConversation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";

interface UserListProps {
    clerkId: string;
    search: string;
}

/**
 * Displays all users (except the current one) with live search filtering.
 *
 * Clicking a user calls getOrCreate to find or create a 1:1 conversation,
 * then navigates to that conversation route.
 *
 * Real-time: this query re-runs whenever the users table changes (e.g., a new
 * user signs up or someone's online status updates).
 */
export function UserList({ clerkId, search }: UserListProps) {
    const users = useQuery(api.users.listUsers, {
        currentClerkId: clerkId,
        search: search || undefined,
    });

    // Get the current user's Convex doc so we have their ID for getOrCreate
    const me = useQuery(api.users.getMe, { clerkId });
    const openConversation = useGetOrCreateConversation();

    const handleUserClick = async (otherUserId: Id<"users">) => {
        if (!me) return;
        await openConversation(me._id, otherUserId);
    };

    // Loading skeleton
    if (users === undefined) {
        return (
            <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <UserSkeleton key={i} />
                ))}
            </div>
        );
    }

    // Empty states
    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                    {search ? `No users found for "${search}"` : "No other users yet"}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5 p-2">
            {(users as (typeof users)[number][]).map((user) => (
                <button
                    key={user._id}
                    onClick={() => handleUserClick(user._id)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/70 active:bg-muted w-full"
                >
                    {/* Avatar with online indicator */}
                    <div className="relative flex-shrink-0">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={user.imageUrl} alt={user.name} />
                            <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                                {getInitials(user.name)}
                            </AvatarFallback>
                        </Avatar>
                        {/*
                         * isOnline is derived server-side from:
                         *   Date.now() - lastSeen < 30_000
                         * The client calls a 15s heartbeat to keep lastSeen fresh.
                         */}
                        <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${user.isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                                }`}
                        />
                    </div>

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {user.isOnline ? "Online" : "Offline"}
                        </p>
                    </div>
                </button>
            ))}
        </div>
    );
}

const UserSkeleton = memo(function UserSkeleton() {
    return (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
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
