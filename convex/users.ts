import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// A user is considered online if their lastSeen timestamp is within this window.
const ONLINE_THRESHOLD_MS = 30_000; // 30 seconds

/**
 * Upsert a user record from Clerk/guest data.
 * Idempotent: safe to call on every login/refresh.
 */
/**
 * Upsert a user record from Clerk/guest data.
 * Idempotent: safe to call on every login/refresh.
 */
export const upsertUser = mutation({
    args: {
        clerkId: v.string(),
        name: v.string(),
        email: v.string(),
        imageUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                name: args.name,
                email: args.email,
                imageUrl: args.imageUrl,
                // Keep lastSeen current so presence stays accurate
                lastSeen: Date.now(),
            });
            return existing._id;
        }

        // New user: auto-generate unique username
        let baseUsername = args.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (baseUsername.length < 3) baseUsername = "user";

        let username = baseUsername;
        let counter = 0;

        // Loop until a unique username is found
        while (true) {
            const conflict = await ctx.db
                .query("users")
                .withIndex("by_username", (q) => q.eq("username", username))
                .unique();

            if (!conflict) break;

            // Conflict -> append random 3 digits
            const random = Math.floor(100 + Math.random() * 900);
            username = `${baseUsername}${random}`;

            // Safety break to prevent infinite loops (though extremely unlikely)
            counter++;
            if (counter > 10) {
                username = `${baseUsername}${Date.now().toString().slice(-5)}`;
                break;
            }
        }

        return await ctx.db.insert("users", {
            ...args,
            username,
            isOnline: true,
            lastSeen: Date.now(),
            isDiscoverable: true,
            showEmail: false,
        });
    },
});

/**
 * Heartbeat mutation — called every 15 seconds by active clients.
 */
export const heartbeat = mutation({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .unique();

        if (!user) return;

        await ctx.db.patch(user._id, { lastSeen: Date.now() });
    },
});

/**
 * Set the online/offline status explicitly.
 */
export const setOnlineStatus = mutation({
    args: {
        clerkId: v.string(),
        isOnline: v.boolean(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .unique();

        if (!user) return;

        await ctx.db.patch(user._id, {
            isOnline: args.isOnline,
            lastSeen: args.isOnline ? Date.now() : 0,
        });
    },
});

/**
 * Get the current user's Convex document by their Clerk/guest ID.
 */
export const getMe = query({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .unique();

        if (!user) return null;

        return {
            ...user,
            isOnline: Date.now() - user.lastSeen < ONLINE_THRESHOLD_MS,
        };
    },
});

/**
 * List all users except the current user, filtering by privacy and search.
 * Excludes blocked users and non-discoverable users.
 */
export const listUsers = query({
    args: {
        currentClerkId: v.string(),
        search: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const me = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.currentClerkId))
            .unique();

        if (!me) return [];

        const allUsers = await ctx.db.query("users").collect();

        // Get blocked users list for the current user
        const blockedByMe = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user", (q) => q.eq("userId", me._id))
            .collect();
        const blockedMe = await ctx.db
            .query("blockedUsers")
            .withIndex("by_blocked_user", (q) => q.eq("blockedUserId", me._id))
            .collect();

        const blockedIds = new Set([
            ...blockedByMe.map(b => b.blockedUserId),
            ...blockedMe.map(b => b.userId)
        ]);

        const now = Date.now();

        return allUsers
            .filter((user) => {
                if (user.clerkId === args.currentClerkId) return false;

                // Privacy filters
                const isDiscoverable = user.isDiscoverable ?? true;
                if (!isDiscoverable) return false;
                if (blockedIds.has(user._id)) return false;

                if (args.search && args.search.trim() !== "") {
                    const term = args.search.toLowerCase().trim();
                    const name = user.name.toLowerCase();
                    const username = (user.username ?? "").toLowerCase();
                    const email = user.email.toLowerCase();

                    return (
                        name.includes(term) ||
                        username.includes(term) ||
                        email.includes(term)
                    );
                }
                return true;
            })
            .map((user) => ({
                ...user,
                isOnline: now - user.lastSeen < ONLINE_THRESHOLD_MS,
            }));
    },
});

/**
 * Get a single user by ID.
 * Respects showEmail privacy setting.
 */
export const getUserById = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) return null;

        const enrichedUser = {
            ...user,
            isOnline: Date.now() - user.lastSeen < 30_000,
        };

        // Redact email if showEmail is false
        if (!user.showEmail) {
            // @ts-ignore - we want to remove email before returning
            delete enrichedUser.email;
        }

        return enrichedUser;
    },
});

/**
 * Block a user.
 */
export const blockUser = mutation({
    args: {
        userId: v.id("users"),
        blockedUserId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user_blocked", (q) =>
                q.eq("userId", args.userId).eq("blockedUserId", args.blockedUserId)
            )
            .unique();

        if (existing) return;

        await ctx.db.insert("blockedUsers", {
            userId: args.userId,
            blockedUserId: args.blockedUserId,
        });

        // Optional: delete existing conversations between these users?
        // The prompt says "Exclude blocked users" from queries, 
        // which will effectively hide the conversation.
    },
});

/**
 * Unblock a user.
 */
export const unblockUser = mutation({
    args: {
        userId: v.id("users"),
        blockedUserId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user_blocked", (q) =>
                q.eq("userId", args.userId).eq("blockedUserId", args.blockedUserId)
            )
            .unique();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});

/**
 * Check if a user is blocked by another user.
 */
export const isBlocked = query({
    args: {
        userId: v.id("users"),
        targetId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const blocked = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user_blocked", (q) =>
                q.eq("userId", args.userId).eq("blockedUserId", args.targetId)
            )
            .unique();

        const wasBlockedBy = await ctx.db
            .query("blockedUsers")
            .withIndex("by_user_blocked", (q) =>
                q.eq("userId", args.targetId).eq("blockedUserId", args.userId)
            )
            .unique();

        return {
            meBlockedThem: !!blocked,
            theyBlockedMe: !!wasBlockedBy,
        };
    },
});

/**
 * Update user privacy settings.
 */
export const updateSettings = mutation({
    args: {
        userId: v.id("users"),
        isDiscoverable: v.optional(v.boolean()),
        showEmail: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const patch: any = {};
        if (args.isDiscoverable !== undefined) patch.isDiscoverable = args.isDiscoverable;
        if (args.showEmail !== undefined) patch.showEmail = args.showEmail;

        await ctx.db.patch(args.userId, patch);
    },
});
