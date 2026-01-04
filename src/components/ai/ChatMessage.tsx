"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface ChatMessageProps {
    message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";

    return (
        <div
            className={cn(
                "flex w-full gap-3 mb-4",
                isUser ? "justify-end" : "justify-start"
            )}
        >
            {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                </div>
            )}

            <Card
                className={cn(
                    "max-w-[80%]",
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                )}
            >
                <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </CardContent>
            </Card>

            {isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-foreground" />
                </div>
            )}
        </div>
    );
}
