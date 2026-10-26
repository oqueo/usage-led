export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

// Zählbare Tokens je Modellfamilie (Fable, Opus, Sonnet, Haiku, Andere)
export type Totals = Record<string, number>

export type Week = { totals: Totals; end: string | null }

// Limits direkt vom Konto (dieselbe Quelle wie /usage)
export type Remote = {
  five: Limit | null
  seven: Limit | null
  // Wochenlimits je Modell, falls das Konto welche meldet
  models: { label: string; percent: number }[]
  // Grund, falls die Abfrage nicht klappt (z. B. "HTTP 403")
  error: string | null
  at: number
  // Abweisungen (HTTP 429) in Folge und Zeitpunkt, vor dem nicht neu gefragt wird
  fails: number
  until: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-led': {
      limits: Limit[]
      remote: Remote
      context: number | null
      cacheHit: number | null
      session: Totals
      week: Week
      // Name der gewählten Farbvorlage (oqueo, weiss, schwarz, ampel-weiss, ampel-schwarz)
      theme: string
      // 'band' (Leiste über der Eingabe) oder 'status' (Textzeile unter der Eingabe)
      layout: string
    }
  }
}
