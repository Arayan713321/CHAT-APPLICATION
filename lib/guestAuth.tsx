/**
 * DEPRECATED — guest auth has been replaced by Clerk authentication.
 * This file is kept as a stub to avoid import errors during migration.
 * You can safely delete this file once all imports have been removed.
 */

export function GuestAuthProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

export function useGuestUser() {
    return null;
}
