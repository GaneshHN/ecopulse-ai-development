'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bike, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, CloudSun, Droplets, Flame, Leaf, Lightbulb,
  MapPin, Menu, MessageCircle, Plus, RefreshCw, Send, Settings2, ShieldCheck,
  Sparkles, Sun, Wind, X, Zap,
} from 'lucide-react'

type Section = 'Overview' | 'Daily plan' | 'Indoor air' | 'Carbon impact' | 'Habits' | 'Alternatives'
type AirData = { location: string; aqi?: number; pm25?: number; pm10?: number; temp?: number; humidity?: number; wind?: number; code?: number; updated: string; live: boolean }
const fetcher = async (url: string) => { const res = await fetch(url); if (!res.ok) throw new Error('Environmental readings are temporarily unavailable'); return res.json() }
const initialAir: AirData = { location: 'San Francisco, CA', updated: '', live: false }
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const habits = [
  { id: 'walk', title: 'Walk or cycle for a short trip', detail: 'Replace one car trip under 2 miles', icon: Bike, impact: 'Up to 0.8 kg CO₂e' },
  { id: 'lights', title: 'Switch off unused lights', detail: 'A small habit with a daily payoff', icon: Lightbulb, impact: 'About 0.2 kg CO₂e' },
  { id: 'plant', title: 'Choose a plant-forward meal', detail: 'Try a satisfying bean or lentil dish', icon: Leaf, impact: 'About 1.5 kg CO₂e' },
]
const navItems: { label: Section; icon: typeof Activity }[] = [
  { label: 'Overview', icon: Activity }, { label: 'Daily plan', icon: Sparkles }, { label: 'Indoor air', icon: Wind },
  { label: 'Carbon impact', icon: Zap }, { label: 'Habits', icon: CheckCircle2 }, { label: 'Alternatives', icon: Leaf },
]

function qualityLabel(aqi?: number) {
  if (aqi === undefined) return { label: 'Unavailable', tone: 'neutral' }
  if (aqi <= 50) return { label: 'Good', tone: 'good' }
  if (aqi <= 100) return { label: 'Moderate', tone: 'moderate' }
  if (aqi <= 150) return { label: 'Sensitive groups', tone: 'moderate' }
  return { label: 'High pollution', tone: 'poor' }
}

