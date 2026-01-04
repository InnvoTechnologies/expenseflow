import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { financeAccount, category, transaction } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";
import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Tool schemas
const createTransactionSchema = z.object({
    amount: z.number().positive(),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    description: z.string().optional(),
    accountId: z.string().uuid(),
    toAccountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    date: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;

    try {
        const body = await req.json();
        const { messages, toolCallId, toolResult } = body;

        // If this is a tool result confirmation
        if (toolCallId && toolResult) {
            // Execute the confirmed tool
            if (toolResult.toolName === "create_transaction") {
                const params = toolResult.params;

                // Validate the transaction data
                const validatedData = createTransactionSchema.parse(params);

                // Create the transaction using existing logic
                const result = await db.transaction(async (tx) => {
                    const [sourceAccount] = await tx
                        .select()
                        .from(financeAccount)
                        .where(eq(financeAccount.id, validatedData.accountId))
                        .limit(1);

                    if (!sourceAccount) {
                        throw new Error("Source account not found");
                    }

                    const isSourceOwner =
                        (sourceAccount.organizationId && sourceAccount.organizationId === activeOrgId) ||
                        (sourceAccount.userId && sourceAccount.userId === userId);

                    if (!isSourceOwner) {
                        throw new Error("Forbidden access to source account");
                    }

                    const currentBalance = parseFloat(sourceAccount.currentBalance);
                    const amount = validatedData.amount;

                    // Handle balance updates based on transaction type
                    if (validatedData.type === "EXPENSE" || validatedData.type === "TRANSFER") {
                        if (currentBalance < amount) {
                            throw new Error("Insufficient balance");
                        }

                        await tx
                            .update(financeAccount)
                            .set({
                                currentBalance: (currentBalance - amount).toString(),
                                updatedAt: new Date(),
                            })
                            .where(eq(financeAccount.id, validatedData.accountId));
                    } else if (validatedData.type === "INCOME") {
                        await tx
                            .update(financeAccount)
                            .set({
                                currentBalance: (currentBalance + amount).toString(),
                                updatedAt: new Date(),
                            })
                            .where(eq(financeAccount.id, validatedData.accountId));
                    }

                    // Handle transfer destination
                    if (validatedData.type === "TRANSFER" && validatedData.toAccountId) {
                        const [destAccount] = await tx
                            .select()
                            .from(financeAccount)
                            .where(eq(financeAccount.id, validatedData.toAccountId))
                            .limit(1);

                        if (!destAccount) {
                            throw new Error("Destination account not found");
                        }

                        const destBalance = parseFloat(destAccount.currentBalance);
                        await tx
                            .update(financeAccount)
                            .set({
                                currentBalance: (destBalance + amount).toString(),
                                updatedAt: new Date(),
                            })
                            .where(eq(financeAccount.id, validatedData.toAccountId));
                    }

                    // Create transaction record
                    const [newTransaction] = await tx
                        .insert(transaction)
                        .values({
                            amount: amount.toString(),
                            type: validatedData.type as any,
                            date: validatedData.date ? new Date(validatedData.date) : new Date(),
                            description: validatedData.description,
                            accountId: validatedData.accountId,
                            toAccountId: validatedData.toAccountId || null,
                            categoryId: validatedData.categoryId || null,
                            status: "completed",
                        })
                        .returning();

                    return newTransaction;
                });

                return new Response(
                    JSON.stringify({
                        success: true,
                        message: `Transaction created successfully! ${validatedData.type} of $${validatedData.amount}`,
                        transaction: result,
                    }),
                    {
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }
        }

        // Regular chat completion with tools
        const tools = [
            {
                type: "function" as const,
                function: {
                    name: "create_transaction",
                    description:
                        "Creates a new financial transaction (income, expense, or transfer). This requires user confirmation before execution.",
                    parameters: {
                        type: "object",
                        properties: {
                            amount: {
                                type: "number",
                                description: "The transaction amount (positive number)",
                            },
                            type: {
                                type: "string",
                                enum: ["INCOME", "EXPENSE", "TRANSFER"],
                                description: "Type of transaction",
                            },
                            description: {
                                type: "string",
                                description: "Description of the transaction",
                            },
                            accountId: {
                                type: "string",
                                description: "UUID of the source account",
                            },
                            toAccountId: {
                                type: "string",
                                description: "UUID of the destination account (required for TRANSFER)",
                            },
                            categoryId: {
                                type: "string",
                                description: "UUID of the category",
                            },
                            date: {
                                type: "string",
                                description: "Transaction date in ISO format (optional, defaults to now)",
                            },
                        },
                        required: ["amount", "type", "accountId"],
                    },
                },
            },
            {
                type: "function" as const,
                function: {
                    name: "get_accounts",
                    description: "Retrieves all finance accounts available to the user",
                    parameters: {
                        type: "object",
                        properties: {},
                    },
                },
            },
            {
                type: "function" as const,
                function: {
                    name: "get_categories",
                    description: "Retrieves all categories available to the user",
                    parameters: {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["INCOME", "EXPENSE"],
                                description: "Filter by category type (optional)",
                            },
                        },
                    },
                },
            },
        ];

        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful financial assistant that helps users manage their expenses and income. 
You can create transactions, view accounts, and view categories.

IMPORTANT: When creating transactions, you MUST ask for user confirmation by calling the create_transaction tool. 
The user will see a JSON schema of the transaction and can approve or reject it.

When users mention account names, you should first call get_accounts to find the correct account ID.
When users mention categories, you should first call get_categories to find the correct category ID.

Be conversational and helpful. Always confirm the details before creating transactions.`,
                },
                ...messages,
            ],
            tools,
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 1024,
        });

        const responseMessage = completion.choices[0].message;

        // Check if there are tool calls
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            const toolCall = responseMessage.tool_calls[0];
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            // Handle get_accounts
            if (toolName === "get_accounts") {
                let accountWhereClause;
                if (activeOrgId) {
                    accountWhereClause = eq(financeAccount.organizationId, activeOrgId);
                } else {
                    accountWhereClause = eq(financeAccount.userId, userId);
                }

                const accounts = await db
                    .select({
                        id: financeAccount.id,
                        name: financeAccount.name,
                        type: financeAccount.type,
                        currentBalance: financeAccount.currentBalance,
                        currency: financeAccount.currency,
                    })
                    .from(financeAccount)
                    .where(accountWhereClause);

                return new Response(
                    JSON.stringify({
                        toolCall: {
                            id: toolCall.id,
                            name: toolName,
                            result: accounts,
                        },
                        requiresConfirmation: false,
                    }),
                    {
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            // Handle get_categories
            if (toolName === "get_categories") {
                let categoryWhereClause;
                const conditions = [];

                if (activeOrgId) {
                    conditions.push(eq(category.organizationId, activeOrgId));
                } else {
                    conditions.push(eq(category.userId, userId));
                }

                if (toolArgs.type) {
                    conditions.push(eq(category.type, toolArgs.type));
                }

                const categories = await db
                    .select({
                        id: category.id,
                        name: category.name,
                        type: category.type,
                        color: category.color,
                    })
                    .from(category)
                    .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

                return new Response(
                    JSON.stringify({
                        toolCall: {
                            id: toolCall.id,
                            name: toolName,
                            result: categories,
                        },
                        requiresConfirmation: false,
                    }),
                    {
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            // Handle create_transaction - requires confirmation
            if (toolName === "create_transaction") {
                return new Response(
                    JSON.stringify({
                        toolCall: {
                            id: toolCall.id,
                            name: toolName,
                            params: toolArgs,
                        },
                        requiresConfirmation: true,
                        message: "Please confirm the transaction details:",
                    }),
                    {
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }
        }

        // Regular text response
        return new Response(
            JSON.stringify({
                message: responseMessage.content,
                requiresConfirmation: false,
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error: any) {
        console.error("Chat API error:", error);
        return new Response(
            JSON.stringify({
                error: error.message || "An error occurred",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
