import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { retentionDays = 14 } = await req.json().catch(() => ({}));

    console.log(`🧹 Starting media cleanup with ${retentionDays} day retention`);

    // Get old broadcast messages with media
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data: oldMessages, error: queryError } = await supabaseAdmin
      .from('broadcast_messages')
      .select('id, media_file_path, created_at')
      .not('media_file_path', 'is', null)
      .lt('created_at', cutoffDate.toISOString());

    if (queryError) {
      throw queryError;
    }

    let deletedFiles = 0;
    let failedDeletions = 0;

    // Delete files from storage and update database
    for (const message of oldMessages || []) {
      try {
        // Delete from storage
        const { error: deleteError } = await supabaseAdmin.storage
          .from('broadcast-media')
          .remove([message.media_file_path]);

        if (deleteError) {
          console.error(`❌ Failed to delete ${message.media_file_path}:`, deleteError);
          failedDeletions++;
          continue;
        }

        // Update database record
        const { error: updateError } = await supabaseAdmin
          .from('broadcast_messages')
          .update({
            media_file_path: null,
            media_url: null,
            media_type: null
          })
          .eq('id', message.id);

        if (updateError) {
          console.error(`❌ Failed to update message ${message.id}:`, updateError);
          failedDeletions++;
        } else {
          deletedFiles++;
          console.log(`✅ Cleaned up media for message ${message.id}`);
        }

      } catch (error) {
        console.error(`🚨 Exception cleaning message ${message.id}:`, error);
        failedDeletions++;
      }
    }

    // Clean up orphaned media files (older than retention period)
    const { data: orphanedFiles, error: orphanError } = await supabaseAdmin
      .from('media_files')
      .select('id, file_path')
      .lt('created_at', cutoffDate.toISOString());

    let cleanedOrphaned = 0;
    
    if (!orphanError && orphanedFiles) {
      for (const file of orphanedFiles) {
        try {
          // Delete from storage if it exists
          await supabaseAdmin.storage
            .from('broadcast-media')
            .remove([file.file_path]);

          // Delete database record
          await supabaseAdmin
            .from('media_files')
            .delete()
            .eq('id', file.id);

          cleanedOrphaned++;
        } catch (error) {
          console.error(`🚨 Failed to clean orphaned file ${file.id}:`, error);
        }
      }
    }

    // Use database function for additional cleanup
    const { data: cleanupResult, error: cleanupError } = await supabaseAdmin
      .rpc('cleanup_old_media_files', { retention_days: retentionDays });

    const result = {
      success: true,
      retention_days: retentionDays,
      broadcast_media_deleted: deletedFiles,
      failed_deletions: failedDeletions,
      orphaned_files_cleaned: cleanedOrphaned,
      database_cleanup: cleanupResult,
      cleanup_date: new Date().toISOString()
    };

    console.log(`✅ Media cleanup completed:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🚨 Media cleanup error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      cleanup_date: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});