"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Returns a function that either opens an existing conversation or creates a
 * new one, then navigates to it.
 *
 * Keeping this in a custom hook rather than inline in a component ensures the
 * logic is reusable across UserList and any future entry points.
 */
export function useGetOrCreateConversation() {
    const router = useRouter();
    const getOrCreate = useMutation(api.conversations.getOrCreate);

    return async (currentUserId: Id<"users">, otherUserId: Id<"users">) => {
        const conversationId = await getOrCreate({ currentUserId, otherUserId });
        router.push(`/chat/${conversationId}`);
    };
}
