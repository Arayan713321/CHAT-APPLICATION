import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// A user is considered online if their lastSeen timestamp is within this window.
const ONLINE_THRESHOLD_MS = 30_000; // 30 seconds

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

        return await ctx.db.insert("users", {
            ...args,
            isOnline: true,
            lastSeen: Date.now(),
        });
    },
});

/**
 * Heartbeat mutation — called every 15 seconds by active clients.
 *
 * Presence strategy:
 *   - Instead of relying on mount/unmount booleans (which are unreliable on
 *     tab close, mobile backgrounding, etc.), we update `lastSeen` periodically.
 *   - Any query that needs "is online" should compute:
 *       isOnline = Date.now() - lastSeen < ONLINE_THRESHOLD_MS (30s)
 *   - This gives ~15–30s stale tolerance with no boolean flag state machine.
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
 * Still used for immediate offline marking on unmount / beforeunload.
 * Sets lastSeen to 0 when going offline so the 30s threshold triggers immediately.
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
            // Setting lastSeen = 0 when offline makes isOnline computation
            // return false immediately without needing the boolean flag.
            lastSeen: args.isOnline ? Date.now() : 0,
        });
    },
});

/**
 * Get the current user's Convex document by their Clerk/guest ID.
 * Returns null if the user has not been synced yet.
 */
export const getMe = query({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .unique();

        if (!user) return null;

        // Compute isOnline from lastSeen — heartbeat-based, no boolean state.
        return {
            ...user,
            isOnline: Date.now() - user.lastSeen < ONLINE_THRESHOLD_MS,
        };
    },
});

/**
 * List all users except the current user, with computed isOnline presence.
 * Used by the "People" tab in the sidebar.
 */
export const listUsers = query({
    args: {
        currentClerkId: v.string(),
        search: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const allUsers = await ctx.db.query("users").collect();
        const now = Date.now();

        return allUsers
            .filter((user) => {
                if (user.clerkId === args.currentClerkId) return false;
                if (args.search && args.search.trim() !== "") {
                    return user.name
                        .toLowerCase()
                        .includes(args.search.toLowerCase().trim());
                }
                return true;
            })
            .map((user) => ({
                ...user,
                // Derived presence: if lastSeen is within 30s, user is online.
                isOnline: now - user.lastSeen < ONLINE_THRESHOLD_MS,
            }));
    },
});

/**
 * Get a single user by their Convex document ID.
 * Returns the user enriched with computed isOnline presence.
 */
export const getUserById = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) return null;
        return {
            ...user,
            isOnline: Date.now() - user.lastSeen < 30_000,
        };
    },
});
