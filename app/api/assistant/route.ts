import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const requestCounts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 10

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const current = requestCounts.get(forwarded)
  if (current && current.resetAt > now && current.count >= MAX_REQUESTS) {
    return NextResponse.json({ error: 'Too many questions right now. Please wait a minute and try again.' }, { status: 429 })
  }
  requestCounts.set(forwarded, current && current.resetAt > now ? { ...current, count: current.count + 1 } : { count: 1, resetAt: now + WINDOW_MS })
  if (requestCounts.size > 2_000) for (const [key, value] of requestCounts) if (value.resetAt < now) requestCounts.delete(key)

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'A question is required.' }, { status: 400 })
  const { message, context } = body as { message?: unknown; context?: unknown }
  if (typeof message !== 'string' || !message.trim() || message.length > 500) return NextResponse.json({ error: 'Enter a question up to 500 characters.' }, { status: 400 })
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'EcoPulse AI is not connected yet. Add GEMINI_API_KEY to enable Gemini answers; your live outdoor readings and other tools still work.' }, { status: 503 })
  const safeContext = context && typeof context === 'object' ? context as Record<string, unknown> : {}
  const facts = [
    typeof safeContext.location === 'string' ? `Location: ${safeContext.location.slice(0, 100)}` : '',
    typeof safeContext.aqi === 'number' && Number.isFinite(safeContext.aqi) ? `Outdoor US AQI: ${safeContext.aqi}` : 'Outdoor AQI unavailable',
    typeof safeContext.pm25 === 'number' && Number.isFinite(safeContext.pm25) ? `Outdoor PM2.5: ${safeContext.pm25} µg/m³` : '',
    typeof safeContext.temperature === 'number' && Number.isFinite(safeContext.temperature) ? `Temperature: ${safeContext.temperature}°C` : '',
  ].filter(Boolean).join('\n')
  try {
    const ai = new GoogleGenAI({ apiKey })
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `You are EcoPulse, a careful environmental lifestyle assistant. Give concise, affordable, actionable advice. Use the supplied environmental context when relevant. Never invent readings, health diagnoses, or precise emissions savings. Clearly distinguish estimates from facts. If outdoor air pollution is elevated, do not recommend opening windows. Advise checking local health guidance for health-sensitive situations.\n\nEnvironmental context:\n${facts}\n\nQuestion: ${message.trim()}`,
      config: { maxOutputTokens: 450, temperature: 0.5 },
    })
    const answer = result.text?.trim()
    if (!answer) return NextResponse.json({ error: 'Gemini returned no answer. Please try a different question.' }, { status: 502 })
    return NextResponse.json({ answer })
  } catch {
    return NextResponse.json({ error: 'The assistant could not connect. Please try again shortly.' }, { status: 502 })
  }
}
