-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup job to run daily at 2:00 AM
SELECT cron.schedule(
  'cleanup-old-receipts-daily',
  '0 2 * * *', -- Daily at 2:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://qeejuomcapbdlhnjqjcc.supabase.co/functions/v1/cleanup-old-receipts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZWp1b21jYXBiZGxobmpxamNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMDE4MTUsImV4cCI6MjA2OTc3NzgxNX0.GfK9Wwx0WX_GhDIz1sIQzNstyAQIF2Jd6p7t02G44zk"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);