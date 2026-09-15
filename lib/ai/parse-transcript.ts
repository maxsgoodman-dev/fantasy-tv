import { generateText } from 'ai'

export interface SuggestedEvent {
  eventType: string
  contestantName: string
  description: string
}

export function parseSuggestedEvents(raw: string): SuggestedEvent[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  return parsed.filter((item): item is SuggestedEvent =>
    typeof item === 'object' &&
    item !== null &&
    typeof (item as SuggestedEvent).eventType === 'string' &&
    typeof (item as SuggestedEvent).contestantName === 'string' &&
    typeof (item as SuggestedEvent).description === 'string'
  )
}

export async function suggestEventsFromTranscript(transcript: string): Promise<SuggestedEvent[]> {
  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-5',
    prompt: `You are extracting factual results from a reality TV episode transcript.
Read the transcript and output a JSON array of events. Each event has:
- "eventType": a short lowercase snake_case label (e.g. "eliminated", "won_challenge", "won_immunity")
- "contestantName": the contestant's name as it appears in the transcript
- "description": one sentence describing what happened

Only include events that are clearly stated as having happened. Output ONLY the JSON array, no other text.

Transcript:
${transcript}`,
  })
  return parseSuggestedEvents(text)
}
