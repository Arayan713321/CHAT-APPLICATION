import { use } from "react";
import { AppShell } from "@/components/AppShell";

interface ChatPageProps {
    params: Promise<{ conversationId: string }>;
}

/**
 * Individual chat route: /chat/[conversationId]
 * Auth is handled by Clerk middleware — only authenticated users reach here.
 * AppShell renders the full sidebar + ChatWindow layout.
 */
export default function ChatPage({ params }: ChatPageProps) {
    const { conversationId } = use(params);
    return <AppShell conversationId={conversationId} />;
}
