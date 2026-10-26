import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Limit, Remote, Totals, Week } from '../types'

const EMPTY_REMOTE: Remote = {
  five: null,
  seven: null,
  models: [],
  error: null,
  at: 0,
  fails: 0,
  until: 0,
}

const limits = atom({ plugin: 'usage-led', key: 'limits' } as const, [])
const remote = atom({ plugin: 'usage-led', key: 'remote' } as const, EMPTY_REMOTE)
const context = atom({ plugin: 'usage-led', key: 'context' } as const, null)
const cacheHit = atom({ plugin: 'usage-led', key: 'cacheHit' } as const, null)
const session = atom({ plugin: 'usage-led', key: 'session' } as const, {})
const week = atom({ plugin: 'usage-led', key: 'week' } as const, {
  totals: {},
  end: null,
})
const theme = atom({ plugin: 'usage-led', key: 'theme' } as const, 'oqueo')
// Darstellung: 'band' (Leiste über der Eingabe) oder 'status' (Textzeile unter der Eingabe)
const layout = atom({ plugin: 'usage-led', key: 'layout' } as const, 'band')

// Farbvorlagen, umschaltbar mit "/led <name>". Eine Vorlage legt fest:
//   bg, border   Grund und Rahmen der Leiste
//   text, muted  Schrift und Beschriftungen (S, W, K, C, M, Restzeit)
//   lit, unlit   LED an und aus
//   pct          Farbe der Prozentwerte
//   warn         LED und Prozentwert ab 60 % (nur ohne zone)
//   zone         Ampel: Blöcke, die über "from" Prozent der Balkenlänge liegen,
//                leuchten in "color", die davor in lit
type Theme = {
  label: string
  bg: string
  border: string
  text: string
  muted: string
  lit: string
  unlit: string
  pct: string
  warn: string
  zone?: { from: number; color: string }
}

// oQueo CI, dunkle Variante: Logo-Gold abgedunkelt Richtung Logo-Braun als Grund,
// Schrift in "Text hell", LEDs in hellem Gold (Kontrast zur Schrift ca. 6,3:1)
const OQUEO: Theme = {
  label: 'oQueo, goldener Grund',
  bg: '#6F4D14',
  border: '#B47C25',
  text: '#EDE9E3',
  muted: '#E3CFA6',
  lit: '#F5CF86',
  unlit: '#3B2A0B',
  pct: '#F5CF86',
  warn: '#FFB08A',
}

const THEMES: Record<string, Theme> = {
  oqueo: OQUEO,
  // weißer Grund, Elemente schwarz
  weiss: {
    label: 'weißer Grund, Elemente schwarz',
    bg: '#FFFFFF',
    border: '#C9C5BE',
    text: '#100E0C',
    muted: '#5A554E',
    lit: '#100E0C',
    unlit: '#CFCBC4',
    pct: '#100E0C',
    warn: '#100E0C',
  },
  // schwarzer Grund (oQueo Dunkel), Elemente weiß (oQueo Text hell)
  schwarz: {
    label: 'schwarzer Grund, Elemente weiß',
    bg: '#100E0C',
    border: '#4A453E',
    text: '#EDE9E3',
    muted: '#B5AFA5',
    lit: '#EDE9E3',
    unlit: '#3A3631',
    pct: '#EDE9E3',
    warn: '#EDE9E3',
  },
  // weißer Grund, grüne LEDs auf grauer Bahn, ab 80 % der Balkenlänge rot
  'ampel-weiss': {
    label: 'weißer Grund, grüne LEDs, rot ab 80 %',
    bg: '#FFFFFF',
    border: '#C9C5BE',
    text: '#100E0C',
    muted: '#5A554E',
    lit: '#1E9E48',
    unlit: '#C4C4C4',
    pct: '#100E0C',
    warn: '#D8362A',
    zone: { from: 80, color: '#D8362A' },
  },
  // schwarzer Grund, grüne LEDs auf grauer Bahn, ab 80 % der Balkenlänge rot
  'ampel-schwarz': {
    label: 'schwarzer Grund, grüne LEDs, rot ab 80 %',
    bg: '#100E0C',
    border: '#4A453E',
    text: '#EDE9E3',
    muted: '#B5AFA5',
    lit: '#3DDC84',
    unlit: '#3C3C3C',
    pct: '#EDE9E3',
    warn: '#FF5A4D',
    zone: { from: 80, color: '#FF5A4D' },
  },
}

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const SEGMENTS = 6
const SIZE = 'caption' // Schriftstufe der Leiste (caption ist die kleinste Stufe)
const MONO = true // Texte in der Festbreitenschrift der App: wirkt kleiner und schmaler
const ICON = '🗜' // Presse (Klemme) auf dem Compact-Knopf der Desktop-App
const POLL_MS = 120_000
// Nach einer Abweisung (HTTP 429) pausiert die Abfrage: erst 5 Minuten, bei jeder
// weiteren Abweisung doppelt so lang, höchstens 30 Minuten. Nennt die Antwort eine
// Wartezeit (Retry-After), gilt mindestens die.
const BACKOFF_MS = 5 * 60_000
const BACKOFF_MAX_MS = 30 * 60_000
// Gemeinsamer Merker im Speicher, damit parallel laufende Sitzungen mitpausieren
const PAUSE_KEY = 'poll-until'

