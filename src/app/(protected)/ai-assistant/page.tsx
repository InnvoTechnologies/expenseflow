"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { ConfirmationDialog } from "@/components/ai/ConfirmationDialog";
import { Send, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import posthog from "posthog-js";
import { Badge } from "@/components/ui/badge";

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
    const [messages, setMessages] = useState<Message[]>([]);
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

        // Track AI assistant message sent
        posthog.capture('ai_assistant_message_sent', {
            message_length: userMessage.length,
            conversation_length: messages.length,
        });

        // Add user message to chat
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

        // Send to API
        await sendMessage(userMessage);
    };

    const handleConfirm = async () => {
        if (!pendingToolCall) return;

        setShowConfirmation(false);
        setIsLoading(true);

        // Track AI transaction confirmation attempt
        posthog.capture('ai_transaction_confirmed', {
            tool_name: pendingToolCall.name,
            tool_params: pendingToolCall.params,
        });

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

                // Track AI transaction error
                posthog.capture('ai_transaction_failed', {
                    tool_name: pendingToolCall.name,
                    error_message: data.error,
                });
            } else if (data.success) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: data.message,
                    },
                ]);
                toast.success("Transaction created successfully!");

                // Track successful AI transaction
                posthog.capture('ai_transaction_success', {
                    tool_name: pendingToolCall.name,
                });
            }
        } catch (error) {
            console.error("Error confirming action:", error);
            toast.error("Failed to execute action. Please try again.");

            // Track error
            posthog.captureException(error as Error);
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
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full relative">
            {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-3xl mx-auto w-full mt-[-10vh]">
                    <h1 className="text-3xl sm:text-4xl font-semibold mb-3 tracking-tight text-center">Ask AI to manage your finances...</h1>
                    <p className="text-zinc-500 mb-10 text-center">AI drafts transactions, checks balances, and provides insights.</p>
                    
                    <form onSubmit={handleSubmit} className="w-full relative shadow-2xl rounded-[24px]">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Describe your transaction or ask a question..."
                            disabled={isLoading}
                            className="w-full h-16 pl-6 pr-16 rounded-[24px] bg-[#121214] border-white/5 text-lg focus-visible:ring-1 focus-visible:ring-white/20 transition-all dark:placeholder:text-zinc-600"
                        />
                        <Button 
                            type="submit" 
                            size="icon"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2 top-2 h-12 w-12 rounded-[18px] bg-[#222224] hover:bg-[#2A2A2D] text-white dark:border dark:border-white/5 transition-colors"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 text-zinc-300" />}
                        </Button>
                    </form>
                    
                    <div className="flex flex-wrap justify-center gap-3 mt-8">
                        <Badge variant="outline" className="px-4 py-2 rounded-full cursor-pointer hover:bg-[#121214] border-white/10 transition-colors text-xs font-medium text-zinc-400" onClick={() => setInput("Create an expense for $15 for lunch")}>Create an expense</Badge>
                        <Badge variant="outline" className="px-4 py-2 rounded-full cursor-pointer hover:bg-[#121214] border-white/10 transition-colors text-xs font-medium text-zinc-400" onClick={() => setInput("Show my accounts")}>View accounts</Badge>
                        <Badge variant="outline" className="px-4 py-2 rounded-full cursor-pointer hover:bg-[#121214] border-white/10 transition-colors text-xs font-medium text-zinc-400" onClick={() => setInput("What are my categories?")}>List categories</Badge>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar pb-32">
                        {messages.map((message, index) => (
                            <ChatMessage key={index} message={message} />
                        ))}

                        {isLoading && (
                            <div className="flex items-center gap-3 text-muted-foreground bg-zinc-100 dark:bg-[#121214] p-4 rounded-2xl w-fit border dark:border-white/5">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm font-medium">AI is thinking...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-12">
                        <div className="max-w-3xl mx-auto w-full relative shadow-2xl rounded-[24px]">
                            <form onSubmit={handleSubmit} className="relative w-full">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask AI Assistant..."
                                    disabled={isLoading}
                                    className="w-full h-16 pl-6 pr-16 rounded-[24px] bg-background dark:bg-[#121214] border dark:border-white/10 text-base focus-visible:ring-1 focus-visible:ring-white/20 transition-all dark:placeholder:text-zinc-500"
                                />
                                <Button 
                                    type="submit" 
                                    size="icon"
                                    disabled={isLoading || !input.trim()}
                                    className="absolute right-2 top-2 h-12 w-12 rounded-[18px] bg-[#222224] hover:bg-[#2A2A2D] text-white dark:border dark:border-white/5 transition-colors"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 text-zinc-300" />}
                                </Button>
                            </form>
                            <div className="mt-3 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                                AI responses are informational only.
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmationDialog
                open={showConfirmation}
                toolCall={pendingToolCall}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </div>
    );
}
