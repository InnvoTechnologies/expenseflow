![logo](https://www.expenseflow.co/banner.png)

A modern, full-stack finance application built with Next.js 15, specialized in multi-currency tracking, AI-powered insights, and automated transaction categorization.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38bdf8)

## 🚀 Features

### Core Financial Management
- **Multi-Currency Support**: Track accounts and transactions in any currency (USD, AUD, EUR, etc.) with automatic base currency conversion.
- **Account Types**: Manage Bank Accounts, Cash, Mobile Wallets, Credit Cards, Savings, and Investments.
- **Transaction Handling**: Record Income, Expenses, and Transfers between accounts.
- **Category Management**: Hierarchical categories with custom icons and types.
- **Payee Management**: Track who you pay or receive money from.

### 🤖 AI-Powered Assistance
- **Smart Categorization**: Automatically suggests categories for new transactions based on description and history.
- **Natural Language Input**: "Lunch 12.85 AUD at KFC" automatically parses into a structured transaction.
- **Financial Insights**: AI analysis of spending patterns, anomalies, and monthly summaries.
- **Chat Assistant**: Integrated AI chat to query your financial data and ask questions about your spending.

### 📊 Dashboard & Analytics
- **Real-time Dashboard**: Overview of net worth, recent activity, and spending trends.
- **Visual Reports**: Charts and graphs for income vs expenses, category breakdowns, and more.
- **Savings Goals**: Track progress towards financial targets.
- **Subscription Tracker**: Manage recurring payments and billing cycles.

### 🔐 Security & Auth
- **Secure Authentication**: Powered by Better-Auth with Google OAuth support.
- **Cloudflare Turnstile**: Bot protection on sign-in and registration forms.
- **Data Privacy**: Granular control over user data with export and wipe options.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Authentication**: [Better-Auth](https://better-auth.com/)
- **Forms**: React Hook Form + Zod
- **State Management**: TanStack Query
- **Charts**: Recharts

## ⚡ Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Yarn or NPM

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/InnvoTechnologies/expenseflow.git
   cd expenseflow
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   Copy the `.env.example` file to `.env` and fill in the values
   
4. **Run Database Migrations**
   ```bash
   yarn drizzle-kit migrate
   ```

5. **Start Development Server**
   ```bash
   yarn dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📂 Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # Reusable UI components (Shadcn + Custom)
├── db/               # Drizzle schema and database connection
├── hooks/            # Custom React hooks
├── lib/              # Utility functions, auth client, and API helpers
└── server/           # Server-side logic and actions
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Star History

<a href="https://www.star-history.com/#InnvoTechnologies/expenseflow&type=timeline&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=InnvoTechnologies/expenseflow&type=timeline&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=InnvoTechnologies/expenseflow&type=timeline&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=InnvoTechnologies/expenseflow&type=timeline&legend=top-left" />
 </picture>
</a>

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
