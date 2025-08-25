import { mna, nf } from "../_shared/http.ts";

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return mna();
  }

  try {
    console.log("Building miniapp...");
    
    // Build the miniapp using Vite
    const buildProcess = new Deno.Command("sh", {
      args: ["-c", "cd miniapp && npm run build"],
      stdout: "piped",
      stderr: "piped",
    });
    
    const buildOutput = await buildProcess.output();
    
    if (buildOutput.code !== 0) {
      const error = new TextDecoder().decode(buildOutput.stderr);
      console.error("Build failed:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Build failed: " + error 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log("Build successful, syncing files...");
    
    // Sync the built files to the static directory
    const syncProcess = new Deno.Command("node", {
      args: ["scripts/sync-miniapp-static.mjs"],
      stdout: "piped",
      stderr: "piped",
    });
    
    const syncOutput = await syncProcess.output();
    
    if (syncOutput.code !== 0) {
      const error = new TextDecoder().decode(syncOutput.stderr);
      console.error("Sync failed:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Sync failed: " + error 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const buildOutput = new TextDecoder().decode(buildOutput.stdout);
    const syncOutput = new TextDecoder().decode(syncOutput.stdout);
    
    console.log("Miniapp build and sync completed successfully");
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Miniapp built and synced successfully",
      buildOutput,
      syncOutput
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
    
  } catch (error) {
    console.error("Build process error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Handle CORS preflight requests
if (import.meta.main) {
  Deno.serve((req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }
    return handler(req);
  });
}

export default handler;