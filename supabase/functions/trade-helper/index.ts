import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instrument, command, context } = await req.json();

    if (!instrument) {
      return new Response(JSON.stringify({ error: 'Instrument is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a professional trading analyst providing educational market analysis for Dynamic Capital.

CRITICAL DISCLAIMERS:
- This is EDUCATIONAL content only, NOT financial advice
- Trading involves significant risk of loss
- Past performance doesn't guarantee future results
- Users should do their own research and risk management

ANALYSIS FRAMEWORK:
- Provide technical analysis insights
- Discuss market fundamentals when relevant
- Include both bullish and bearish scenarios
- Mention key support/resistance levels if applicable
- Discuss risk factors and considerations
- Keep educational and objective

INSTRUMENTS WE COVER:
- XAUUSD (Gold)
- EURUSD, GBPUSD, USDJPY (Major Forex)
- Oil, Silver, major indices
- Cryptocurrencies (Bitcoin, Ethereum)

FORMAT REQUIREMENTS:
- Start with current market context
- Provide educational technical view
- Include risk considerations
- End with educational summary
- Use trading emojis appropriately
- Keep under 400 words

Always include: "⚠️ This is educational analysis only. Always use proper risk management and consider your financial situation before trading."`;

    const userPrompt = `Provide an educational trading analysis for ${instrument.toUpperCase()}. 
    
Command context: ${command}
    
Please analyze:
1. Current market sentiment and context
2. Key technical levels to watch
3. Potential scenarios (both bullish and bearish)
4. Important risk factors
5. Educational trading considerations

Remember to keep this educational and include proper risk disclaimers.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 600,
        temperature: 0.6,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'AI service error');
    }

    const analysis = data.choices[0].message.content;

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in trade-helper function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get trading analysis',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});