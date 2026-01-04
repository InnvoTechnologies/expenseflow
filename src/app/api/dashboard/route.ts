import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { financeAccount, transaction, category, payee } from "@/db/schema";
import { eq, sql, desc, and, gte, lte, or } from "drizzle-orm";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // Format: YYYY-MM

    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;

    try {
        // 1. Get User/Org Accounts
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
                currentBalance: financeAccount.currentBalance,
                type: financeAccount.type
            })
            .from(financeAccount)
            .where(accountWhereClause);

        if (accounts.length === 0) {
            return NextResponse.json({
                totalBalance: 0,
                income: 0,
                expense: 0,
                recentTransactions: [],
                accounts: []
            });
        }

        const accountIds = accounts.map(a => a.id);

        // Calculate Total Balance
        const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.currentBalance), 0);

        // 2. Date Range for Month Stats
        const date = monthParam ? parseISO(`${monthParam}-01`) : new Date();
        const startDate = startOfMonth(date);
        const endDate = endOfMonth(date);

        // 3. Fetch Monthly Income & Expense
        // We need to query transactions within date range for our accounts
        // Income: type = INCOME, accountId IN accountIds
        // Expense: type = EXPENSE, accountId IN accountIds

        // Using aggregation query
        const monthlyStats = await db
            .select({
                type: transaction.type,
                total: sql<number>`sum(${transaction.amount})`
            })
            .from(transaction)
            .where(
                and(
                    gte(transaction.date, startDate),
                    lte(transaction.date, endDate),
                    or(
                        sql`${transaction.accountId} IN ${accountIds}`,
                        // Note: For Income, it goes to accountId. 
                        // For Expense, it comes from accountId.
                        // For Transfer, we might exclusion or specific logic. 
                        // Usually Dashboard Income/Expense excludes internal transfers.
                    ),
                    // Exclude transfers for pure Income/Expense stats usually, 
                    // or user preference. Let's exclude TRANSFER type for summary.
                    sql`${transaction.type} != 'TRANSFER'`
                )
            )
            .groupBy(transaction.type);

        let monthlyIncome = 0;
        let monthlyExpense = 0;

        monthlyStats.forEach(stat => {
            if (stat.type === 'INCOME') monthlyIncome = Number(stat.total || 0);
            if (stat.type === 'EXPENSE') monthlyExpense = Number(stat.total || 0);
        });

        // 4. recent Transactions (Limit 5)
        // We reuse the logic from transactions API but limit 5
        const recentTxRows = await db
            .select({
                id: transaction.id,
                amount: transaction.amount,
                type: transaction.type,
                date: transaction.date,
                description: transaction.description,
                status: transaction.status,
                categoryName: category.name,
                accountName: financeAccount.name,
            })
            .from(transaction)
            .leftJoin(category, eq(transaction.categoryId, category.id))
            .innerJoin(financeAccount, eq(transaction.accountId, financeAccount.id))
            .where(
                or(
                    sql`${transaction.accountId} IN ${accountIds}`,
                    sql`${transaction.toAccountId} IN ${accountIds}`
                )
            )
            .orderBy(desc(transaction.date), desc(transaction.createdAt))
            .limit(5);

        const recentTransactions = recentTxRows.map(r => ({
            id: r.id,
            amount: r.amount,
            type: r.type,
            date: r.date,
            description: r.description,
            status: r.status,
            category: r.categoryName ? { name: r.categoryName } : null,
            account: { name: r.accountName }
        }));

        // 5. Top Payees (Limit 5)
        const topPayees = await db
            .select({
                name: payee.name,
                total: sql<number>`sum(${transaction.amount})`
            })
            .from(transaction)
            .innerJoin(payee, eq(transaction.payeeId, payee.id))
            .where(
                and(
                    gte(transaction.date, startDate),
                    lte(transaction.date, endDate),
                    sql`${transaction.accountId} IN ${accountIds}`,
                    eq(transaction.type, 'EXPENSE')
                )
            )
            .groupBy(payee.name)
            .orderBy(desc(sql`sum(${transaction.amount})`))
            .limit(5);

        return NextResponse.json({
            totalBalance,
            monthlyIncome,
            monthlyExpense,
            recentTransactions,
            accounts: accounts.slice(0, 5), // Return first 5 accounts for overview
            topPayees: topPayees.map(p => ({
                name: p.name,
                amount: Number(p.total)
            }))
        });

    } catch (error: any) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }
}
