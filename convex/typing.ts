import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Typing events older than this are ignored (stale guard)
const TYPING_STALE_MS = 3000;

/**
 * Update the typing status for a user in a conversation.
 *
 * If a record already exists for this (conversationId, userId) pair, we patch it.
 * Otherwise we create a new one.
 *
 * The client calls this mutation:
 *   - setTyping(true)  → on every keypress (debounced in the UI)
 *   - setTyping(false) → on 2s idle timeout, or when message is sent
 *
 * updatedAt is always set to Date.now() so stale detection works correctly.
 */
export const setTyping = mutation({
    args: {
        conversationId: v.id("conversations"),
        userId: v.id("users"),
        isTyping: v.boolean(),
    },
    handler: async (ctx, args) => {
        // Fetch existing typing record for this conversation, then filter by userId
        const records = await ctx.db
            .query("typingStatus")
            .withIndex("by_conversation", (q) =>
                q.eq("conversationId", args.conversationId)
            )
            .collect();

        const existing = records.find((r) => r.userId === args.userId);
        if (existing) {
            await ctx.db.patch(existing._id, {
                isTyping: args.isTyping,
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.insert("typingStatus", {
                conversationId: args.conversationId,
                userId: args.userId,
                isTyping: args.isTyping,
                updatedAt: Date.now(),
            });
        }
    },
});

/**
 * Get active typers in a conversation, excluding the current user.
 *
 * We filter out:
 *   - The current user (they don't see their own typing indicator)
 *   - Stale records (updatedAt > 3 seconds ago)
 *   - Records where isTyping is false
 *
 * This query is subscribed to in real-time by ChatWindow, so the typing
 * indicator appears/disappears within ~100ms of a keypress.
 */
export const getTyping = query({
    args: {
        conversationId: v.id("conversations"),
        currentUserId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const records = await ctx.db
            .query("typingStatus")
            .withIndex("by_conversation", (q) =>
                q.eq("conversationId", args.conversationId)
            )
            .collect();

        // Filter to active, non-stale, non-self typers
        const activeTypers = records.filter(
            (r) =>
                r.userId !== args.currentUserId &&
                r.isTyping &&
                now - r.updatedAt < TYPING_STALE_MS
        );

        // Join with user data for display
        return await Promise.all(
            activeTypers.map(async (r) => {
                const user = await ctx.db.get(r.userId);
                return { ...r, user };
            })
        );
    },
});
