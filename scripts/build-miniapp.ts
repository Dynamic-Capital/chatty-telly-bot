#!/usr/bin/env -S deno run -A

/**
 * Build script for the mini app
 * This builds the React app in supabase/functions/miniapp and copies it to supabase/functions/miniapp/static
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const MINI_APP_DIR = "supabase/functions/miniapp";
const OUTPUT_DIR = "supabase/functions/miniapp/static";

async function runCommand(cmd: string[], cwd?: string) {
  console.log(`Running: ${cmd.join(" ")} ${cwd ? `in ${cwd}` : ""}`);
  
  const process = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await process.output();
  
  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    console.error(`Command failed with code ${code}:`);
    console.error(errorText);
    throw new Error(`Command failed: ${cmd.join(" ")}`);
  }
  
  const output = new TextDecoder().decode(stdout);
  if (output.trim()) {
    console.log(output);
  }
}

async function buildMiniApp() {
  console.log("🚀 Building Dynamic Capital Mini App...");
  
  // Check if mini app directory exists
  try {
    await Deno.stat(MINI_APP_DIR);
  } catch {
    console.error(`Mini app directory not found: ${MINI_APP_DIR}`);
    Deno.exit(1);
  }
  
  // Install dependencies
  console.log("📦 Installing dependencies...");
  await runCommand(["npm", "install"], MINI_APP_DIR);
  
  // Build the app
  console.log("🔨 Building the mini app...");
  await runCommand(["npm", "run", "build"], MINI_APP_DIR);
  
  // Verify build output
  try {
    const stat = await Deno.stat(OUTPUT_DIR);
    if (stat.isDirectory) {
      console.log("✅ Mini app built successfully!");
      
      // List files in output directory
      const files = [];
      for await (const entry of Deno.readDir(OUTPUT_DIR)) {
        files.push(entry.name);
      }
      console.log(`📁 Output files: ${files.join(", ")}`);
    }
  } catch {
    console.error(`❌ Build output not found at: ${OUTPUT_DIR}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await buildMiniApp();
}