export default function EcoPulseDashboard() {
  const [section, setSection] = useState<Section>('Overview')
  const [coords, setCoords] = useState({ latitude: 37.7749, longitude: -122.4194 })
  const [location, setLocation] = useState('San Francisco, CA')
  const [mobileNav, setMobileNav] = useState(false)
  const [locationMenu, setLocationMenu] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  const [history, setHistory] = useState<Record<string, string[]>>({})
  const todayKey = localDateKey(new Date())
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [indoor, setIndoor] = useState({ room: 'Bedroom', occupants: '2', ventilation: 'Windows available', cooking: 'Electric', pets: false, purifier: false, pm: '' })
  const [indoorAdvice, setIndoorAdvice] = useState('')
  const { data, error, isLoading, mutate } = useSWR<AirData>(`/api/environment?latitude=${coords.latitude}&longitude=${coords.longitude}&location=${encodeURIComponent(location)}`, fetcher, { refreshInterval: 15 * 60 * 1000, revalidateOnFocus: false })

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('ecopulse-habits-v1')
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        const restored = Array.isArray(parsed)
          ? { [todayKey]: parsed.filter((id): id is string => typeof id === 'string' && habits.some((habit) => habit.id === id)) }
          : parsed && typeof parsed === 'object'
            ? Object.fromEntries(Object.entries(parsed).filter(([date, ids]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(ids)).map(([date, ids]) => [date, (ids as unknown[]).filter((id): id is string => typeof id === 'string' && habits.some((habit) => habit.id === id))]))
            : {}
        setHistory(restored)
        setChecked(restored[todayKey] || [])
      }
    } catch { setChecked([]) }
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setLocation('Your current location')
      }, () => {}, { timeout: 5000, maximumAge: 30 * 60 * 1000 })
    }
  }, [])

  const air = data || initialAir
  const quality = qualityLabel(air.aqi)
  const progress = Math.round((checked.length / habits.length) * 100)
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = localDateKey(date)
    return { key, label: date.toLocaleDateString('en', { weekday: 'short' }), count: history[key]?.length || 0 }
  }), [history])
  const streak = useMemo(() => {
    const cursor = new Date()
    if (!(history[localDateKey(cursor)]?.length)) cursor.setDate(cursor.getDate() - 1)
    let count = 0
    while (history[localDateKey(cursor)]?.length) { count += 1; cursor.setDate(cursor.getDate() - 1) }
    return count
  }, [history])
  const weekCompletions = week.reduce((sum, day) => sum + day.count, 0)
  const impactFactors = { walk: 0.8, lights: 0.2, plant: 1.5 }
  const cumulativeSavings = Object.values(history).flat().reduce((total, id) => total + (impactFactors[id as keyof typeof impactFactors] || 0), 0)
  const savings = useMemo(() => checked.reduce((total, id) => total + (impactFactors[id as keyof typeof impactFactors] || 0), 0), [checked])
  const selectLocation = (nextLocation: string, latitude: number, longitude: number) => {
    setLocation(nextLocation)
    setCoords({ latitude, longitude })
    setLocationMenu(false)
  }
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => selectLocation('Your current location', position.coords.latitude, position.coords.longitude), () => setLocationMenu(false), { timeout: 8000, maximumAge: 30 * 60 * 1000 })
  }
  const toggleHabit = (id: string) => {
    const next = checked.includes(id) ? checked.filter((item) => item !== id) : [...checked, id]
    const nextHistory = { ...history, [todayKey]: next }
    setChecked(next)
    setHistory(nextHistory)
    try { window.localStorage.setItem('ecopulse-habits-v1', JSON.stringify(nextHistory)) } catch { /* Storage may be unavailable in private browsing. */ }
  }
  const askAssistant = async (prompt = message) => {
    if (!prompt.trim() || chatLoading) return
    setMessage(prompt)
    setChatHistory((items) => [...items, { role: 'user', content: prompt.trim() }])
    setChatLoading(true)
    setReply('')
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, context: { location, aqi: air.aqi, pm25: air.pm25, temperature: air.temp } }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'The assistant is unavailable right now.')
      setReply(body.answer)
      setChatHistory((items) => [...items, { role: 'assistant', content: body.answer }])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Please try again shortly.'
      setReply(errorMessage)
      setChatHistory((items) => [...items, { role: 'assistant', content: errorMessage }])
    }
    finally { setChatLoading(false); setMessage('') }
  }
  const generateIndoorAdvice = () => {
    const outdoorHigh = (air.aqi ?? 0) > 100
    const enteredPm = Number(indoor.pm)
    const tips = [
      outdoorHigh ? 'Outdoor pollution is elevated, so keep windows closed for now; ventilate when outdoor air improves.' : 'When outdoor air is cleaner, briefly cross-ventilate your room if it is safe and practical.',
      indoor.cooking === 'Gas' ? 'Use a range hood vented outdoors while cooking, and keep it running briefly afterward. An electric or induction cooktop can reduce indoor combustion emissions.' : 'Use an exhaust fan while cooking and avoid leaving food unattended to prevent smoke.',
      indoor.pets ? 'Vacuum regularly with a HEPA-filter vacuum if available, and wash pet bedding to reduce dander.' : 'Damp-dust surfaces and vacuum weekly to limit settled particles.',
      indoor.purifier ? 'Run your purifier in the occupied room and follow its filter replacement schedule.' : 'If you choose a purifier, match its clean-air delivery rate to the room size; filtration does not replace source control.',
      'Use fragrance-free cleaning products, never mix cleaners, and address leaks promptly to reduce moisture and mold risk.',
    ]
    const reading = indoor.pm.trim() ? (Number.isFinite(enteredPm) && enteredPm >= 0 ? `Your entered PM2.5 reading is ${enteredPm} µg/m³. This is user-provided, not measured by EcoPulse; consider repeating it with a calibrated monitor.` : 'The PM2.5 reading could not be interpreted. Enter a non-negative number or leave it blank.') : 'No indoor sensor reading provided. These are general prevention tips, not a measurement of your indoor air.'
    setIndoorAdvice(`${reading}\n\n${tips.join('\n')}`)
  }

  return (
    <div className="eco-shell">
      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Leaf size={19} strokeWidth={2.4} /></div><span>ecopulse<span className="brand-ai"> AI</span></span></div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setSection(label); setMobileNav(false) }} className={`nav-item ${section === label ? 'active' : ''}`} aria-current={section === label ? 'page' : undefined}><Icon size={17} /><span>{label}</span>{label === 'Daily plan' && <span className="nav-new">NEW</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card"><div className="streak-icon"><Flame size={17} /></div><div><strong>{checked.length ? `${checked.length} of 3 today` : 'Your next small win'}</strong><span>Every action adds up</span></div><ChevronRight size={15} className="streak-arrow" /></div>
          <button className="profile-row" onClick={() => setSettingsOpen(true)}><div className="avatar">J</div><div className="profile-text"><strong>Jordan Lee</strong><span>Personal account</span></div><Settings2 size={16} className="profile-settings" /></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={19} /></button><div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{section}</strong></div><div className="topbar-right"><div className="location-wrap"><button className="location-pill" aria-expanded={locationMenu} onClick={() => setLocationMenu(!locationMenu)}><MapPin size={14} /><span>{location}</span><ChevronDown size={13} /></button>{locationMenu && <div className="location-menu"><span className="section-kicker">CHOOSE A LOCATION</span><button onClick={useCurrentLocation}><MapPin size={13} /> Use current location</button><button onClick={() => selectLocation('San Francisco, CA', 37.7749, -122.4194)}>San Francisco, CA</button><button onClick={() => selectLocation('New York, NY', 40.7128, -74.006)}>New York, NY</button><button onClick={() => selectLocation('London, UK', 51.5072, -0.1276)}>London, UK</button></div>}</div><button className="icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /></button></div></header>
        <div className="page-wrap">
          {section === 'Overview' && <Overview air={air} quality={quality} loading={isLoading} error={!!error} refresh={() => mutate()} onNavigate={setSection} checked={checked} onToggle={toggleHabit} progress={progress} savings={savings} onAsk={askAssistant} reply={reply} chatHistory={chatHistory} message={message} setMessage={setMessage} chatLoading={chatLoading} />}
          {section === 'Daily plan' && <DailyPlan air={air} quality={quality} />}
          {section === 'Indoor air' && <IndoorAir indoor={indoor} setIndoor={setIndoor} advice={indoorAdvice} generate={generateIndoorAdvice} air={air} quality={quality} />}
          {section === 'Carbon impact' && <CarbonCalculator />}
          {section === 'Habits' && <Habits checked={checked} toggle={toggleHabit} progress={progress} savings={savings} history={history} todayKey={todayKey} week={week} streak={streak} weekCompletions={weekCompletions} cumulativeSavings={cumulativeSavings} />}
          {section === 'Alternatives' && <Alternatives />}
          <footer className="footer-note"><ShieldCheck size={13} /> Your environmental readings come from Open-Meteo. Estimates are indicative, not a personal carbon audit.</footer>
        </div>
      </main>
      {settingsOpen && <div className="settings-overlay" onClick={() => setSettingsOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}><div className="settings-modal-head"><div><span className="section-kicker">YOUR WORKSPACE</span><h2 id="settings-title">Settings & privacy</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={16} /></button></div><div className="settings-profile"><div className="avatar">J</div><div><strong>Jordan Lee</strong><span>Personal account</span></div></div><div className="settings-row"><div><strong>Location</strong><span>{location}</span></div><button className="text-link" onClick={() => { setSettingsOpen(false); setLocationMenu(true) }}>Change <ArrowRight size={13} /></button></div><div className="settings-row"><div><strong>Outdoor data</strong><span>Open-Meteo · refreshes every 15 minutes</span></div><ShieldCheck size={16} /></div><div className="settings-row"><div><strong>Habit privacy</strong><span>Saved in this browser only; not synced to an account.</span></div></div><button className="button-primary settings-action" onClick={() => { setSection('Indoor air'); setSettingsOpen(false) }}>Indoor air preferences <ArrowRight size={14} /></button></section></div>}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function Overview({ air, quality, loading, error, refresh, onNavigate, checked, onToggle, progress, savings, onAsk, chatHistory, message, setMessage, chatLoading }: any) {
  const toneClass = quality.tone === 'good' ? 'tone-good' : quality.tone === 'poor' ? 'tone-poor' : quality.tone === 'moderate' ? 'tone-moderate' : ''
  return <>
    <PageHeading eyebrow={new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()} title="A little better, every day." description="Your personal snapshot for living lighter and breathing easier." action={<button className="button-outline" onClick={refresh}><RefreshCw size={15} /> Refresh data</button>} />
    <section className="hero-card"><div className="hero-content"><div className="live-label"><span className="live-dot" /> OUTDOOR AIR · {air.live ? 'LIVE' : 'OPEN-METEO'}</div><h2>{air.aqi !== undefined ? quality.label : 'Air quality check'}</h2><p>{air.aqi !== undefined ? 'A useful moment to check in with the air around you.' : error ? 'Live environmental readings could not be retrieved.' : 'Checking current conditions for your area…'}</p><div className="hero-meta"><span><MapPin size={14} /> {air.location || 'San Francisco, CA'}</span><span>{air.updated ? `Updated ${new Date(air.updated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Readings may be unavailable'}</span></div></div><div className="hero-gauge"><div className={`gauge-ring ${toneClass}`}><span>{loading ? '–' : air.aqi ?? '—'}</span><small>US AQI</small></div><span className="gauge-caption">{air.aqi === undefined ? 'No reading' : quality.label}</span></div><div className="hero-sun"><Sun size={104} strokeWidth={0.8} /></div></section>
    <div className="metrics-grid"><Metric icon={Wind} label="PM2.5" value={air.pm25} unit="µg/m³" detail="Fine particles" color="mint" /><Metric icon={Activity} label="PM10" value={air.pm10} unit="µg/m³" detail="Coarse particles" color="blue" /><Metric icon={CloudSun} label="Temperature" value={air.temp} unit="°C" detail={air.code === undefined ? 'Weather unavailable' : weatherLabel(air.code)} color="orange" /><Metric icon={Droplets} label="Humidity" value={air.humidity} unit="%" detail={air.wind === undefined ? 'Wind unavailable' : `Wind ${air.wind} km/h`} color="purple" /></div>
    <div className="content-grid"><section className="panel routine-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR DAILY PLAN</span><h3>Small steps, real change</h3></div><button className="text-link" onClick={() => onNavigate('Daily plan')}>View plan <ArrowRight size={14} /></button></div><p className="panel-intro">A few ideas matched to your day and the air outside.</p><div className="recommendation-list"><Recommendation icon={Bike} number="01" title="Swap one short drive" text="If your trip is under 2 miles, a walk or bike ride can avoid tailpipe emissions and may feel good in today’s conditions." tag="Mobility" /><Recommendation icon={Wind} number="02" title={air.aqi !== undefined && air.aqi > 100 ? 'Keep windows closed for now' : 'Find a fresh-air moment'} text={air.aqi !== undefined && air.aqi > 100 ? 'Outdoor AQI is elevated. Reduce time outside and use filtered indoor air where possible.' : 'Check the next air update before airing out rooms; timing ventilation for cleaner outdoor air helps.'} tag="Air quality" /><Recommendation icon={Leaf} number="03" title="Make one meal plant-forward" text="Try lentils, beans, or seasonal vegetables in one meal. Food impact varies by ingredients and portion." tag="Food" /></div><button className="button-primary plan-button" onClick={() => onNavigate('Daily plan')}><Sparkles size={15} /> Explore your daily plan</button></section>
    <div className="right-stack"><section className="panel habit-summary"><div className="panel-heading"><div><span className="section-kicker">TODAY’S HABITS</span><h3>Your daily impact</h3></div><button className="icon-button small" aria-label="View habits" onClick={() => onNavigate('Habits')}><ArrowRight size={15} /></button></div><div className="progress-row"><div className="progress-value">{checked.length}<span>/{habits.length}</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div><p className="microcopy">{savings > 0 ? `~${savings.toFixed(1)} kg CO₂e estimated today` : 'Complete an action to start your streak.'}</p><div className="mini-habits">{habits.map((habit) => <button key={habit.id} className="mini-habit" onClick={() => onToggle(habit.id)}><span className={`check-circle ${checked.includes(habit.id) ? 'checked' : ''}`}>{checked.includes(habit.id) && <Check size={12} />}</span><span>{habit.title}</span></button>)}</div></section>
    <section className="assistant-card"><div className="assistant-head"><span className="assistant-icon"><MessageCircle size={17} /></span><span className="assistant-status">YOUR ECO ASSISTANT</span><Sparkles size={14} className="assistant-spark" /></div><h3>Curious about your impact?</h3><p>Ask a question. Get a practical answer grounded in your local conditions.</p>{chatHistory.length > 0 && <div className="chat-history" role="log" aria-label="Eco assistant conversation" aria-live="polite">{chatHistory.map((item: { role: 'user' | 'assistant'; content: string }, index: number) => <div className={`chat-message ${item.role}`} key={`${index}-${item.role}`}><strong>{item.role === 'user' ? 'You' : 'EcoPulse'}</strong><span>{item.content}</span></div>)}</div>}<form className="assistant-input" onSubmit={(event) => { event.preventDefault(); void onAsk(message) }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask anything about your day…" aria-label="Ask EcoPulse assistant" maxLength={500} /><button disabled={chatLoading || !message.trim()} aria-label="Send message">{chatLoading ? <span className="spinner" /> : <Send size={15} />}</button></form><div className="suggestions"><button onClick={() => void onAsk('How can I improve the air in my bedroom?')}>Bedroom air</button><button onClick={() => void onAsk('What should I do when outdoor AQI is high?')}>High AQI</button></div></section></div></div>
  </>
}
function Metric({ icon: Icon, label, value, unit, detail, color }: any) { return <div className="metric-card"><div className={`metric-icon ${color}`}><Icon size={17} /></div><div className="metric-top"><span>{label}</span><span className="metric-dot" /></div><div className="metric-value">{value === undefined ? <span className="unavailable">Unavailable</span> : <>{value}<small> {unit}</small></>}</div><div className="metric-detail">{detail}</div></div> }
function Recommendation({ icon: Icon, number, title, text, tag }: any) { return <article className="recommendation"><div className="recommendation-icon"><Icon size={17} /></div><div className="recommendation-copy"><div className="recommendation-title"><span>{number}</span><h4>{title}</h4></div><p>{text}</p><span className="category-tag">{tag}</span></div><ChevronRight size={16} className="recommendation-arrow" /></article> }
function DailyPlan({ air, quality }: any) { return <><PageHeading eyebrow="PERSONALIZED FOR YOU" title="Your daily plan" description="Practical, low-cost ideas based on the conditions we can see today." /><div className="plan-context"><div className="context-icon"><CloudSun size={20} /></div><div><strong>Today’s context</strong><p>{air.aqi === undefined ? 'Outdoor air readings are unavailable; use local guidance before making ventilation decisions.' : `Outdoor air in ${air.location || 'your area'} is ${quality.label.toLowerCase()} (US AQI ${air.aqi}).`} {air.temp !== undefined ? `It is ${air.temp}°C outside.` : ''}</p></div><span className="live-tag">{air.aqi === undefined ? 'NO READING' : 'LIVE CONTEXT'}</span></div><div className="plan-list"><PlanCard n="01" category="MOVE WITH INTENTION" title="Replace one short car trip" why="A typical passenger vehicle emits roughly 0.4 kg CO₂ per mile driven (EPA average; actual vehicles vary). Walking or cycling avoids those tailpipe emissions for the replaced distance." action="Try walking or cycling for an errand under 2 miles if your route feels safe." icon={Bike} impact="Avoided tailpipe CO₂" /><PlanCard n="02" category="BREATHE EASIER" title={air.aqi !== undefined && air.aqi > 100 ? 'Limit outdoor exertion today' : 'Ventilate at the right time'} why={air.aqi !== undefined && air.aqi > 100 ? 'Higher particle pollution can affect health, especially for sensitive groups. Check local health guidance and reduce prolonged or heavy outdoor activity.' : 'Ventilation can dilute indoor pollutants, but outdoor air quality changes. Check conditions before opening windows.'} action={air.aqi !== undefined && air.aqi > 100 ? 'Choose a lower-intensity indoor activity and keep windows closed while outdoor pollution is elevated.' : 'Check the next air update before opening windows; close them if outdoor pollution rises.'} icon={Wind} impact="Health-first choice" /><PlanCard n="03" category="EAT A LITTLE GREENER" title="Make one meal plant-forward" why="Beef and lamb generally have higher life-cycle greenhouse-gas footprints than beans and lentils. The actual difference depends on the full meal and sourcing." action="Build a meal around beans, lentils, or tofu once today. Choose what fits your budget and preferences." icon={Leaf} impact="No exact saving claimed" /><PlanCard n="04" category="USE LESS ENERGY" title="Switch off what’s idle" why="Reducing electricity use reduces associated power-sector emissions; the benefit depends on your local grid mix and device." action="Turn off lights and unplug chargers you’re not using. Skip anything inconvenient or unsafe." icon={Zap} impact="Varies by grid" /></div><div className="disclaimer-box"><CircleHelp size={17} /><span>These suggestions are general guidance, not medical advice. Environmental benefits are directional; no personal emissions total is inferred from incomplete data.</span></div></> }
function PlanCard({ n, category, title, why, action, icon: Icon, impact }: any) { return <article className="plan-card"><div className="plan-icon"><Icon size={19} /></div><div className="plan-card-main"><div className="plan-category">{category}</div><h3>{title}</h3><p className="plan-why">{why}</p><div className="action-callout"><span>TRY THIS</span><p>{action}</p></div><div className="plan-card-foot"><span className="category-tag">{impact}</span><span className="difficulty">Easy · 5–15 min</span></div></div><span className="plan-number">{n}</span></article> }
function IndoorAir({ indoor, setIndoor, advice, generate, air, quality }: any) { const update = (key: string, value: string | boolean) => setIndoor((current: any) => ({ ...current, [key]: value })); return <><PageHeading eyebrow="HOME WELLNESS" title="Breathe better indoors" description="Personalized prevention tips — not a substitute for an indoor air sensor." /><div className="indoor-alert"><ShieldCheck size={18} /><div><strong>EcoPulse does not measure your indoor air.</strong><span>Any PM2.5 value below is one you enter. Recommendations are inferred from your answers and outdoor conditions.</span></div></div><div className="indoor-grid"><section className="panel indoor-form"><div className="panel-heading"><div><span className="section-kicker">YOUR SPACE</span><h3>Tell us about your room</h3></div></div><div className="form-grid"><label>Room type<select value={indoor.room} onChange={(e) => update('room', e.target.value)}><option>Bedroom</option><option>Living room</option><option>Kitchen</option><option>Home office</option><option>Other</option></select></label><label>Occupants<input type="number" min="1" max="30" value={indoor.occupants} onChange={(e) => update('occupants', e.target.value)} /></label><label>Ventilation<select value={indoor.ventilation} onChange={(e) => update('ventilation', e.target.value)}><option>Windows available</option><option>Mechanical ventilation</option><option>Limited ventilation</option></select></label><label>Cooking fuel<select value={indoor.cooking} onChange={(e) => update('cooking', e.target.value)}><option>Electric</option><option>Gas</option><option>Wood / solid fuel</option><option>Not applicable</option></select></label><label className="wide-field">Indoor PM2.5 reading <span>(optional, µg/m³)</span><input inputMode="decimal" type="number" min="0" max="10000" placeholder="Only if you have a monitor" value={indoor.pm} onChange={(e) => update('pm', e.target.value)} /></label><label className="toggle-field"><span><strong>Pets in the home</strong><small>May affect dander and settled dust</small></span><input type="checkbox" checked={indoor.pets} onChange={(e) => update('pets', e.target.checked)} /></label><label className="toggle-field"><span><strong>Air purifier available</strong><small>We’ll include filtration guidance</small></span><input type="checkbox" checked={indoor.purifier} onChange={(e) => update('purifier', e.target.checked)} /></label></div><button className="button-primary" onClick={generate}><Sparkles size={15} /> Get my room guidance</button></section><aside className="indoor-side"><div className="panel outdoor-card"><span className="section-kicker">OUTDOOR CONDITIONS</span><h3>{air.aqi === undefined ? 'No current reading' : `${quality.label} · AQI ${air.aqi}`}</h3><p>{air.aqi !== undefined && air.aqi > 100 ? 'Avoid opening windows while outdoor pollution is elevated.' : 'Check these conditions before ventilating your room.'}</p><span className={`quality-pill ${quality.tone}`}>{air.aqi === undefined ? 'Unavailable' : 'Open-Meteo'}</span></div><div className="panel advice-card"><div className="advice-title"><Sparkles size={16} /><strong>Your guidance</strong></div>{advice ? <pre>{advice}</pre> : <div className="empty-advice"><div><Wind size={22} /></div><strong>Room-aware advice starts here</strong><span>Answer a few quick questions to see useful next steps.</span></div>}</div></aside></div></> }
function CarbonCalculator() { const [miles, setMiles] = useState('0'); const [kwh, setKwh] = useState('0'); const [meals, setMeals] = useState('0'); const [waste, setWaste] = useState('0'); const total = Number(miles || 0) * 0.404 + Number(kwh || 0) * 0.386 + Number(meals || 0) * 0.5 + Number(waste || 0) * 0.5; return <><PageHeading eyebrow="KNOW YOUR NUMBERS" title="Carbon impact" description="A transparent estimate is more useful than a precise-looking guess." /><div className="carbon-summary"><div><span className="section-kicker">ESTIMATED AVOIDED EMISSIONS</span><div className="carbon-total">{total.toFixed(1)} <small>kg CO₂e</small></div><p>Illustrative estimate using the assumptions below — not a measured footprint.</p></div><div className="carbon-mark"><Leaf size={28} /></div></div><div className="calculator-layout"><section className="panel calculator-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR ACTIONS</span><h3>What changed this week?</h3></div></div><label className="calc-row"><span><strong>Car miles replaced</strong><small>Passenger vehicle, approximate average</small></span><div className="calc-input"><input type="number" min="0" value={miles} onChange={(e) => setMiles(e.target.value)} /><span>miles</span></div></label><label className="calc-row"><span><strong>Electricity saved</strong><small>Grid-average estimate; location matters</small></span><div className="calc-input"><input type="number" min="0" value={kwh} onChange={(e) => setKwh(e.target.value)} /><span>kWh</span></div></label><label className="calc-row"><span><strong>Plant-forward meals swapped</strong><small>Highly dependent on meal ingredients</small></span><div className="calc-input"><input type="number" min="0" value={meals} onChange={(e) => setMeals(e.target.value)} /><span>meals</span></div></label><label className="calc-row"><span><strong>Food waste avoided</strong><small>Approximate avoided food life-cycle emissions</small></span><div className="calc-input"><input type="number" min="0" step="0.1" value={waste} onChange={(e) => setWaste(e.target.value)} /><span>kg</span></div></label><div className="calc-note"><CircleHelp size={15} /><p>Only enter changes you can reasonably estimate. The result uses simplified factors and omits upstream and rebound effects.</p></div></section><aside className="panel assumptions-panel"><span className="section-kicker">THE ASSUMPTIONS</span><h3>Where estimates come from</h3><div className="assumption-item"><span>Car</span><div><strong>0.404 kg CO₂ / vehicle-mile</strong><p>Rounded U.S. passenger vehicle average based on EPA’s ~400 g CO₂ per mile. This is CO₂, not full CO₂e.</p></div></div><div className="assumption-item"><span>Grid</span><div><strong>0.386 kg CO₂e / kWh</strong><p>Illustrative U.S. average electricity factor. Real grid intensity varies by region and time.</p></div></div><div className="assumption-item"><span>Food</span><div><strong>0.5 kg CO₂e / meal</strong><p>Placeholder midpoint for a broad meal swap, not a universal factor. Meal composition changes the result substantially.</p></div></div><div className="assumption-item"><span>Waste</span><div><strong>0.5 kg CO₂e / kg food</strong><p>Simple food-waste estimate; production, type, and disposal method all affect lifecycle impact.</p></div></div><p className="source-note">References: U.S. EPA Greenhouse Gas Emissions from a Typical Passenger Vehicle; U.S. EPA eGRID. Other factors are illustrative assumptions, shown to make uncertainty visible.</p></aside></div></> }
function Habits({ checked, toggle, progress, savings, week, streak, weekCompletions, cumulativeSavings }: any) { return <><PageHeading eyebrow="CONSISTENCY OVER PERFECTION" title="Build your eco rhythm" description="Small actions, repeated. Your habit check-ins stay on this device." /><div className="habit-overview"><div className="habit-ring"><div><strong>{progress}%</strong><span>today</span></div></div><div className="habit-overview-copy"><span className="section-kicker">YOUR DAILY PROGRESS</span><h2>{checked.length === 3 ? 'That’s a wrap. Nicely done.' : checked.length ? 'You’re building momentum.' : 'Start with one small win.'}</h2><p>{checked.length} of {habits.length} suggested habits completed today. {savings > 0 ? `Illustrative impact: ~${savings.toFixed(1)} kg CO₂e.` : 'Check in as you go; no streak pressure.'}</p></div><div className="habit-stats"><div><strong>{streak}</strong><span>day streak</span></div><div><strong>{checked.length}</strong><span>done today</span></div></div></div><section className="panel habits-panel"><div className="panel-heading"><div><span className="section-kicker">TODAY · {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date()).toUpperCase()}</span><h3>Your suggested habits</h3></div><span className="saved-pill"><CheckCircle2 size={13} /> Auto-saved</span></div><div className="habit-list">{habits.map((habit, index) => { const Icon = habit.icon; const done = checked.includes(habit.id); return <div className={`habit-row ${done ? 'habit-done' : ''}`} key={habit.id}><button className={`habit-check ${done ? 'checked' : ''}`} aria-label={`${done ? 'Unmark' : 'Complete'} ${habit.title}`} onClick={() => toggle(habit.id)}>{done && <Check size={14} />}</button><div className="habit-row-icon"><Icon size={18} /></div><div className="habit-row-copy"><strong>{habit.title}</strong><span>{habit.detail}</span></div><span className="habit-impact">{habit.impact}</span><span className="habit-time">{index === 0 ? '10 min' : index === 1 ? '2 min' : '20 min'}</span></div> })}</div></section><div className="habit-insights-grid"><section className="panel week-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR WEEK</span><h3>Seven-day rhythm</h3></div><span className="week-count">{weekCompletions} check-ins</span></div><div className="week-bars">{week.map((day: { key: string; label: string; count: number }) => <div className="week-day" key={day.key}><div className="week-bar-track"><span style={{ height: `${Math.max(day.count ? 8 : 0, (day.count / habits.length) * 100)}%` }} /></div><strong>{day.count}</strong><span>{day.label}</span></div>)}</div><p className="cumulative-impact">Estimated cumulative habit impact <strong>~{cumulativeSavings.toFixed(1)} kg CO₂e</strong></p></section><section className="panel badges-panel"><span className="section-kicker">MILESTONES</span><h3>Good things add up</h3><div className="badge-list"><div className={`badge-row ${weekCompletions >= 1 ? 'earned' : ''}`}><span>01</span><div><strong>First step</strong><small>Complete a habit once</small></div>{weekCompletions >= 1 && <CheckCircle2 size={15} />}</div><div className={`badge-row ${streak >= 3 ? 'earned' : ''}`}><span>03</span><div><strong>In a rhythm</strong><small>Build a 3-day streak</small></div>{streak >= 3 && <CheckCircle2 size={15} />}</div><div className={`badge-row ${weekCompletions >= 10 ? 'earned' : ''}`}><span>10</span><div><strong>Keep it going</strong><small>Log 10 weekly check-ins</small></div>{weekCompletions >= 10 && <CheckCircle2 size={15} />}</div></div></section></div><p className="privacy-note"><ShieldCheck size={14} /> Your habit check-ins are saved locally in this browser. They are not synced across devices.</p></> }
function Alternatives() { const groups = [{ title: 'Get around', icon: Bike, items: [['Walk or cycle', 'Zero tailpipe emissions; free if it fits your route.', 'Low cost'], ['Transit or carpool', 'Can reduce per-person trip emissions; depends on occupancy and local service.', 'Usually affordable'], ['Combine errands', 'Fewer separate trips can mean fewer cold starts and less driving.', 'No extra cost']] }, { title: 'At home', icon: Zap, items: [['LED bulbs', 'Use less electricity than incandescent lighting; savings depend on use and grid.', 'Low upfront'], ['Repair before replacing', 'Keeping a useful product longer avoids new manufacturing impacts.', 'Often lowest cost'], ['Efficient cooking', 'Lids and right-sized burners reduce wasted heat.', 'No extra cost']] }, { title: 'Eat & waste less', icon: Leaf, items: [['Beans and lentils', 'Often lower footprint protein than beef; choose what works for you.', 'Budget-friendly'], ['Plan one flexible meal', 'Use what you already have to reduce food going unused.', 'Saves groceries'], ['Refill and reuse', 'Avoids single-use packaging when the reusable item gets repeated use.', 'Varies']] }]; return <><PageHeading eyebrow="BETTER CHOICES, YOUR WAY" title="Sustainable alternatives" description="Practical swaps with the trade-offs made clear. Start with what fits your life." />{groups.map((group) => { const GroupIcon = group.icon; return <section className="alternative-group" key={group.title}><div className="alternative-heading"><div className="alternative-group-icon"><GroupIcon size={18} /></div><h2>{group.title}</h2></div><div className="alternative-grid">{group.items.map(([title, impact, affordability]) => <article className="panel alternative-card" key={title}><div className="alternative-top"><span className="alternative-check"><Check size={14} /></span><span className="category-tag">{affordability}</span></div><h3>{title}</h3><p>{impact}</p><div className="alternative-foot"><span>Practical swap</span><ArrowUpRight size={15} /></div></article>)}</div></section> })}<div className="disclaimer-box"><CircleHelp size={17} /><span>Benefits vary by region, product, and behavior. These are general comparisons, not product-specific lifecycle assessments.</span></div></> }
function weatherLabel(code: number) { if (code === 0) return 'Clear skies'; if ([1, 2, 3].includes(code)) return 'Partly cloudy'; if ([45, 48].includes(code)) return 'Foggy'; if (code >= 51 && code <= 67) return 'Rain'; if (code >= 71 && code <= 77) return 'Snow'; if (code >= 80 && code <= 82) return 'Showers'; if (code >= 95) return 'Thunderstorms'; return 'Current conditions' }
