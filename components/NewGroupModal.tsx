"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewGroupModalProps {
    meId: Id<"users">;
    clerkId: string;
    onClose: () => void;
}

export function NewGroupModal({ meId, clerkId, onClose }: NewGroupModalProps) {
    const [name, setName] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);
    const [search, setSearch] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const users = useQuery(api.users.listUsers, {
        currentClerkId: clerkId,
        search: search || undefined,
    });

    const createGroup = useMutation(api.conversations.createGroup);

    const toggleUser = (userId: Id<"users">) => {
        setError(null);
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            setError("Please enter a group name");
            return;
        }
        if (selectedUsers.length === 0) {
            setError("Please select at least one member");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await createGroup({
                name: name.trim(),
                memberIds: selectedUsers,
                createdBy: meId,
            });
            onClose();
        } catch (err) {
            console.error(err);
            setError("Failed to create group");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-semibold">New Group</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                    {error && (
                        <div className="p-2 text-xs font-medium text-destructive bg-destructive/10 rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Group Name</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="E.g. Engineering Team"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (error) setError(null);
                                }}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Add Members</label>
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="text-sm"
                        />
                    </div>

                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                        {users?.map((user) => (
                            <button
                                key={user._id}
                                onClick={() => toggleUser(user._id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                                    selectedUsers.includes(user._id) ? "bg-primary/10" : "hover:bg-muted"
                                )}
                            >
                                <div className="relative">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user.imageUrl} />
                                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                                    </Avatar>
                                    {selectedUsers.includes(user._id) && (
                                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                            <Check className="h-3 w-3" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{user.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">@{user.username}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-border flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1"
                        disabled={isSubmitting || !name.trim() || selectedUsers.length === 0}
                        onClick={handleCreate}
                    >
                        {isSubmitting ? "Creating..." : "Create Group"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
