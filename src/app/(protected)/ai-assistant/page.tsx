"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { ConfirmationDialog } from "@/components/ai/ConfirmationDialog";
import { Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface ToolCall {
    id: string;
    name: string;
    params: any;
}

export default function AIAssistantPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content:
                "Hello! I'm your AI financial assistant. I can help you create transactions, view your accounts, and manage categories. What would you like to do today?",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [pendingToolCall, setPendingToolCall] = useState<ToolCall | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (messageText: string, toolCallId?: string, toolResult?: any) => {
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [
                        ...messages,
                        ...(messageText ? [{ role: "user", content: messageText }] : []),
                    ],
                    toolCallId,
                    toolResult,
                }),
            });

            const data = await response.json();

            if (data.error) {
                toast.error(data.error);
                return;
            }

            // Handle tool call that requires confirmation
            if (data.requiresConfirmation && data.toolCall) {
                setPendingToolCall(data.toolCall);
                setShowConfirmation(true);

                // Add a message showing what the AI wants to do
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: data.message || "I've prepared the following action for your review.",
                    },
                ]);
            }
            // Handle tool call result (non-confirmation)
            else if (data.toolCall && !data.requiresConfirmation) {
                const toolResultMessage = formatToolResult(data.toolCall);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: toolResultMessage,
                    },
                ]);
            }
            // Handle successful transaction creation
            else if (data.success) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: data.message,
                    },
                ]);
                toast.success("Transaction created successfully!");
            }
            // Handle regular message
            else if (data.message) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: data.message,
                    },
                ]);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");

        // Add user message to chat
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

        // Send to API
        await sendMessage(userMessage);
    };

    const handleConfirm = async () => {
        if (!pendingToolCall) return;

        setShowConfirmation(false);
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages,
                    toolCallId: pendingToolCall.id,
                    toolResult: {
                        toolName: pendingToolCall.name,
                        params: pendingToolCall.params,
                    },
                }),
            });

            const data = await response.json();

            if (data.error) {
                toast.error(data.error);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: `Error: ${data.error}`,
                    },
                ]);
            } else if (data.success) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: data.message,
                    },
                ]);
                toast.success("Transaction created successfully!");
            }
        } catch (error) {
            console.error("Error confirming action:", error);
            toast.error("Failed to execute action. Please try again.");
        } finally {
            setPendingToolCall(null);
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setShowConfirmation(false);
        setPendingToolCall(null);

        setMessages((prev) => [
            ...prev,
            {
                role: "assistant",
                content: "Action cancelled. Is there anything else I can help you with?",
            },
        ]);
    };

    const formatToolResult = (toolCall: any) => {
        if (toolCall.name === "get_accounts") {
            const accounts = toolCall.result;
            if (accounts.length === 0) {
                return "You don't have any accounts yet.";
            }
            return `Here are your accounts:\n\n${accounts
                .map(
                    (acc: any) =>
                        `• ${acc.name} (${acc.type}): ${acc.currency} ${parseFloat(acc.currentBalance).toFixed(2)}`
                )
                .join("\n")}`;
        }

        if (toolCall.name === "get_categories") {
            const categories = toolCall.result;
            if (categories.length === 0) {
                return "You don't have any categories yet.";
            }
            return `Here are your categories:\n\n${categories
                .map((cat: any) => `• ${cat.name} (${cat.type})`)
                .join("\n")}`;
        }

        return "Action completed.";
    };

    return (
        <div className="container max-w-4xl mx-auto p-4 h-[calc(100vh-4rem)]">
            <Card className="h-full flex flex-col">
                <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        AI Financial Assistant
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                        {messages.map((message, index) => (
                            <ChatMessage key={index} message={message} />
                        ))}

                        {isLoading && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">AI is thinking...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </CardContent>

                <div className="border-t p-4">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me to create a transaction, view accounts, or manage categories..."
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={isLoading || !input.trim()}>
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </form>
                    <div className="mt-2 text-xs text-muted-foreground">
                        AI responses are informational only and are not financial advice.
                    </div>
                </div>
            </Card>

            <ConfirmationDialog
                open={showConfirmation}
                toolCall={pendingToolCall}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </div>
    );
}
