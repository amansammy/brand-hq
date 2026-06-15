// Vercel serverless function: best-effort Cloudflare Workers AI neuron usage for today.
// Cloudflare's free tier is 10,000 neurons/day. Live usage comes from the GraphQL
// Analytics API; if that field isn't available it returns just the limit.

export default async function handler(req, res) {
  const ACCOUNT = process.env.CF_ACCOUNT_ID
  const TOKEN = process.env.CF_API_TOKEN
  const LIMIT = 10000
  if (!ACCOUNT || !TOKEN) { res.status(200).json({ configured: false, limit: LIMIT }); return }

  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString()
  const query = `query($acct:String!,$start:Time!,$end:Time!){
    viewer{ accounts(filter:{accountTag:$acct}){
      aiInferenceAdaptiveGroups(limit:10000, filter:{datetimeHour_geq:$start, datetimeHour_leq:$end}){
        sum { totalNeurons }
      }
    }}
  }`
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { acct: ACCOUNT, start, end: now.toISOString() } }),
    })
    const j = await r.json()
    const groups = j?.data?.viewer?.accounts?.[0]?.aiInferenceAdaptiveGroups || []
    if (j?.errors?.length || !groups.length) { res.status(200).json({ configured: true, limit: LIMIT }); return }
    const used = groups.reduce((s, g) => s + (g?.sum?.totalNeurons || 0), 0)
    res.status(200).json({ configured: true, limit: LIMIT, used: Math.round(used), remaining: Math.max(0, LIMIT - Math.round(used)) })
  } catch (e) {
    res.status(200).json({ configured: true, limit: LIMIT })
  }
}
