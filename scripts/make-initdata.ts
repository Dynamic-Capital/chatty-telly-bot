const user = { id: 225513686, username: "prod_audit", first_name: "Audit" };
function toHex(buf){ return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
async function keyFromToken(t){
  const enc = new TextEncoder();
  const h = await crypto.subtle.digest("SHA-256", enc.encode(t));
  return crypto.subtle.importKey("raw", h, { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
}
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
const params = new URLSearchParams({
  user: encodeURIComponent(JSON.stringify(user)),
  auth_date: String(Math.floor(Date.now()/1000)),
  query_id: "AUDIT"
});
const dcs = Array.from(params.entries()).map(([k,v])=>`${k}=${v}`).sort().join("\n");
const sig = await crypto.subtle.sign("HMAC", await keyFromToken(token), new TextEncoder().encode(dcs));
params.set("hash", toHex(sig));
console.log(params.toString());
