"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

interface ToolCall {
    id: string;
    name: string;
    params: any;
}

interface ConfirmationDialogProps {
    open: boolean;
    toolCall: ToolCall | null;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationDialog({
    open,
    toolCall,
    onConfirm,
    onCancel,
}: ConfirmationDialogProps) {
    if (!toolCall) return null;

    const formatValue = (key: string, value: any): string => {
        if (value === null || value === undefined) return "N/A";
        if (typeof value === "number") return `$${value.toFixed(2)}`;
        if (typeof value === "string" && key.toLowerCase().includes("date")) {
            try {
                return new Date(value).toLocaleDateString();
            } catch {
                return value;
            }
        }
        return String(value);
    };

    const getOperationTitle = () => {
        switch (toolCall.name) {
            case "create_transaction":
                return "Confirm Transaction";
            default:
                return "Confirm Action";
        }
    };

    const getOperationDescription = () => {
        switch (toolCall.name) {
            case "create_transaction":
                return "Please review the transaction details below and confirm to proceed.";
            default:
                return "Please review the action details below and confirm to proceed.";
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {getOperationTitle()}
                    </DialogTitle>
                    <DialogDescription>{getOperationDescription()}</DialogDescription>
                </DialogHeader>

                <Card className="bg-muted/50">
                    <CardContent className="p-4">
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                Operation Details
                            </div>

                            {Object.entries(toolCall.params).map(([key, value]) => (
                                <div key={key} className="flex justify-between items-start gap-4">
                                    <span className="text-sm font-medium text-muted-foreground capitalize">
                                        {key.replace(/([A-Z])/g, " $1").trim()}:
                                    </span>
                                    <span className="text-sm font-semibold text-right">
                                        {formatValue(key, value)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t">
                            <div className="text-xs text-muted-foreground">
                                <strong>JSON Schema:</strong>
                            </div>
                            <pre className="mt-2 p-3 bg-background rounded-md text-xs overflow-x-auto">
                                {JSON.stringify(toolCall.params, null, 2)}
                            </pre>
                        </div>
                    </CardContent>
                </Card>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="gap-2"
                    >
                        <XCircle className="w-4 h-4" />
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="gap-2"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
