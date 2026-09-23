// Campus Crib — AI-assisted listing description
//
// Deploy with: supabase functions deploy generate-listing-description
// Requires a GROQ_API_KEY secret set in the Supabase dashboard under
// Edge Functions -> Secrets (or via `supabase secrets set GROQ_API_KEY=...`).
// Never hardcode the key here - it's read from the environment only, so
// it's never bundled into or exposed by the frontend.
//
// This function is deliberately the ONLY place that calls Groq. Calling
// an AI API with a secret key directly from the browser would expose
// that key to every visitor via devtools/network tab.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Turns the structured property fields the frontend already has filled
// in on the listing form into a compact, factual bullet list for the
// prompt - nothing here is invented, only what the landlord entered.
function buildDetailsList(input) {
  const lines = []
  if (input.title) lines.push(`Title: ${input.title}`)
  if (input.building_type) lines.push(`Building type: ${input.building_type}`)
  if (input.occupancy) lines.push(`Occupancy: room for ${input.occupancy}`)
  if (input.price) lines.push(`Price: ${input.currency || ''} ${input.price} per month`.trim())
  if (input.toilet_shared_by) {
    lines.push(`Toilet: shared by ${input.toilet_shared_by} people`)
  } else if (input.toilet_shared_by === 0 || input.toilet_shared_by === '0' || input.toiletType === 'private') {
    lines.push('Toilet: private')
  }
  if (input.walk_minutes_to_campus) {
    lines.push(`Walk to campus: about ${input.walk_minutes_to_campus} minutes`)
  }
  if (input.address) lines.push(`Area/address: ${input.address}`)
  if (Array.isArray(input.amenities) && input.amenities.length > 0) {
    lines.push(`Amenities: ${input.amenities.join(', ')}`)
  }
  return lines
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  let input
  try {
    input = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400)
  }

  if (!input?.title || !input?.price) {
    return jsonResponse({ error: 'Missing required property details (at least a title and price).' }, 400)
  }

  const groqApiKey = Deno.env.get('GROQ_API_KEY')
  if (!groqApiKey) {
    console.error('[generate-listing-description] GROQ_API_KEY secret is not set.')
    return jsonResponse(
      { error: 'AI description generation is not configured on this project yet.' },
      500
    )
  }

  const detailsList = buildDetailsList(input)
  if (detailsList.length === 0) {
    return jsonResponse({ error: 'Not enough listing details to generate a description yet.' }, 400)
  }

  const systemPrompt =
    'You write short, warm, honest listing descriptions for a student boarding-house marketplace ' +
    'in Zambia. Use ONLY the facts given to you - never invent amenities, distances, prices, or ' +
    'any other detail not explicitly provided. Do not exaggerate or use pushy sales language. ' +
    'Write 2-4 sentences in a friendly, factual tone aimed at a student searching for housing near ' +
    'their campus. Return only the description text, with no headings, labels, or quotation marks.'

  const userPrompt = `Write a listing description using only these details:\n${detailsList.join('\n')}`

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!groqResponse.ok) {
      if (groqResponse.status === 429) {
        return jsonResponse(
          { error: "We've hit the AI service's rate limit — please try again in a moment." },
          429
        )
      }
      if (groqResponse.status === 401 || groqResponse.status === 403) {
        console.error('[generate-listing-description] Groq rejected the API key:', groqResponse.status)
        return jsonResponse(
          { error: 'AI description generation is not configured correctly (invalid API key).' },
          500
        )
      }
      const errText = await groqResponse.text().catch(() => '')
      console.error('[generate-listing-description] Groq error:', groqResponse.status, errText)
      return jsonResponse({ error: 'Could not generate a description right now. Please try again.' }, 502)
    }

    const data = await groqResponse.json()
    const description = data?.choices?.[0]?.message?.content?.trim()

    if (!description) {
      console.error('[generate-listing-description] Groq returned no content:', JSON.stringify(data))
      return jsonResponse({ error: 'Could not generate a description right now. Please try again.' }, 502)
    }

    return jsonResponse({ description })
  } catch (err) {
    console.error('[generate-listing-description] Network/unexpected error:', err)
    return jsonResponse({ error: 'Could not reach the AI service. Please try again.' }, 502)
  }
})
