import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema — single source of truth for all tables and their indexes.
 * Indexes are carefully chosen to support the query patterns we use in the app.
 */
export default defineSchema({
  // Stores Clerk-authenticated users. Synced from the client on first login.
  users: defineTable({
    clerkId: v.string(),       // Clerk user ID (used as the join key for auth)
    name: v.string(),
    email: v.string(),
    username: v.optional(v.string()),      // Unique handle
    imageUrl: v.string(),
    isOnline: v.boolean(),
    lastSeen: v.number(),      // Unix timestamp in ms
    isDiscoverable: v.optional(v.boolean()), // Whether user shows up in search
    showEmail: v.optional(v.boolean()),     // Whether email is visible on profile
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_name", ["name"])
    .index("by_username", ["username"]),

  // Supports 1:1 (and future group) conversations.
  conversations: defineTable({
    isGroup: v.boolean(),
    name: v.optional(v.string()),         // For group chats; null for 1:1
    members: v.array(v.id("users")),      // Array of Convex user IDs
    lastMessage: v.string(),
    lastMessageAt: v.number(),            // Unix timestamp for ordering
    status: v.optional(v.union(v.literal("pending"), v.literal("accepted"))),
    initiatorId: v.optional(v.id("users")),           // User who started the conversation
  })
    .index("by_last_message_at", ["lastMessageAt"]),

  // Messages within a conversation.
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),                // Unix timestamp in ms
    deleted: v.boolean(),
    // readBy tracks which users have seen this message — used for unread counts
    readBy: v.array(v.id("users")),
    // Optional per-message emoji reactions
    reactions: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          emoji: v.string(),
        })
      )
    ),
  })
    // Primary query pattern: fetch all messages for a conversation, sorted by time
    .index("by_conversation", ["conversationId", "createdAt"]),

  // Ephemeral typing status — updated on every keystroke, queried in real time.
  typingStatus: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    isTyping: v.boolean(),
    updatedAt: v.number(),               // Used to detect stale typing events
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  // Tracks blocked users to prevent messaging and discovery.
  blockedUsers: defineTable({
    userId: v.id("users"),
    blockedUserId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_blocked_user", ["blockedUserId"])
    .index("by_user_blocked", ["userId", "blockedUserId"]),
});
