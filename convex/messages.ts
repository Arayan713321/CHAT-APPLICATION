import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Send a new message to a conversation.
 *
 * After inserting the message, we update the conversation's lastMessage + lastMessageAt
 * so the sidebar stays correctly ordered without a separate query.
 */
export const send = mutation({
    args: {
        conversationId: v.id("conversations"),
        senderId: v.id("users"),
        content: v.string(),
        type: v.optional(v.union(v.literal("text"), v.literal("image"))),
        imageUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const messageId = await ctx.db.insert("messages", {
            conversationId: args.conversationId,
            senderId: args.senderId,
            content: args.content,
            createdAt: now,
            deleted: false,
            readBy: [args.senderId],
            reactions: [],
            type: args.type ?? "text",
            imageUrl: args.imageUrl,
            status: "sent",
        });

        // Keep conversation metadata in sync for sidebar previews
        await ctx.db.patch(args.conversationId, {
            lastMessage: args.type === "image" ? "📷 Image" : args.content,
            lastMessageAt: now,
        });

        return messageId;
    },
});

/**
 * List all messages in a conversation, ordered by createdAt ascending.
 *
 * Real-time: as new messages are inserted, Convex automatically re-runs this
 * query and pushes the result to all subscribed clients via WebSocket.
 */
export const list = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) =>
                q.eq("conversationId", args.conversationId)
            )
            .order("asc")
            .collect();

        // Join with sender data so each message includes the sender's profile
        return await Promise.all(
            messages.map(async (msg) => {
                const sender = await ctx.db.get(msg.senderId);
                return { ...msg, sender };
            })
        );
    },
});

/**
 * Mark all unread messages in a conversation as read by the current user.
 *
 * This is called:
 *   1. When the chat window mounts (catching up on previously unread messages)
 *   2. When a new message arrives (if the user is currently viewing the conversation)
 *
 * We only patch messages where the user isn't already in readBy, to avoid
 * unnecessary writes.
 */
export const markRead = mutation({
    args: {
        conversationId: v.id("conversations"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) =>
                q.eq("conversationId", args.conversationId)
            )
            .collect();

        const unread = messages.filter(
            (msg) => !msg.readBy.includes(args.userId) && msg.senderId !== args.userId
        );

        await Promise.all(
            unread.map((msg) =>
                ctx.db.patch(msg._id, {
                    readBy: [...msg.readBy, args.userId],
                })
            )
        );
    },
});

/**
 * Soft-delete a message: replaces content with a placeholder and sets deleted=true.
 * Only the sender can delete their own message.
 */
export const deleteMessage = mutation({
    args: {
        messageId: v.id("messages"),
        senderId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message || message.senderId !== args.senderId) return;

        await ctx.db.patch(args.messageId, {
            deleted: true,
            content: "This message was deleted.",
        });
    },
});

/**
 * Toggle an emoji reaction on a message.
 * If the user has already reacted with the same emoji, it removes the reaction.
 * Otherwise it adds it.
 */
export const react = mutation({
    args: {
        messageId: v.id("messages"),
        userId: v.id("users"),
        emoji: v.string(),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) return;

        const reactions = message.reactions ?? [];
        const existingIndex = reactions.findIndex(
            (r: { userId: string; emoji: string }) =>
                r.userId === args.userId && r.emoji === args.emoji
        );

        const updatedReactions =
            existingIndex >= 0
                ? reactions.filter((_: { userId: string; emoji: string }, i: number) => i !== existingIndex) // toggle off
                : [...reactions, { userId: args.userId, emoji: args.emoji }];

        await ctx.db.patch(args.messageId, { reactions: updatedReactions });
    },
});
