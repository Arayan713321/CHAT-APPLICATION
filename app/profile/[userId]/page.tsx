"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShieldAlert, ArrowLeft, Loader2, Mail, User, ShieldCheck } from "lucide-react";
import { useGetOrCreateConversation } from "@/lib/getOrCreateConversation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
    const { userId } = useParams();
    const { user: clerkUser } = useUser();

    const targetUser = useQuery(api.users.getUserById, {
        userId: userId as Id<"users">
    });

    const me = useQuery(api.users.getMe,
        clerkUser ? { clerkId: clerkUser.id } : "skip"
    );

    const blockMutation = useMutation(api.users.blockUser);
    const unblockMutation = useMutation(api.users.unblockUser);
    const blockStatus = useQuery(api.users.isBlocked,
        me && targetUser ? { userId: me._id, targetId: targetUser._id } : "skip"
    );

    const openConversation = useGetOrCreateConversation();
    const router = useRouter();

    if (targetUser === undefined || me === undefined || blockStatus === undefined) {
        return (
            <AppShell>
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AppShell>
        );
    }

    if (!targetUser || !me) {
        return (
            <AppShell>
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                    <p className="text-muted-foreground">User not found.</p>
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" /> Back to chats
                        </Button>
                    </Link>
                </div>
            </AppShell>
        );
    }

    const isMe = me._id === targetUser._id;

    const handleMessage = async () => {
        if (!me || !targetUser) return;
        await openConversation(me._id, targetUser._id);
    };

    const handleBlock = async () => {
        if (!me || !targetUser) return;
        if (blockStatus.meBlockedThem) {
            await unblockMutation({ userId: me._id, blockedUserId: targetUser._id });
        } else {
            if (confirm(`Are you sure you want to block ${targetUser.name}? You won't be able to message each other.`)) {
                await blockMutation({ userId: me._id, blockedUserId: targetUser._id });
                router.push("/");
            }
        }
    };

    return (
        <AppShell>
            <div className="flex-1 flex flex-col min-w-0 bg-background/50">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                    <Link href="/" className="sm:hidden">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
                </div>

                {/* Profile Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-2xl mx-auto space-y-8">
                        {/* Avatar & Basic Info */}
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="relative">
                                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                                    <AvatarImage src={targetUser.imageUrl} alt={targetUser.name} />
                                    <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                                        {getInitials(targetUser.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className={cn(
                                    "absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-background",
                                    targetUser.isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                                )} />
                            </div>

                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold">{targetUser.name}</h2>
                                <p className="text-primary font-medium">@{targetUser.username}</p>
                                <p className="text-sm text-muted-foreground pt-1">
                                    {targetUser.isOnline ? "Online now" : "Offline"}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            {!isMe && (
                                <>
                                    <Button
                                        onClick={handleMessage}
                                        disabled={blockStatus.meBlockedThem || blockStatus.theyBlockedMe}
                                        className="gap-2 px-8 py-6 text-base rounded-2xl shadow-lg shadow-primary/20"
                                    >
                                        <MessageSquare className="h-5 w-5" />
                                        Message
                                    </Button>
                                    <Button
                                        variant={blockStatus.meBlockedThem ? "outline" : "destructive"}
                                        onClick={handleBlock}
                                        className="gap-2 py-6 rounded-2xl"
                                    >
                                        <ShieldAlert className="h-5 w-5" />
                                        {blockStatus.meBlockedThem ? "Unblock User" : "Block User"}
                                    </Button>
                                </>
                            )}
                            {isMe && (
                                <Link href="/settings">
                                    <Button variant="outline" className="gap-2 py-6 rounded-2xl">
                                        <User className="h-5 w-5" />
                                        Edit Profile (Coming Soon)
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {/* Details */}
                        <div className="grid gap-4 pt-4">
                            <ProfileDetailCard
                                icon={<User className="h-4 w-4 text-muted-foreground" />}
                                label="Full Name"
                                value={targetUser.name}
                            />
                            {targetUser.email && (
                                <ProfileDetailCard
                                    icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                                    label="Email Address"
                                    value={targetUser.email}
                                />
                            )}
                            <ProfileDetailCard
                                icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                                label="Account Status"
                                value="Verified Member"
                                valueClassName="text-green-500 font-medium"
                            />
                        </div>

                        {/* Presence Note */}
                        {blockStatus.theyBlockedMe && !blockStatus.meBlockedThem && (
                            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                                This user has restricted who can message them.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function ProfileDetailCard({
    icon,
    label,
    value,
    valueClassName
}: {
    icon: React.ReactNode,
    label: string,
    value: string,
    valueClassName?: string
}) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">{label}</p>
                <p className={cn("text-sm truncate", valueClassName)}>{value}</p>
            </div>
        </div>
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
