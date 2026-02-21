import { mutation } from "./_generated/server";

/**
 * One-time cleanup — deletes all users except "Aryan Shaw" and "Arayan Kumar Shaw"
 * (i.e., removes Alice Demo, Bob Demo, and any other test users).
 *
 * Also removes any conversations and messages that no longer have both participants.
 *
 * Run via: npx convex run seed:cleanup
 */
export const cleanup = mutation({
    args: {},
    handler: async (ctx) => {
        // ── Users ────────────────────────────────────────────────────────────
        const keepNames = ["Aryan Shaw", "Arayan Kumar Shaw"];
        const allUsers = await ctx.db.query("users").collect();

        const toDelete = allUsers.filter((u) => !keepNames.includes(u.name));
        const toDeleteIds = new Set(toDelete.map((u) => u._id));

        for (const user of toDelete) {
            await ctx.db.delete(user._id);
            console.log(`Deleted user: ${user.name} (${user.clerkId})`);
        }

        // ── Conversations that reference deleted users ────────────────────────
        const allConversations = await ctx.db.query("conversations").collect();
        const orphanedConvIds: typeof allConversations = [];

        for (const conv of allConversations) {
            const hasOrphan = conv.members.some((id) => toDeleteIds.has(id));
            if (hasOrphan) {
                orphanedConvIds.push(conv);
                await ctx.db.delete(conv._id);
                console.log(`Deleted conversation: ${conv._id}`);
            }
        }

        // ── Messages in orphaned conversations ────────────────────────────────
        const orphanedConvIdSet = new Set(orphanedConvIds.map((c) => c._id));
        const allMessages = await ctx.db.query("messages").collect();

        for (const msg of allMessages) {
            if (orphanedConvIdSet.has(msg.conversationId)) {
                await ctx.db.delete(msg._id);
                console.log(`Deleted message: ${msg._id}`);
            }
        }

        // ── Typing status ────────────────────────────────────────────────────
        const allTyping = await ctx.db.query("typingStatus").collect();
        for (const t of allTyping) {
            if (orphanedConvIdSet.has(t.conversationId) || toDeleteIds.has(t.userId)) {
                await ctx.db.delete(t._id);
            }
        }

        return `Done — deleted ${toDelete.length} users, ${orphanedConvIds.length} conversations.`;
    },
});

/**
 * Seed script — kept for reference but no longer needed with real Clerk users.
 * Run via: npx convex run seed:run
 */
export const run = mutation({
    args: {},
    handler: async (_ctx) => {
        return "Seed not needed — real Clerk users are now in the database.";
    },
});