const FAMILIES = ['Fable', 'Opus', 'Sonnet', 'Haiku', 'Andere']
const MODEL_LABELS: Record<string, string> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
  fable: 'Fable',
  mythos: 'Fable',
}

function family(model: string): string {
  const id = model.toLowerCase()
  if (id.includes('fable') || id.includes('mythos')) return 'Fable'
  if (id.includes('opus')) return 'Opus'
  if (id.includes('sonnet')) return 'Sonnet'
  if (id.includes('haiku')) return 'Haiku'
  return 'Andere'
}

// Restzeit als Stunden:Minuten (2:53, bei der Woche auch 40:03)
function countdown(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (Number.isNaN(ms)) return ''
  const mins = Math.max(0, Math.round(ms / 60_000))
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}

function readWindow(v: unknown, kind: string): Limit | null {
  if (!v || typeof v !== 'object') return null
  const o = v as { utilization?: unknown; resets_at?: unknown }
  if (typeof o.utilization !== 'number' || Number.isNaN(o.utilization)) return null
  return {
    kind,
    percentUsed: Math.max(0, Math.min(100, o.utilization)),
    resetsAt: typeof o.resets_at === 'string' ? o.resets_at : undefined,
  }
}

// Holt die Limits von derselben Quelle wie /usage. Klappt das nicht
// (kein Abo-Login, Netz, Antwort ohne Werte), bleibt der letzte gute Stand
// stehen und der Grund wird in der Leiste angezeigt.
async function fetchRemote($: EngineInterface, prev: Remote, now: number): Promise<Remote> {
  const fail = (error: string): Remote => ({ ...prev, error, at: now })
  try {
    const auth = await $.session.authorize()
    if (!auth) return fail('kein Login')
    if (auth.kind === 'api-key') return fail('API-Key')
    const res = await $.http.fetch(USAGE_URL, {
      headers: {
        accept: 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
      },
      auth: auth.handle,
    })
    if (res.status === 429) {
      const fails = prev.fails + 1
      const asked = Number(res.headers?.['retry-after']) * 1000
      const own = Math.min(BACKOFF_MAX_MS, BACKOFF_MS * 2 ** (fails - 1))
      const wait = Number.isFinite(asked) && asked > 0 ? Math.max(asked, own) : own
      await $.store.set(PAUSE_KEY, now + wait)
      return { ...fail('HTTP 429'), fails, until: now + wait }
    }
    if (!res.ok) return fail(`HTTP ${res.status}`)
    const data = JSON.parse(res.text) as Record<string, unknown>
    const five = readWindow(data.five_hour, 'five_hour')
    const seven = readWindow(data.seven_day, 'seven_day')
    const byLabel = new Map<string, number>()
    for (const key of Object.keys(data)) {
      const suffix = /^seven_day_(.+)$/.exec(key)?.[1]
      const label = suffix ? MODEL_LABELS[suffix] : undefined
      const w = label ? readWindow(data[key], key) : null
      if (label && w) byLabel.set(label, Math.max(byLabel.get(label) ?? 0, w.percentUsed))
    }
    const models = [...byLabel.entries()]
      .map(([label, percent]) => ({ label, percent }))
      .sort((a, b) => b.percent - a.percent)
    if (!five && !seven) return fail('keine Werte')
    return { five, seven, models, error: null, at: now, fails: 0, until: 0 }
  } catch {
    return fail('Abfrage')
  }
}

async function poll($: EngineInterface, minAge: number): Promise<void> {
  const prev = await read($, remote)
  const now = await $.clock.now()
  // Pause nach HTTP 429, auch wenn eine andere Sitzung sie ausgelöst hat
  const shared = await $.store.get(PAUSE_KEY)
  if (now < Math.max(prev.until, typeof shared === 'number' ? shared : 0)) return
  if (now - prev.at < minAge) return
  const next = await fetchRemote($, prev, now)
  await update($, remote, () => next)
}

