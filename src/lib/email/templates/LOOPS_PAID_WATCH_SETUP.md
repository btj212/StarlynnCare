# Paid Facility Watch — Loops templates

## Variable syntax

Same variable rules as the legacy official-record watch welcome (see `LOOPS_WATCH_WELCOME_SETUP.md`):

- MJML Code tab: `{DATA_VARIABLE:name}`
- Subject / Plain: `{name}`
- Zip must contain `index.mjml` exactly

## Welcome email

1. Copy MJML into zip:

```bash
cd src/lib/email/templates
cp paid-watch-welcome.mjml index.mjml
zip -j paid-watch-welcome-loops.zip index.mjml
rm index.mjml
```

1. Loops → Transactional → Code tab → upload `paid-watch-welcome-loops.zip`
2. Subject: `You're watching {facilityName} · Facility Watch Premium`
3. Publish → set `LOOPS_PAID_WATCH_WELCOME_ID`

Data variables sent by `sendPaidWatchWelcome`:

`facilityName`, `facilityUrl`, `planLabel`, `manageUrl`, `supportEmail`, `siteUrl`

## Payment failed email

```bash
cd src/lib/email/templates
cp paid-watch-payment-failed.mjml index.mjml
zip -j paid-watch-payment-failed-loops.zip index.mjml
rm index.mjml
```

Subject: `Action needed: Facility Watch payment for {facilityName}`  
Env: `LOOPS_PAID_WATCH_PAYMENT_FAILED_ID`

Variables: `facilityName`, `manageUrl`, `supportEmail`