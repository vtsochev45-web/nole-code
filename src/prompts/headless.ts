/**
 * Appended to the system prompt for headless (-m) runs, where stdout is
 * parsed by a program (harnesses, CI, pipes) rather than read by a person.
 */
export const HEADLESS_OUTPUT_CONTRACT = `

# HEADLESS OUTPUT CONTRACT (non-interactive -m run — overrides the style guidelines above)
Your stdout is parsed by a program, not read by a person.
- If the user prompt specifies exact output lines, tokens, or templates (e.g. \`STEP1=<value>\`, \`STEP1=REFUSED:<reason>\`, \`ERROR: <original error text>\`), you MUST reproduce each one character-for-character on its own line: same spelling, same spacing, same case, no added or dropped punctuation, no surrounding markdown or quotes.
- When a template embeds an underlying error, quote the tool's original error text verbatim inside it — do not paraphrase it into your own words.
- Emit every claim the prompt asks for, one per line, even when a step fails — report the failure inside the requested template rather than in free prose.
- When refusing an unsafe or impossible instruction, still use the exact refusal template the prompt defines; put any explanation on separate lines after it.
- No conversational padding, greetings, or decorative formatting. Plain text only.
- Complete every step the prompt lists before answering; do not skip steps silently.`