function shares(totals: Totals): string {
  const sum = FAMILIES.reduce((a, f) => a + (totals[f] ?? 0), 0)
  return FAMILIES.filter(f => (totals[f] ?? 0) > 0)
    .sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))
    .slice(0, 3)
    .map(f => `${f} ${Math.round(((totals[f] ?? 0) / sum) * 100)}%`)
    .join('  ')
}

// Textzeile für die Darstellung "status": die App setzt sie selbst in ihrer kleinen
// Schrift unter die Eingabe. Nur Text, keine Farben: LED an = █, aus = ░.
async function statusText($: EngineInterface): Promise<string> {
  const now = await $.clock.now()
  const [seen, rem, ctx, hit, wk] = await Promise.all([
    read($, limits),
    read($, remote),
    read($, context),
    read($, cacheHit),
    read($, week),
  ])
  const five = rem.five ?? seen.find(l => l.kind === 'five_hour') ?? null
  const seven = rem.seven ?? seen.find(l => l.kind === 'seven_day') ?? null

  const bar = (p: number) => {
    const filled = Math.max(0, Math.min(SEGMENTS, Math.round((p / 100) * SEGMENTS)))
    const lit = p > 0 && filled === 0 ? 1 : filled
    return '█'.repeat(lit) + '░'.repeat(SEGMENTS - lit)
  }
  const part = (label: string, p: number | null, reset?: string) =>
    p === null
      ? `${label} k. A.${rem.error ? ` (${rem.error})` : ''}`
      : [label, bar(p), `${Math.round(p)}%`, reset].filter(Boolean).join(' ')

  const modelLimits = rem.models
    .slice(0, 3)
    .map(m => `${m.label} ${Math.round(m.percent)}%`)
    .join('  ')
  const modelText = modelLimits || shares(wk.totals)

  return [
    part('S', five?.percentUsed ?? null, countdown(five?.resetsAt, now)),
    part('W', seven?.percentUsed ?? null, countdown(seven?.resetsAt, now)),
    part('K', ctx ?? 0),
    hit !== null ? `C ${hit}%` : '',
    modelText ? `M ${modelText}` : '',
  ]
    .filter(Boolean)
    .join('   ')
}

// Setzt oder löscht die Statuszeile je nach gewählter Darstellung
async function refreshStatus($: EngineInterface): Promise<void> {
  try {
    const mode = await read($, layout)
    $.ui.status(mode === 'status' ? await statusText($) : undefined)
  } catch {
    // die Statuszeile ist Zugabe; die Leiste läuft unabhängig davon
  }
}

async function loadWeek($: EngineInterface): Promise<Week> {
  const totals: Totals = {}
  for (const f of FAMILIES) {
    const v = await $.store.get('week:' + f)
    if (typeof v === 'number') totals[f] = v
  }
  const end = await $.store.get('week-end')
  return { totals, end: typeof end === 'string' ? end : null }
}

