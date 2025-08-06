import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🧹 Starting storage cleanup process...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get cleanup days from query params (default 14 days)
    const url = new URL(req.url);
    const cleanupDays = parseInt(url.searchParams.get("days") || "14");
    const dryRun = url.searchParams.get("dry_run") === "true";

    console.log(`🕐 Cleaning up files older than ${cleanupDays} days (dry run: ${dryRun})`);

    if (dryRun) {
      // Just report what would be deleted
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);

      const { data: files, error } = await supabaseAdmin
        .storage
        .from('broadcast-media')
        .list('', { limit: 1000 });

      if (error) {
        throw error;
      }

      const oldFiles = files?.filter(file => 
        new Date(file.created_at) < cutoffDate
      ) || [];

      const totalSize = oldFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);

      return new Response(JSON.stringify({
        dry_run: true,
        files_to_delete: oldFiles.length,
        total_size_mb: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        cutoff_date: cutoffDate.toISOString(),
        files: oldFiles.map(f => ({ name: f.name, size: f.metadata?.size, created_at: f.created_at }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Perform actual cleanup
    const { data: result, error } = await supabaseAdmin
      .rpc('cleanup_old_media_files', { cleanup_days: cleanupDays });

    if (error) {
      throw error;
    }

    console.log("✅ Storage cleanup completed:", result);

    // Also cleanup rate limiting store and cache if this is called from telegram bot
    if (req.headers.get("x-cleanup-memory") === "true") {
      console.log("🧹 Memory cleanup requested from bot");
      // This would be handled by the bot itself
    }

    return new Response(JSON.stringify({
      success: true,
      cleanup_result: result,
      message: `Cleaned up ${result.deleted_files} files, freed ${result.freed_mb} MB`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Storage cleanup error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});

console.log("🧹 Storage cleanup function ready");