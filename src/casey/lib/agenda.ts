// Casey's gameday agenda — rule-based natural-language normalizer.
//
// The admin types the agenda as free text (a paragraph, or one item per line).
// parseAgenda() turns it into discrete events, each rendered as a card in the
// Agenda modal. This is intentionally a single pure function so it can later be
// swapped for / augmented by an LLM pass (e.g. Anthropic) without touching the
// UI: the modal only depends on AgendaEvent[].

export interface AgendaEvent {
  /** Normalized time chip, e.g. "9AM", "2:30PM", "NOON". Optional. */
  time?: string;
  /** The activity text. */
  text: string;
}

// Matches "9am", "8:30 pm", "3 PM", "14:00", and the wordy ones.
const TIME_RE =
  /\b(\d{1,2}:\d{2}\s?(?:am|pm)|\d{1,2}\s?(?:am|pm)|\d{1,2}:\d{2}|noon|midnight|morning|afternoon|evening|night|tonight)\b/i;

function splitIntoChunks(text: string): string[] {
  // Prefer explicit line breaks (the recommended way to author it).
  if (/\n/.test(text)) return text.split(/\n+/);
  // Otherwise break a flowing paragraph on sentence/clause boundaries.
  return text.split(/(?:[.!;]+\s+)|(?:,?\s+(?:then|and then|after that|followed by)\s+)/i);
}

function normalizeTime(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase(); // "8 pm" -> "8PM", "noon" -> "NOON"
}

export function parseAgenda(raw: string | null | undefined): AgendaEvent[] {
  if (!raw || !raw.trim()) return [];
  const events: AgendaEvent[] = [];

  for (let chunk of splitIntoChunks(raw.trim())) {
    // Strip leading bullets / numbering / dashes and trailing punctuation.
    chunk = chunk
      .replace(/^[\s\-–—•*]+/, '')
      .replace(/^\d{1,2}[.)]\s+/, '')
      .replace(/[\s.]+$/, '')
      .trim();
    if (!chunk) continue;

    const m = chunk.match(TIME_RE);
    let time: string | undefined;
    let body = chunk;
    if (m) {
      time = normalizeTime(m[0]);
      // Remove the matched time and the little words/separators around it.
      body = chunk
        .replace(m[0], '')
        .replace(/\b(at|around|by|@|from)\b/gi, ' ')
        .replace(/^[\s\-–—:,@]+|[\s\-–—:,@]+$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    if (body) body = body.charAt(0).toUpperCase() + body.slice(1);
    events.push({ time, text: body || chunk });
  }

  return events;
}
