import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Threshold to compute online presence (must match users.ts)
const ONLINE_THRESHOLD_MS = 30_000;

/**
 * Get or create a 1:1 conversation between two users.
 *
 * Defensive uniqueness strategy:
 *   - We sort the two member IDs lexicographically before searching.
 *   - This normalizes the pair regardless of call order (A→B or B→A).
 *   - The insertion also uses the sorted order, making it impossible to
 *     create two conversations for the same pair even under race conditions
 *     (Convex mutations are serialised per deployment).
 */
/**
 * Get or create a 1:1 conversation between two users.
 */
export const getOrCreate = mutation({
    args: {
        currentUserId: v.id("users"),
        otherUserId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const { currentUserId, otherUserId } = args;

        // 1. Check if either user has blocked the other
        const block1 = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user_blocked", (q) =>
                q.eq("userId", currentUserId).eq("blockedUserId", otherUserId)
            )
            .unique();
        const block2 = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user_blocked", (q) =>
                q.eq("userId", otherUserId).eq("blockedUserId", currentUserId)
            )
            .unique();

        if (block1 || block2) {
            throw new Error("Cannot message this user due to privacy settings.");
        }

        const [memberA, memberB] = [currentUserId, otherUserId].sort() as [
            typeof currentUserId,
            typeof otherUserId,
        ];

        const allConversations = await ctx.db
            .query("conversations")
            .collect();

        const existing = allConversations.find((conv) => {
            if (conv.isGroup) return false;
            return (
                conv.members.includes(memberA) &&
                conv.members.includes(memberB) &&
                conv.members.length === 2
            );
        });

        if (existing) return existing._id;

        // Insert with status "pending"
        return await ctx.db.insert("conversations", {
            isGroup: false,
            members: [memberA, memberB],
            lastMessage: "",
            lastMessageAt: Date.now(),
            status: "pending",
            initiatorId: currentUserId,
        });
    },
});

/**
 * List all conversations for a given user.
 * Excludes conversations with blocked users.
 */
export const list = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const allConversations = await ctx.db
            .query("conversations")
            .withIndex("by_last_message_at")
            .order("desc")
            .collect();

        // Get blocked users list for the current user
        const blockedByMe = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        const blockedMe = await ctx.db
            .query("blockedUsers")
            .withIndex("by_blocked_user", (q) => q.eq("blockedUserId", args.userId))
            .collect();

        const blockedIds = new Set([
            ...blockedByMe.map(b => b.blockedUserId),
            ...blockedMe.map(b => b.userId)
        ]);

        // Filter to conversations this user belongs to, AND exclude blocked users
        const myConversations = allConversations.filter((conv) => {
            if (!conv.members.includes(args.userId)) return false;

            const otherMemberId = conv.members.find(id => id !== args.userId);
            if (otherMemberId && blockedIds.has(otherMemberId)) return false;

            // Treat missing status as accepted for backward compatibility
            const status = conv.status ?? "accepted";
            if (status !== 'accepted') return false;

            return true;
        });

        const now = Date.now();

        return await Promise.all(
            myConversations.map(async (conv) => {
                const otherMemberId = conv.members.find(
                    (id) => id !== args.userId
                );

                const otherUserRaw = otherMemberId
                    ? await ctx.db.get(otherMemberId)
                    : null;

                const otherUser = otherUserRaw
                    ? {
                        ...otherUserRaw,
                        isOnline: now - otherUserRaw.lastSeen < ONLINE_THRESHOLD_MS,
                    }
                    : null;

                const unreadMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_conversation", (q) =>
                        q.eq("conversationId", conv._id)
                    )
                    .collect();

                const unreadCount = unreadMessages.filter(
                    (msg) =>
                        !msg.readBy.includes(args.userId) &&
                        msg.senderId !== args.userId
                ).length;

                return {
                    ...conv,
                    otherUser,
                    unreadCount,
                };
            })
        );
    },
});

/**
 * Accept a conversation request.
 */
export const acceptRequest = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.conversationId, {
            status: "accepted",
        });
    },
});

/**
 * Reject/Delete a conversation request.
 */
export const rejectRequest = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        // Delete conversation and its messages
        await ctx.db.delete(args.conversationId);

        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        for (const msg of messages) {
            await ctx.db.delete(msg._id);
        }
    },
});

/**
 * Get a single conversation.
 */
export const get = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.conversationId);
    },
});
