This is a [Next.js](https://nextjs.org) project for SafariPlug.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Production

SafariPlug production is hosted on Hostinger and deployed from the `main` branch through the Hostinger GitHub integration.

The application uses Next.js with Node.js, Supabase, OpenAI, Stripe, M-Pesa, and SafariPlug's external partner integrations.

## AI Scout

The AI Scout scheduled endpoint is available at `/api/cron/ai-scout`. Hostinger can invoke this endpoint from its hPanel Cron Jobs scheduler using the production `CRON_SECRET` as a Bearer authorization token.

## Production environment configuration

Keep secrets out of Git. Configure production values in Hostinger's Node.js Environment Variables settings.

Required core variables include the Supabase URL/key, `OPENAI_API_KEY`, and `CRON_SECRET`.

For M-Pesa customer payments, configure:

```text
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_BASE_URL=
MPESA_CALLBACK_URL=
```

For M-Pesa provider payouts, also configure:

```text
MPESA_B2C_INITIATOR_NAME=
MPESA_B2C_SECURITY_CREDENTIAL=
MPESA_B2C_QUEUE_TIMEOUT_URL=
MPESA_B2C_RESULT_URL=
```

`MPESA_BASE_URL` must be explicitly configured in production; the code only falls back to Safaricom's sandbox endpoint during non-production development. This prevents a production deployment from silently sending payment traffic to the sandbox.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js Learn](https://nextjs.org/learn)
