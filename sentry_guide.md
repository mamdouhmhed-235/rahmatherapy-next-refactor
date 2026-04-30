# Sentry Setup Guide for Next.js

This guide provides precise steps to initialize Sentry for error tracking and performance monitoring in the Next.js application.

## 1. Create Sentry Project
1. Sign up / Log in to [Sentry.io](https://sentry.io/).
2. Click **Create Project**.
3. Choose **Next.js** as your platform.
4. Name the project (e.g., `rahmatherapy`).

## 2. Install Sentry Wizard
Run the official Sentry wizard at the root of the project. It automatically configures the necessary files (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and updates `next.config.ts`).

```bash
npx @sentry/wizard@latest -i nextjs
```

During the wizard:
- Select your Sentry SaaS account.
- Select your project.
- Let it create or update the configuration files.

## 3. Environment Variables
Ensure the generated `SENTRY_AUTH_TOKEN` is added to your `.env.local` (and your production environment variables in Cloudflare/Vercel) to upload sourcemaps during build.

```env
SENTRY_AUTH_TOKEN=your_token_here
NEXT_PUBLIC_SENTRY_DSN=your_dsn_here
```

## 4. Test the Integration
Create a test route or button to trigger an error:

```tsx
<button
  onClick={() => {
    throw new Error("Sentry Test Error");
  }}
>
  Break the world
</button>
```

Navigate to your Sentry dashboard and verify that the error was captured successfully.

## 5. Enable User Feedback (Optional but Recommended)
To enable the feedback loop widget, ensure the `Sentry.feedbackIntegration()` is included in your `sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.feedbackIntegration({
      // Additional configuration options
      colorScheme: "system",
    }),
  ],
});
```
