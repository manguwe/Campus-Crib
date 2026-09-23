// Campus Crib — AI-powered natural-language search (student-facing)
//
// Deploy with: supabase functions deploy ai-search-listings
// Reuses the same GROQ_API_KEY secret as generate-listing-description -
// no separate secret needed.
//
// IMPORTANT: this function's only job is to translate free text into
// structured filter values. It NEVER queries or returns listings itself
// - the frontend runs the returned filter values through Browse.jsx's
// existing, accurate Supabase query/filter logic, exactly as if the
// student had set those filters by hand. This is deliberate: it means
// the AI can never hallucinate a listing that doesn't actually exist,
// since it never sees or produces listing data at all.
//
// The vocabulary (campus ids/names, building types, amenity keys) is
// NOT hardcoded here - it's sent by the frontend on every request,
// pulled from the same src/lib/constants.js and src/lib/campuses.js
// the rest of the app already uses as its source of truth. That keeps
// this function from silently drifting out of sync if those lists
// change.

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

function buildSystemPrompt(vocabulary) {
  const campusList = (vocabulary.campuses || [])
    .map((c) => `"${c.id}" (${c.name})`)
    .join(', ')
  const buildingTypeList = (vocabulary.buildingTypes || []).map((v) => `"${v}"`).join(', ')
  const amenityList = (vocabulary.amenities || []).map((v) => `"${v}"`).join(', ')

  return [
    'You extract structured search filters from a student\'s free-text description of the student ',
    'housing they want, for a boarding-house marketplace in Zambia. You must respond with ONLY a ',
    'single valid JSON object - no markdown fences, no commentary, no explanation.\n\n',
    'The JSON object may include ONLY these fields, all optional - omit any field you cannot ',
    'confidently infer from the text rather than guessing:\n',
    '- campus: one of these exact campus ids (nothing else): ' + campusList + '\n',
    '- min_price: number\n',
    '- max_price: number\n',
    '- building_type: one of these exact values (nothing else): ' + buildingTypeList + '\n',
    '- occupancy: integer, the room occupancy the student wants (e.g. "room for 2" -> 2)\n',
    '- toilet_type: exactly "private" or "shared"\n',
    '- amenities: an array containing only values from this exact list (nothing else): ' +
      amenityList +
      '\n',
    '- max_distance_km: number, walking/commute distance from campus in kilometers\n\n',
    'Never invent a campus, building_type, or amenity value outside the exact lists given above. ',
    'If the text mentions something not in those lists, leave the corresponding field out entirely. ',
    'If a field genuinely cannot be inferred, omit it - do not include it with a null or empty value.',
  ].join('')
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

  const query = typeof input?.query === 'string' ? input.query.trim() : ''
  if (!query) {
    return jsonResponse({ error: 'Please describe what you\'re looking for.' }, 400)
  }

  const vocabulary = input?.vocabulary || {}

  const groqApiKey = Deno.env.get('GROQ_API_KEY')
  if (!groqApiKey) {
    console.error('[ai-search-listings] GROQ_API_KEY secret is not set.')
    return jsonResponse({ error: 'AI search is not configured on this project yet.' }, 500)
  }

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
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildSystemPrompt(vocabulary) },
          { role: 'user', content: query },
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
        console.error('[ai-search-listings] Groq rejected the API key:', groqResponse.status)
        return jsonResponse({ error: 'AI search is not configured correctly (invalid API key).' }, 500)
      }
      const errText = await groqResponse.text().catch(() => '')
      console.error('[ai-search-listings] Groq error:', groqResponse.status, errText)
      return jsonResponse({ error: 'Could not interpret your search right now. Please try again.' }, 502)
    }

    const data = await groqResponse.json()
    const raw = data?.choices?.[0]?.message?.content?.trim()

    if (!raw) {
      console.error('[ai-search-listings] Groq returned no content:', JSON.stringify(data))
      return jsonResponse({ error: 'Could not interpret your search right now. Please try again.' }, 502)
    }

    // The model is instructed to return raw JSON, but strip a markdown
    // fence defensively in case it wraps the object in one anyway.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

    let filters
    try {
      filters = JSON.parse(cleaned)
    } catch {
      console.error('[ai-search-listings] Model did not return valid JSON:', raw)
      return jsonResponse({ error: 'Could not interpret your search right now. Please try again.' }, 502)
    }

    if (typeof filters !== 'object' || filters === null || Array.isArray(filters)) {
      return jsonResponse({ error: 'Could not interpret your search right now. Please try again.' }, 502)
    }

    return jsonResponse({ filters })
  } catch (err) {
    console.error('[ai-search-listings] Network/unexpected error:', err)
    return jsonResponse({ error: 'Could not reach the AI service. Please try again.' }, 502)
  }
})
