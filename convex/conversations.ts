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
export const getOrCreate = mutation({
    args: {
        currentUserId: v.id("users"),
        otherUserId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const { currentUserId, otherUserId } = args;

        // Sort IDs so [A, B] and [B, A] always produce the same canonical pair.
        const [memberA, memberB] = [currentUserId, otherUserId].sort() as [
            typeof currentUserId,
            typeof otherUserId,
        ];

        // Scan only non-group conversations for a match.
        // We cannot use a compound index on the members array in Convex, so we
        // do a full scan but short-circuit as soon as we find a match.
        const allConversations = await ctx.db
            .query("conversations")
            .collect();

        const existing = allConversations.find((conv) => {
            if (conv.isGroup) return false;
            // Both sorted IDs must be present (order-independent once sorted).
            return (
                conv.members.includes(memberA) &&
                conv.members.includes(memberB) &&
                conv.members.length === 2
            );
        });

        if (existing) return existing._id;

        // Insert with sorted members to guarantee canonical representation.
        return await ctx.db.insert("conversations", {
            isGroup: false,
            members: [memberA, memberB],
            lastMessage: "",
            lastMessageAt: Date.now(),
        });
    },
});

/**
 * List all conversations for a given user, ordered by most recent message.
 *
 * Unread count logic:
 *   For each conversation, count messages where:
 *     - The current user is NOT in readBy
 *     - The current user is NOT the sender (you always "read" your own messages)
 *   This gives the unread badge number shown in the sidebar.
 */
export const list = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const allConversations = await ctx.db
            .query("conversations")
            .withIndex("by_last_message_at")
            .order("desc")
            .collect();

        // Filter to conversations this user belongs to
        const myConversations = allConversations.filter((conv) =>
            conv.members.includes(args.userId)
        );

        const now = Date.now();

        const enriched = await Promise.all(
            myConversations.map(async (conv) => {
                const otherMemberId = conv.members.find(
                    (id) => id !== args.userId
                );

                const otherUserRaw = otherMemberId
                    ? await ctx.db.get(otherMemberId)
                    : null;

                // Derive isOnline from lastSeen heartbeat, not boolean flag.
                const otherUser = otherUserRaw
                    ? {
                        ...otherUserRaw,
                        isOnline: now - otherUserRaw.lastSeen < ONLINE_THRESHOLD_MS,
                    }
                    : null;

                // Count unread messages for this user in this conversation.
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

        return enriched;
    },
});

/**
 * Get a single conversation by ID.
 */
export const get = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.conversationId);
    },
});
