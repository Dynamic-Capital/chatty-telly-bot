import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";

const { OPENAI_API_KEY } = requireEnv(["OPENAI_API_KEY"] as const);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, context: _context, test } = await req
      .json()
      .catch(() => ({}));

    if (test) {
      return new Response(
        JSON.stringify({ success: true, message: "ai-faq-assistant OK" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      `You are a knowledgeable trading assistant for Dynamic Capital, a premium trading signals and education service. 

IMPORTANT GUIDELINES:
- Provide helpful, educational trading information
- Be professional but friendly
- Keep responses concise but informative (max 300 words)
- Include relevant emojis for better engagement
- Focus on education, not financial advice
- Mention Dynamic Capital's services when relevant
- Always include a disclaimer about risk

DYNAMIC CAPITAL SERVICES:
- Premium trading signals for XAUUSD, EURUSD, GBPUSD
- VIP community access with live analysis
- Educational resources and mentorship
- Bank transfer and crypto payment options
- 24/7 support via @DynamicCapital_Support

COMMON TOPICS:
- Trading basics and terminology
- Risk management principles
- Technical analysis concepts
- Market fundamentals
- Account setup and verification
- Payment methods and subscription plans
- Platform usage and features

Always end responses with: "💡 Need more help? Contact @DynamicCapital_Support or check our VIP plans!"`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "AI service error");
    }

    const answer = data.choices[0].message.content;

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-faq-assistant function:", error);
    let details = "Unknown error";
    if (error instanceof Error) {
      details = error.message;
    }
    return new Response(
      JSON.stringify({
        error: "Failed to get AI response",
        details,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
