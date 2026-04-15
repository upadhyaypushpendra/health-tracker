/**
 * Extracts and parses a JSON object from a string that may contain
 * markdown code fences, prose, or other non-JSON content.
 */
export function extractJson(text: string): unknown {
  let cleaned = text.trim()
  const codeMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeMatch) cleaned = codeMatch[1].trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in response')
  return JSON.parse(cleaned.slice(start, end + 1))
}
