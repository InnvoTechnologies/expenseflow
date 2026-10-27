# Self-host ExpenseFlow with Docker Compose

The repository includes a production Docker image, PostgreSQL, and a one-shot migration service. Docker Compose starts the web app only after PostgreSQL is healthy and migrations finish successfully.

## Quick start

Install Docker Engine or Docker Desktop with Compose v2, then clone the repository:

```sh
git clone https://github.com/InnvoTechnologies/expenseflow.git
cd expenseflow
cp .env.docker.example .env.docker
```

Edit `.env.docker` and set **POSTGRES_PASSWORD** and **BETTER_AUTH_SECRET**. Generate a different value for each:

```sh
openssl rand -hex 32
```

Use a hex database password so it is also safe in the database connection URL. Keep `.env.docker` private; it is ignored by Git and excluded from Docker builds.

Start the stack:

```sh
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps -a
```

Open [http://localhost:3000](http://localhost:3000). The initial build needs internet access to download dependencies, images, and the application's Google Fonts.

By default only the app's port is published, on loopback. PostgreSQL stays on the private Docker network. Its data lives in the `postgres_data` named volume and survives container replacement and `docker compose down`.

The Docker setup reads its explicitly listed settings from `.env.docker`; it does not copy your development `.env` or use its DATABASE_URL. The internal database URL points to the Compose `db` service.

## Configure sign-up, AI and Google sign-in

- **Email:** set RESEND_API_KEY and RESEND_FROM to a verified sender before relying on signup verification or password resets. Email verification is required by the application. With no Resend key, the existing mailer logs simulated messages; it does not deliver mail.
- **Turnstile:** the example uses Cloudflare's documented local test sitekey/secret pair. These are for localhost testing only. Replace both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY with your own matching keys for a public deployment.
- **AI copilot:** optionally set OPENROUTER_API_KEY. OPENROUTER_MODEL defaults to `openai/gpt-6-luna`. The finance app can start without the key; the copilot returns a configuration error until it is supplied.
- **Google:** optionally set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Register `APP_URL/api/auth/callback/google` as the callback URL in Google, replacing APP_URL with your actual origin.
- **Analytics:** PostHog and Sentry client configuration is optional and left empty in the Docker example.

Server secrets are injected at runtime, not passed as Docker build arguments.

## Public deployment and custom ports

Set APP_URL to the exact browser-facing origin, including scheme and a non-default port if present. For a public deployment use HTTPS and a reverse proxy in front of the app. The configured auth cookies are secure in production.

For example, with a local reverse proxy terminating HTTPS:

```dotenv
APP_URL=https://expenses.example.com
APP_BIND_ADDRESS=127.0.0.1
APP_PORT=3000
```

Proxy that origin to `http://127.0.0.1:3000`. Disable response buffering for copilot streaming and allow a response timeout longer than the three-minute provider timeout. The app listens on 0.0.0.0 inside its container; APP_BIND_ADDRESS controls exposure on the host. Set it to 0.0.0.0 only when direct network access is intended.

For another local port, change both settings before building:

```dotenv
APP_URL=http://localhost:8080
APP_PORT=8080
```

Next.js embeds NEXT_PUBLIC_* configuration in its client bundle. Changing APP_URL, the Turnstile sitekey, app name, or client telemetry settings requires rebuilding the app image:

```sh
docker compose --env-file .env.docker up --build -d
```

Do not change POSTGRES_PASSWORD on an initialized volume expecting it to change the existing database role's password: PostgreSQL initialization settings apply only when the volume is empty. Rotate the database role password deliberately and then update the environment to match.

## Logs and health

```sh
docker compose --env-file .env.docker logs --tail=100 migrate app
docker compose --env-file .env.docker ps -a
```

The expected state is `db` healthy, `migrate` exited with code 0, and `app` healthy. The app healthcheck calls the public session endpoint; an unauthenticated session is valid and needs no external service credentials.

If migration fails, the app is deliberately not started. Read the migration logs and correct the cause, then rerun `up`. The migration service applies the complete versioned migration history. Database constraints reject inconsistent existing data; the runner does not guess how to repair it.

For an existing database whose historical migration journal differs from its actual schema, reconcile that history separately before migration. The Docker quick start is intended for the fresh database it provisions; do not mount an unrelated production volume without checking its schema and backup first.

## Updates and backups

Back up before an update:

```sh
docker compose --env-file .env.docker exec -T db \
  pg_dump -U expenseflow -d expenseflow > expenseflow-backup.sql
```

Then update the checkout and rebuild while the app is stopped:

```sh
git pull
docker compose --env-file .env.docker stop app
docker compose --env-file .env.docker up --build -d
```

Migrations run before the app restarts and are safe to rerun when already applied. A Docker named volume provides persistence, not an off-host backup; keep copies of database dumps elsewhere.

To stop the stack while retaining data:

```sh
docker compose --env-file .env.docker down
```

Adding `--volumes` removes the database volume and its contents. Do that only when intentionally discarding the installation's data.

## Image layout

The `dependencies` stage installs the frozen Bun lockfile on Node.js 22. The `migrator` target contains the migration runner and SQL files. The `runner` target contains Next.js standalone output, public assets, and compiled static assets, and runs as an unprivileged user. The production app container does not need Bun or the migration toolchain.

Reference: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/), [Cloudflare test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
