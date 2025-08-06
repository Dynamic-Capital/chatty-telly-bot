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

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

    const { action, messageData, targetUsers } = await req.json();

    if (action === 'send_broadcast') {
      // Handle broadcast with media
      const results = [];
      
      for (const userId of targetUsers) {
        try {
          let response;
          
          if (messageData.mediaUrl && messageData.mediaType) {
            // Send media message
            const endpoint = messageData.mediaType === 'photo' ? 'sendPhoto' : 'sendVideo';
            const mediaField = messageData.mediaType === 'photo' ? 'photo' : 'video';
            
            response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: userId,
                [mediaField]: messageData.mediaUrl,
                caption: messageData.content,
                parse_mode: 'Markdown'
              })
            });
          } else {
            // Send text message
            response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: userId,
                text: messageData.content,
                parse_mode: 'Markdown'
              })
            });
          }

          if (response.ok) {
            results.push({ userId, status: 'success' });
          } else {
            results.push({ userId, status: 'failed', error: await response.text() });
          }
        } catch (error) {
          results.push({ userId, status: 'error', error: error.message });
        }
      }

      // Update broadcast message status
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status !== 'success').length;

      await supabaseAdmin
        .from('broadcast_messages')
        .update({
          delivery_status: 'sent',
          successful_deliveries: successCount,
          failed_deliveries: failedCount,
          sent_at: new Date().toISOString()
        })
        .eq('id', messageData.messageId);

      return new Response(JSON.stringify({
        success: true,
        results,
        summary: { successful: successCount, failed: failedCount }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'upload_media') {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const messageId = formData.get('messageId') as string;
      
      if (!file) {
        throw new Error('No file provided');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `broadcast_${messageId}_${timestamp}.${fileExt}`;
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('broadcast-media')
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600'
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('broadcast-media')
        .getPublicUrl(fileName);

      // Update broadcast message with media info
      const mediaType = file.type.startsWith('image/') ? 'photo' : 'video';
      
      await supabaseAdmin
        .from('broadcast_messages')
        .update({
          media_type: mediaType,
          media_url: publicUrl,
          media_file_path: fileName,
          media_caption: formData.get('caption') as string || null
        })
        .eq('id', messageId);

      return new Response(JSON.stringify({
        success: true,
        mediaUrl: publicUrl,
        mediaType,
        fileName
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Broadcast error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});