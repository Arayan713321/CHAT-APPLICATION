import { format, isToday, isThisYear } from "date-fns";

/**
 * Format a Unix timestamp (ms) for display in chat UI.
 *
 * Rules:
 *   - Today       → "3:45 PM"
 *   - Same year   → "Mar 5, 3:45 PM"
 *   - Other year  → "Mar 5 2023, 3:45 PM"
 */
export function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);

    if (isToday(date)) {
        return format(date, "h:mm a");
    }

    if (isThisYear(date)) {
        return format(date, "MMM d, h:mm a");
    }

    return format(date, "MMM d yyyy, h:mm a");
}

/**
 * Format a timestamp for the sidebar conversation list (shorter form).
 *   - Today       → "3:45 PM"
 *   - Same year   → "Mar 5"
 *   - Other year  → "Mar 5, 2023"
 */
export function formatConversationTimestamp(timestamp: number): string {
    const date = new Date(timestamp);

    if (isToday(date)) {
        return format(date, "h:mm a");
    }

    if (isThisYear(date)) {
        return format(date, "MMM d");
    }

    return format(date, "MMM d, yyyy");
}
