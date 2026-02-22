"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

/**
 * Global component to handle browser-level push notifications.
 * It monitors all conversations for new unread messages.
 */
export function PushNotificationManager() {
    const { user } = useUser();
    const me = useQuery(api.users.getMe, user ? { clerkId: user.id } : "skip");

    // We monitor the conversation list which includes unread counts and last messages
    const conversations = useQuery(
        api.conversations.list,
        me ? { userId: me._id } : "skip"
    );

    const prevUnreadTotal = useRef<number>(0);
    const hasRequestedPermission = useRef(false);

    useEffect(() => {
        if (!conversations) return;

        const currentUnreadTotal = conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);

        // If total unread count increased, someone sent a new message
        if (currentUnreadTotal > prevUnreadTotal.current) {
            // Find the most recently updated conversation with unread messages
            const newMsgConv = conversations
                .filter(c => c.unreadCount > 0)
                .sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0];

            if (newMsgConv && document.visibilityState === "hidden") {
                showNotification(newMsgConv);
            }
        }

        prevUnreadTotal.current = currentUnreadTotal;
    }, [conversations]);

    // Request permission on first mount (or when user interacts)
    useEffect(() => {
        if (!hasRequestedPermission.current && typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission();
            }
            hasRequestedPermission.current = true;
        }
    }, []);

    const showNotification = (conv: any) => {
        if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
            return;
        }

        const title = conv.isGroup ? conv.name : (conv.otherUser?.name || "New Message");
        const body = conv.lastMessage || "You received a new message";
        const icon = conv.isGroup ? "/group-icon.png" : (conv.otherUser?.imageUrl || "/logo.png");

        const notification = new Notification(title, {
            body,
            icon,
            tag: conv._id, // Group same conversation notifications
            // @ts-ignore
            renotify: true,
        });

        notification.onclick = () => {
            window.focus();
            // Optionally navigate to the chat:
            // window.location.href = `/chat/${conv._id}`;
        };
    };

    return null; // This component doesn't render anything
}
