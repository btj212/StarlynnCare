# Facility Watch Premium — Concierge runbook

Phase 1 fulfillment is manual. Automate only after roughly 5–10 paying subscribers.

## Operator env vars (do not commit)

Set in Vercel (preview + production) and locally for Stripe CLI testing:

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook` |
| `STRIPE_PRICE_FACILITY_WATCH_MONTHLY` | Price ID for $9/month |
| `STRIPE_PRICE_FACILITY_WATCH_ANNUAL` | Price ID for $59/year |
| `FACILITY_WATCH_PAID_ENABLED` | Set to `1` to show the paid CTA |
| `LOOPS_PAID_WATCH_WELCOME_ID` | Transactional template ID |
| `LOOPS_PAID_WATCH_PAYMENT_FAILED_ID` | Transactional template ID |

Also configure Stripe Customer Portal (cancel, update payment method, invoice history).

Webhook endpoint: `https://www.starlynncare.com/api/stripe/webhook`  
Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

## Launch verification log (flag still OFF)

Verified 2026-07-18 before public CTA exposure:

| Check | Result |
|-------|--------|
| Vercel Production: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, both Price IDs, both Loops paid-watch template IDs | Present |
| `FACILITY_WATCH_PAID_ENABLED` | **Absent** (CTA dark) |
| Stripe product/prices | `prod_UuZxvgErtoATyV`; monthly `price_1TuknDKVTDnJgH9ud2lFTODb` ($9); annual `price_1TuknDKVTDnJgH9u1ybQTWXf` ($59) |
| Customer Portal | Payment method update, cancel at period end, invoice history enabled |
| Migration `0063` | Applied; `facility_watch_subscriptions` + `billing_webhook_events`; anon insert blocked by RLS |
| Migration `0064` | Applied; `facility_watchers.alerts_eligible` default true; 8 existing rows eligible |
| Loops ZIPs | Each contains exactly `index.mjml` |
| Webhook events (code) | Handles the five events listed above |
| Production deploy (PR #60) | Merged; build READY on `www.starlynncare.com` |
| Flag-off QA | CA/TX profiles 200; no Premium CTA; free signup `/api/watch` → 410; unsigned webhook → 400 Missing signature |
| Flag-on redeploy | `FACILITY_WATCH_PAID_ENABLED=1` set; Premium module present on CA (`#facility-watch-premium`); absent on TX |

**Rollback:** remove `FACILITY_WATCH_PAID_ENABLED` (or set to `0`) and redeploy. Existing paid subscriptions remain manageable via billing portal links; new CTAs disappear.

## One-time launch setup

Migrations `0063` and `0064` were applied to production and verified (RLS, indexes,
`alerts_eligible`). Both migration files remain idempotent.

### 1. Stripe live products and prices

The live Stripe product and prices were created through the authenticated
Stripe MCP on July 18, 2026:

- Product: `prod_UuZxvgErtoATyV` (`Facility Watch Premium`)
- Monthly: `price_1TuknDKVTDnJgH9ud2lFTODb` ($9/month; default price)
- Annual: `price_1TuknDKVTDnJgH9u1ybQTWXf` ($59/year)

Both prices are active, USD, fixed-rate licensed subscriptions, and confirmed
`livemode: true`. Their live Price IDs are already set in Vercel Production.

Remaining Stripe Dashboard steps:

1. Settings → Billing → Customer portal:
   - Allow customers to update payment methods.
   - Allow customers to cancel subscriptions.
   - Show invoice history.
   - Save changes.
2. Settings → Billing → Revenue recovery:
   - Enable Smart Retries.
   - Enable Stripe failed-payment emails.
   - Keep automatic card updates enabled.
3. Developers → Webhooks → **Add endpoint**:
   - URL: `https://www.starlynncare.com/api/stripe/webhook`
   - Select: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.paid`, and `invoice.payment_failed`.
   - Copy the endpoint signing secret (`whsec_...`).
4. Developers → API keys:
   - Copy the live secret key (`sk_live_...`).
   - Never paste the secret into source code, documentation, or chat.

### 2. Loops templates

Upload the ready-made ZIPs from `src/lib/email/templates/`:

- `paid-watch-welcome-loops.zip`
- `paid-watch-payment-failed-loops.zip`

Each ZIP has been integrity-tested and contains exactly one file named
`index.mjml`, as Loops requires. Full subjects and variables are in
`src/lib/email/templates/LOOPS_PAID_WATCH_SETUP.md`.

### 3. Vercel production environment variables

The two live Price IDs are already configured in Vercel Production. Add the
remaining values directly; Vercel encrypts them:

```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add LOOPS_PAID_WATCH_WELCOME_ID production
vercel env add LOOPS_PAID_WATCH_PAYMENT_FAILED_ID production
```

Leave `FACILITY_WATCH_PAID_ENABLED` absent until the deployment and webhook are
ready. Add it with value `1` only as the final launch step:

```bash
vercel env add FACILITY_WATCH_PAID_ENABLED production
```

### 4. Controlled live verification

1. Deploy the feature branch after adding the four remaining env vars, but
   leave the paid flag absent.
2. Temporarily enable the paid flag only when ready to complete a controlled
   purchase with a real card. Stripe test cards do not work in live mode.
3. Open an eligible facility profile (not TX or MO).
4. Confirm exactly one Premium Facility Watch module is present (no free facility-watch strip or modal).
5. Complete the monthly checkout with a real card you control.
6. Confirm:
   - Success page says setup is in progress.
   - Stripe shows an active subscription and paid invoice.
   - `/admin/watchers` shows the paid row as `pending` fulfillment.
   - `/admin/submissions` shows a Facility Watch row with source
     `stripe_checkout_paid`.
   - Welcome email arrives.
7. Open the billing link from the welcome email and confirm Customer Portal works.
8. Cancel the subscription, then refund the charge in Stripe Dashboard.
9. Confirm the cancellation webhook updates the local subscription.
10. Only then leave `FACILITY_WATCH_PAID_ENABLED=1` enabled for visitors.

## When a new paid subscription arrives

1. Admin alert email + `/admin/submissions` Facility Watch row with source
   `stripe_checkout_paid`, plus the `/admin/watchers` paid table.
2. Confirm the welcome email went out (or send manually if Loops ID missing).
3. Create or reuse a Firecrawl **web-scale monitor** for that facility:
   - Schedule: every **6 hours**
   - Queries: two tight strings, e.g. `"Facility Name" City` and `"Facility Name" (lawsuit OR citation OR complaint OR inspection)`
   - Goal: material news, lawsuits, enforcement, closure, and public review/complaint mentions
   - `maxResults`: 10, judge enabled
   - Notifications: **admin email only** (not the subscriber)
4. Record the Firecrawl monitor ID on the subscription:

```sql
update facility_watch_subscriptions
set firecrawl_monitor_id = '<monitor_id>',
    fulfillment_status = 'active',
    fulfilled_at = now(),
    updated_at = now()
where id = '<subscription_uuid>';
```

5. SLA: never leave an active paid subscription unfulfilled past **one business day**.

## Forwarding alerts

When Firecrawl emails a high-confidence hit:

1. Open the source URL; confirm it is about this facility (not a namesake).
2. Forward a short note to the subscriber(s) on that facility with:
   - What happened (1–3 sentences)
   - Source link
   - Label: “Third-party report — not an official regulator finding”
3. Do **not** change grades, inspection history, or facility profile copy based on the hit.
4. Skip low-confidence / unrelated noise.

If multiple families watch the same facility, one shared monitor is enough — fan out the curated note to each active subscriber email.

## When the last subscription for a facility ends

1. Stripe webhook sets status to `canceled` and `fulfillment_status` to `paused`.
2. Pause or delete the Firecrawl monitor in the dashboard.
3. Clear or keep `firecrawl_monitor_id` for audit; do not leave monitors running with zero payers.

## Launch states

- **Premium replaces free per-facility signup.** New visitors cannot enroll in ongoing facility alerts via the old free strip/modal/sticky bar. Existing `facility_watchers` rows with `alerts_eligible=true` keep receiving official-record alerts.
- **Area Watch stays** as a weekly official-record area digest on city/state hubs (not a substitute for monitoring one facility).
- Paid CTA is hidden for **TX** and **MO** until weekly official-record scans meet the paid reliability standard. Those states get neither paid CTA nor a free facility-watch fallback.
- Public launch requires `FACILITY_WATCH_PAID_ENABLED=1` on Production. Remove or set to `0` to hide the CTA immediately (rollback).

## Upsell to existing legacy alert recipients

After the first successful end-to-end fulfillments, send a one-time Loops campaign manually to the legacy `facility_watch` audience:

> You already get official inspection-record changes for this facility. Facility Watch Premium adds curated web monitoring for news, lawsuits, and public complaint mentions — plus the same official alerts.

Link each recipient to their watched facility profile (paid CTA is the Premium module when the launch flag is on).
