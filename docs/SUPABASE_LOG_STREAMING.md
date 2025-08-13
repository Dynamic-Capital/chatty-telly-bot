# Supabase Log Streaming

This project can forward Supabase logs to an external aggregator (Logtail, Grafana Loki, etc.).

## Create a log drain

1. Set the required environment variables:
   - `SUPABASE_PROJECT_ID`
   - `SUPABASE_ACCESS_TOKEN`
   - `LOGTAIL_SOURCE_TOKEN` (token from Logtail or compatible service)
   - optional `LOGTAIL_URL` if using a custom ingestion URL.
2. Run the helper script:
   ```bash
   deno run -A scripts/setup-log-drain.ts
   ```
   This registers a Supabase log drain that streams logs to the aggregator.

## Alerting

Configure alerting within your logging platform to notify on server errors or webhook failures.

### Logtail

Create an alert with a query such as:
```
status:[500 TO 599] OR message:"webhook failure"
```
Send notifications via email, Slack, etc.

### Grafana Loki

If using Grafana/Loki, create a rule:
```
{app="supabase"} |~ "(status=5..|webhook.*failed)"
```
Trigger an alert if the count of matching logs over 5 minutes is greater than zero.
