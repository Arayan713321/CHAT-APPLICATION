"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * UserSync — pure side-effects component, renders nothing.
 *
 * Presence strategy:
 *   - On login: upsert user profile + touch lastSeen via heartbeat immediately.
 *   - Every 15s: call heartbeat() to keep lastSeen fresh.
 *   - isOnline is COMPUTED server-side: Date.now() - lastSeen < 30s.
 *   - On beforeunload (actual tab close): set lastSeen = 0 for instant offline.
 *
 * Critically: we do NOT call setOnline(false) on useEffect cleanup, because
 * in React dev mode (StrictMode + HMR), React unmounts and remounts effects
 * on every fast-refresh, which would zero lastSeen and show "Offline"
 * on every code save. The 30-second heartbeat expiry handles natural offline
 * detection without needing an explicit cleanup call.
 */
export function UserSync() {
    const { user, isLoaded } = useUser();

    // Store mutations in refs so the effect only re-runs when user identity
    // changes, not on every render (useMutation returns a new ref each render).
    const upsertUserRef = useRef(useMutation(api.users.upsertUser));
    const setOnlineStatusRef = useRef(useMutation(api.users.setOnlineStatus));
    const heartbeatRef = useRef(useMutation(api.users.heartbeat));

    upsertUserRef.current = useMutation(api.users.upsertUser);
    setOnlineStatusRef.current = useMutation(api.users.setOnlineStatus);
    heartbeatRef.current = useMutation(api.users.heartbeat);

    useEffect(() => {
        if (!isLoaded || !user) return;

        const clerkId = user.id;

        // 1. Sync Clerk profile into Convex (idempotent — safe on every login/refresh)
        upsertUserRef.current({
            clerkId,
            name: user.fullName ?? user.username ?? "User",
            email: user.primaryEmailAddress?.emailAddress ?? "",
            imageUrl: user.imageUrl,
        });

        // 2. Mark online immediately by touching lastSeen
        heartbeatRef.current({ clerkId });

        // 3. Keep lastSeen fresh every 15s so the 30s computed threshold stays true
        const intervalId = setInterval(() => {
            heartbeatRef.current({ clerkId });
        }, HEARTBEAT_INTERVAL_MS);

        // 4. Only mark offline on genuine tab/window close.
        //    Do NOT call setOnline(false) on effect cleanup — this triggers on
        //    every React dev-mode HMR refresh, causing flicker to "Offline".
        const handleUnload = () => {
            setOnlineStatusRef.current({ clerkId, isOnline: false });
        };
        window.addEventListener("beforeunload", handleUnload);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener("beforeunload", handleUnload);
            // intentionally NOT calling setOnline(false) here —
            // presence expires naturally after 30s via the heartbeat threshold.
        };
    }, [isLoaded, user?.id]); // only re-run when Clerk identity changes

    return null;
}
