import { generateText } from 'ai'
import type { ScoringRule } from '../scoring/traitors-rules'

/** Pseudo-rule for "left the show" when the show's rulebook has no point value for it. */
export const ELIMINATED_CODE = 'eliminated'

export interface SuggestedEvent {
  eventCode: string
  contestantName: string
  description: string
}

export function parseSuggestedEvents(raw: string, validCodes?: Set<string>): SuggestedEvent[] {
  let parsed: unknown
  try {
    // Models often wrap JSON in ```json fences despite instructions.
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  return parsed.filter(
    (item): item is SuggestedEvent =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SuggestedEvent).eventCode === 'string' &&
      typeof (item as SuggestedEvent).contestantName === 'string' &&
      typeof (item as SuggestedEvent).description === 'string' &&
      (!validCodes || validCodes.has((item as SuggestedEvent).eventCode))
  )
}

export async function suggestEventsFromTranscript(
  transcript: string,
  rules: ScoringRule[],
  contestantNames: string[]
): Promise<SuggestedEvent[]> {
  const ruleList = rules.map((r) => `- ${r.code}: ${r.label} (${r.points > 0 ? '+' : ''}${r.points})`).join('\n')
  const validCodes = new Set([...rules.map((r) => r.code), ELIMINATED_CODE])

  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-5',
    prompt: `You are scoring a reality TV episode for a fantasy league. Read the transcript and output a JSON array of scoring events that clearly happened.

Each event has:
- "eventCode": EXACTLY one code from the rulebook below (or "${ELIMINATED_CODE}" if a contestant left the show and no rule above fits)
- "contestantName": EXACTLY one name from the contestant list below
- "description": one sentence saying what happened

Rulebook:
${ruleList}

Contestants: ${contestantNames.join(', ')}

Only include events clearly supported by the transcript. If a rule applies to several contestants, output one event per contestant. Output ONLY the JSON array, no other text.

Transcript:
${transcript}`,
  })
  return parseSuggestedEvents(text, validCodes)
}
