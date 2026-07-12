# State Watch transactional email setup

Preferred setup:

```bash
python3 scripts/setup_loops_watch_templates.py --apply
```

This creates and publishes both LMX templates through the Loops Content API and
prints the two environment variable values.

The MJML archives remain available as a dashboard-upload fallback:

- `area-watch-change-loops.zip`
- `facility-watch-change-loops.zip`

Configure the printed IDs as:

- `LOOPS_AREA_WATCH_CHANGE_ID`
- `LOOPS_WATCH_CHANGE_ID`

Add the same values to Vercel and GitHub Actions secrets. The weekly state-source
workflow also requires `LOOPS_API_KEY`, `LOOPS_ADMIN_ALERT_ID`, and
`ADMIN_ALERT_EMAIL`.

Area template data variables:

- `areaName`
- `summary`
- `details`
- `areaUrl`
- `unsubscribeUrl`

Facility template data variables:

- `facilityName`
- `summary`
- `details`
- `facilityUrl`
- `unsubscribeUrl`

Subscriber delivery is gated on a fully completed state scan. Partial or failed
source runs create no subscriber message.
