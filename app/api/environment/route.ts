import { NextRequest, NextResponse } from 'next/server'

const numberOrUndefined = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const latitude = Number(url.searchParams.get('latitude'))
  const longitude = Number(url.searchParams.get('longitude'))
  const location = (url.searchParams.get('location') || 'Selected location').slice(0, 100)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'A valid latitude and longitude are required.' }, { status: 400 })
  }
  try {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m', timezone: 'auto' })
    const airParams = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: 'us_aqi,pm2_5,pm10', timezone: 'auto' })
    const [weatherResponse, airResponse] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 900 } }),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`, { next: { revalidate: 900 } }),
    ])
    if (!weatherResponse.ok || !airResponse.ok) throw new Error('Upstream environmental service unavailable')
    const [weather, air] = await Promise.all([weatherResponse.json(), airResponse.json()])
    const currentWeather = weather.current || {}
    const currentAir = air.current || {}
    return NextResponse.json({
      location,
      aqi: numberOrUndefined(currentAir.us_aqi),
      pm25: numberOrUndefined(currentAir.pm2_5),
      pm10: numberOrUndefined(currentAir.pm10),
      temp: numberOrUndefined(currentWeather.temperature_2m),
      humidity: numberOrUndefined(currentWeather.relative_humidity_2m),
      wind: numberOrUndefined(currentWeather.wind_speed_10m),
      code: numberOrUndefined(currentWeather.weather_code),
      updated: currentAir.time || currentWeather.time || new Date().toISOString(),
      live: true,
    }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } })
  } catch {
    return NextResponse.json({ error: 'Current environmental readings are unavailable. No readings have been estimated.' }, { status: 503 })
  }
}