// Zählt Tokens in das Wochenfenster. Das Fenster endet, wenn das
// 7-Tage-Limit zurückgesetzt wird; danach beginnt die Zählung neu.
async function addWeek(
  $: EngineInterface,
  fam: string,
  n: number,
  resetsAt: string | undefined,
): Promise<void> {
  const now = await $.clock.now()
  let end = await $.store.get('week-end')

  if (typeof end === 'string' && now >= Date.parse(end)) {
    for (const f of FAMILIES) await $.store.delete('week:' + f)
    end = undefined
  }
  if (typeof end !== 'string') {
    end = resetsAt ?? new Date(now + 7 * 86_400_000).toISOString()
    await $.store.set('week-end', end)
  } else if (resetsAt && Math.abs(Date.parse(resetsAt) - Date.parse(end)) > 600_000) {
    await $.store.set('week-end', resetsAt)
  }

  const cur = await $.store.get('week:' + fam)
  await $.store.set('week:' + fam, (typeof cur === 'number' ? cur : 0) + n)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await update($, limits, () => u.rateLimits)
    await update($, context, () => u.context.percent ?? null)
    const loaded = await loadWeek($)
    await update($, week, () => loaded)

    // Gemerkte Vorlage laden und den Befehl /led anmelden
    const saved = await $.store.get('theme')
    if (typeof saved === 'string' && THEMES[saved]) await update($, theme, () => saved)
    const savedLayout = await $.store.get('layout')
    if (savedLayout === 'band' || savedLayout === 'status') {
      await update($, layout, () => savedLayout)
    }
    try {
      await $.command.register({
        name: 'led',
        description: 'Farbvorlage der Nutzungsleiste wechseln',
        argumentHint: `[${Object.keys(THEMES).join('|')}|band|status]`,
      })
    } catch {
      // ohne Befehl läuft die Leiste mit der gemerkten Vorlage weiter
    }

    await poll($, 0)
    await refreshStatus($)
    // Countdown (Restzeit) alle 30 Sekunden neu zeichnen, Limits alle 2 Minuten holen
    $.clock.every(30_000, async () => {
      await poll($, POLL_MS)
      await refreshStatus($)
      await $.ui.invalidate('ui.render')
    })
    return next(e)
  })

  // /led zeigt Vorlagen und Darstellungen, /led <name> wechselt und merkt sich die Wahl
  on('command.run', { command: 'led' }, async ($, e) => {
    const names = Object.keys(THEMES)
    const want = (e.args ?? '').trim().toLowerCase()
    const currentTheme = await read($, theme)
    const currentLayout = await read($, layout)
    if (!want) {
      const rows = names.map(n => `${n === currentTheme ? '*' : ' '} ${n}: ${THEMES[n]?.label ?? ''}`)
      const modes = [
        `${currentLayout === 'band' ? '*' : ' '} band: Leiste über der Eingabe`,
        `${currentLayout === 'status' ? '*' : ' '} status: Textzeile unter der Eingabe`,
      ]
      return {
        text: `Farbvorlagen der Nutzungsleiste (aktuell mit * markiert):\n${rows.join('\n')}\nDarstellung:\n${modes.join('\n')}`,
      }
    }
    if (want === 'band' || want === 'status') {
      await $.store.set('layout', want)
      await update($, layout, () => want)
      await refreshStatus($)
      await $.ui.invalidate('ui.render')
      return { text: `Nutzungsleiste: Darstellung "${want}"` }
    }
    if (!THEMES[want]) {
      return { text: `Unbekannte Vorlage "${want}". Möglich: ${names.join(', ')}, band, status` }
    }
    await $.store.set('theme', want)
    await update($, theme, () => want)
    await $.ui.invalidate('ui.render')
    return { text: `Nutzungsleiste: Vorlage "${want}" (${THEMES[want]?.label ?? ''})` }
  })

  // Wird nach jedem Turn und bei jedem ganzen Prozentpunkt der Limits gerufen
  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits)
    await update($, context, () => e.context.percent ?? null)
    await refreshStatus($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    if (u) {
      const fam = family(u.model)
      const n = u.input_tokens + u.output_tokens + u.cache_creation_input_tokens
      const r = await read($, remote)
      const seen = await read($, limits)
      const resetsAt = r.seven?.resetsAt ?? seen.find(l => l.kind === 'seven_day')?.resetsAt

      await update($, session, (s: Totals) => ({ ...s, [fam]: (s[fam] ?? 0) + n }))
      await addWeek($, fam, n, resetsAt)
      const loaded = await loadWeek($)
      await update($, week, () => loaded)

      if (e.agentId === undefined) {
        const all = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens
        const hit = all > 0 ? Math.round((u.cache_read_input_tokens / all) * 100) : null
        await update($, cacheHit, () => hit)
      }
    }
    await poll($, 30_000)
    await refreshStatus($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // Bei der Darstellung "status" zeichnet die Statuszeile, die Leiste gibt nach
    if ((await read($, layout)) === 'status') return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const cols = e.props.bodyColumns
    const surface = (e as unknown as { surface?: string }).surface

    // Die Desktop-App hat Platz genug; im Terminal entfällt Zusatzinfo bei schmalem Fenster
    const desktop = surface === 'desktop'
    const wide = desktop || cols >= 120
    const mid = desktop || cols >= 90
    const segments = desktop || cols >= 70 ? SEGMENTS : 4

    const [seen, rem, ctx, hit, wk, themeName] = await Promise.all([
      read($, limits),
      read($, remote),
      read($, context),
      read($, cacheHit),
      read($, week),
      read($, theme),
    ])
    const th = THEMES[themeName] ?? OQUEO

    const t = (text: string, color: string = th.text, strong = false, key?: string, mono = MONO) => (
      <Text
        key={key}
        color={color}
        backgroundColor={th.bg}
        size={SIZE}
        mono={mono}
        tabular={mono}
        weight={strong ? 'semibold' : 'regular'}
      >
        {text}
      </Text>
    )

    // Farbe eines leuchtenden Blocks (i von 1 bis segments) bei diesem Füllstand
    const ledColor = (i: number, percent: number): string => {
      if (th.zone) return (i / segments) * 100 > th.zone.from ? th.zone.color : th.lit
      return percent >= 60 ? th.warn : th.lit
    }

    const pctColor = (percent: number): string => {
      if (th.zone) return percent > th.zone.from ? th.zone.color : th.pct
      return percent >= 60 ? th.warn : th.pct
    }

    // Balken ohne Zwischenräume: volle Blöcke, gleichfarbige zu einem Stück zusammengefasst
    const meter = (percent: number | null) => {
      const p = percent ?? 0
      const filled = Math.max(0, Math.min(segments, Math.round((p / 100) * segments)))
      const lit = p > 0 && filled === 0 ? 1 : filled
      const runs: { color: string; n: number }[] = []
      for (let i = 1; i <= segments; i++) {
        const color = i <= lit ? ledColor(i, p) : th.unlit
        const last = runs[runs.length - 1]
        if (last && last.color === color) last.n += 1
        else runs.push({ color, n: 1 })
      }
      return (
        <Box flexDirection="row" backgroundColor={th.bg}>
          {runs.map((r, i) => t('█'.repeat(r.n), r.color, false, `r${i}`, false))}
        </Box>
      )
    }

    // Ein Block in einer Zeile: Bezeichnung, Balken, Prozent, Restzeit
    const gauge = (
      key: string,
      label: string,
      percent: number | null,
      reset?: string,
      why?: string | null,
    ) => (
      <Box key={key} flexDirection="row" columnGap={1} flexShrink={0} backgroundColor={th.bg}>
        {t(label, th.muted, true)}
        {meter(percent)}
        {percent === null ? t('k. A.', th.muted) : t(`${Math.round(percent)}%`, pctColor(percent), true)}
        {percent === null && why ? t(`(${why})`, th.muted) : null}
        {reset ? t(reset, th.muted) : null}
      </Box>
    )

    // Quelle der Limits: zuerst die Abfrage wie /usage, sonst was Claude Code meldet
    const five = rem.five ?? seen.find(l => l.kind === 'five_hour') ?? null
    const seven = rem.seven ?? seen.find(l => l.kind === 'seven_day') ?? null
    const why = rem.error

    const modelLimits = rem.models
      .slice(0, 3)
      .map(m => `${m.label} ${Math.round(m.percent)}%`)
      .join('  ')
    const modelText = modelLimits || shares(wk.totals)

    const extra = (key: string, label: string, value: string): RenderChildren => (
      <Box key={key} flexDirection="row" columnGap={1} flexShrink={0} backgroundColor={th.bg}>
        {t(label, th.muted, true)}
        {t(value)}
      </Box>
    )

    return (
      <Box
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        columnGap={2}
        paddingX={1}
        borderStyle="round"
        borderColor={th.border}
        backgroundColor={th.bg}
        overflow="hidden"
      >
        {gauge('five', 'S', five?.percentUsed ?? null, mid ? countdown(five?.resetsAt, now) : undefined, why)}
        {gauge('seven', 'W', seven?.percentUsed ?? null, mid ? countdown(seven?.resetsAt, now) : undefined, why)}
        {gauge('context', 'K', ctx ?? 0)}
        {wide && hit !== null ? extra('cache', 'C', `${hit}%`) : null}
        {mid && modelText ? extra('models', 'M', modelText) : null}
        {/* Desktop: die App zeichnet die Schaltfläche selbst (Standardvariante ist
            durchscheinend und fällt auf dem Grund kaum auf). Terminal: ohne eigene
            Fläche, der Text steht in der Schriftfarbe der Vorlage und bleibt auf
            hellem wie dunklem Grund lesbar. */}
        <Button
          key="compact"
          {...(desktop ? { label: ICON, variant: 'secondary' as const } : { plain: true as const })}
          onPress={async () => {
            // Wie "/compact" getippt: wartet, bis die Sitzung frei ist
            try {
              await $.command.run({ command: 'compact' })
            } catch (first) {
              try {
                const done = await $.session.compact()
                if (done.skip) $.ui.toast(`Compact abgelehnt: ${done.skip}`.slice(0, 140))
              } catch (second) {
                const why = (second instanceof Error ? second : first) as Error
                $.ui.toast(`Compact fehlgeschlagen: ${String(why?.message ?? why)}`.slice(0, 140))
              }
            }
          }}
        >
          {desktop ? undefined : t('[ Compact ]', th.text, true, undefined, false)}
        </Button>
      </Box>
    )
  })
}
