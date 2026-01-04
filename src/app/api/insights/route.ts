import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { financeAccount, transaction, category } from "@/db/schema";
import { eq, sql, desc, and, gte, lte, or } from "drizzle-orm";
import { startOfMonth, endOfMonth, parseISO, startOfYear, endOfYear } from "date-fns";

export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");

    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;

    try {
        // 1. Get Accounts
        let accountWhereClause;
        if (activeOrgId) {
            accountWhereClause = eq(financeAccount.organizationId, activeOrgId);
        } else {
            accountWhereClause = eq(financeAccount.userId, userId);
        }

        const accounts = await db.select({ id: financeAccount.id }).from(financeAccount).where(accountWhereClause);
        if (accounts.length === 0) {
            return NextResponse.json({
                expenseByCategory: [],
                incomeBySource: [],
                history: []
            });
        }
        const accountIds = accounts.map(a => a.id);

        const date = monthParam ? parseISO(`${monthParam}-01`) : new Date();
        const startDate = startOfMonth(date);
        const endDate = endOfMonth(date);

        // 2. Expense by Category (For selected month)
        const expenseByCategory = await db
            .select({
                categoryName: category.name,
                categoryColor: category.color,
                total: sql<number>`sum(${transaction.amount})`
            })
            .from(transaction)
            .leftJoin(category, eq(transaction.categoryId, category.id))
            .where(
                and(
                    gte(transaction.date, startDate),
                    lte(transaction.date, endDate),
                    eq(transaction.type, "EXPENSE"),
                    sql`${transaction.accountId} IN ${accountIds}`
                )
            )
            .groupBy(category.name, category.color, category.id)
            .orderBy(desc(sql`sum(${transaction.amount})`));

        // 3. Income by Source/Category (For selected month)
        const incomeByCategory = await db
            .select({
                categoryName: category.name,
                categoryColor: category.color,
                total: sql<number>`sum(${transaction.amount})`
            })
            .from(transaction)
            .leftJoin(category, eq(transaction.categoryId, category.id))
            .where(
                and(
                    gte(transaction.date, startDate),
                    lte(transaction.date, endDate),
                    eq(transaction.type, "INCOME"),
                    sql`${transaction.accountId} IN ${accountIds}`
                )
            )
            .groupBy(category.name, category.color, category.id)
            .orderBy(desc(sql`sum(${transaction.amount})`));

        // 4. History (Income vs Expense for the full year Jan-Dec)
        const yearStart = startOfYear(date);
        const yearEnd = endOfYear(date);

        const historyData = await db
            .select({
                month: sql<string>`to_char(${transaction.date}, 'YYYY-MM-01')`,
                type: transaction.type,
                total: sql<number>`sum(${transaction.amount})`
            })
            .from(transaction)
            .where(
                and(
                    gte(transaction.date, yearStart),
                    lte(transaction.date, yearEnd),
                    or(
                        eq(transaction.type, "INCOME"),
                        eq(transaction.type, "EXPENSE")
                    ),
                    sql`${transaction.accountId} IN ${accountIds}`
                )
            )
            .groupBy(sql`to_char(${transaction.date}, 'YYYY-MM-01')`, transaction.type)
            .orderBy(sql`to_char(${transaction.date}, 'YYYY-MM-01')`);

        // Process history data into friendly format
        const historyMap: Record<string, { income: number; expense: number }> = {};

        // Initialize for all 12 months of the year
        // Manually construct strings to avoid timezone shifts from toISOString()
        const selectedYear = date.getFullYear();
        for (let i = 0; i < 12; i++) {
            const monthStr = String(i + 1).padStart(2, '0');
            const k = `${selectedYear}-${monthStr}`; // YYYY-MM
            historyMap[k] = { income: 0, expense: 0 };
        }

        historyData.forEach((row: any) => {
            // row.month is 'YYYY-MM-01' from postgres to_char
            const m = row.month.substring(0, 7); // 'YYYY-MM'
            if (historyMap[m]) {
                if (row.type === 'INCOME') historyMap[m].income = Number(row.total);
                if (row.type === 'EXPENSE') historyMap[m].expense = Number(row.total);
            }
        });

        const history = Object.entries(historyMap).map(([month, data]) => ({
            month,
            ...data
        })).sort((a, b) => a.month.localeCompare(b.month));

        return NextResponse.json({
            expenseByCategory: expenseByCategory.map(e => ({ name: e.categoryName || 'Uncategorized', value: Number(e.total), fill: e.categoryColor || '#8884d8' })),
            incomeByCategory: incomeByCategory.map(e => ({ name: e.categoryName || 'Uncategorized', value: Number(e.total), fill: e.categoryColor || '#82ca9d' })),
            history
        });

    } catch (error: any) {
        console.error("Insights API Error:", error);
        return NextResponse.json({ error: "Failed to fetch insights data" }, { status: 500 });
    }
}
