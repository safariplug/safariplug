This is a [Next.js](https://nextjs.org) project for SafariPlug.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Production

SafariPlug production is hosted on Hostinger and deployed from the `main` branch through the Hostinger GitHub integration.

The application uses Next.js with Node.js, Supabase, OpenAI, Stripe, and SafariPlug's external partner integrations.

## AI Scout

The AI Scout scheduled endpoint is available at `/api/cron/ai-scout`. Hostinger can invoke this endpoint from its hPanel Cron Jobs scheduler using the production `CRON_SECRET` as a Bearer authorization token.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js Learn](https://nextjs.org/learn)
