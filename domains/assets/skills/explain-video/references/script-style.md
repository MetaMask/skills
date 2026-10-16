# Script Style for Spoken Narration

The script has two style options. Choose **Natural** by default, or **Strict STE100** when requested.

## Option 1: Natural (Default)

The voice should sound like a colleague explaining their own work.

- **Write for the ear:** Contractions are fine.
- **Vary sentence length:** Most sentences run about 12–25 words, with an occasional short one for emphasis. Don't write a run of equally short sentences.
- **Open each scene with why it matters:** State why it matters or what problem it answers, not a description of the screen. Vary the openers and use simple transitions ("Next," "The tricky part is", "Once that's in place").
- **Explain reasoning:** Why this approach, the alternative, the edge case, what could break. Connect facts with "because", "so", and "which means".
- **Visual complement:** The voice may add reasoning or a short trade-off remark that isn't on screen. It must never conflict with the screen and never state an invented fact.
- **Don't read the screen aloud:** The voice adds meaning, and the visual shows the evidence.
- **Identifiers:** `spoken` is already expanded, so `onAfterChange` is said "on after change" while the screen shows `SectionHeader`'s real spelling in `display`. Say `id` as eye-dee. Do the read-back on `spoken`.
- **Clarity rules:** Keep the same word for the same thing, define a technical term on first use, use the active voice, and use no jokes, metaphors as explanation, or rhetorical questions.
- **Kokoro pacing chunks:** Write spoken chunks of about 75–150 words (100–200 tokens) because Kokoro is weak on very short lines and rushes on long ones. Merge short beats and split long ones.
- **Read-back check:** Before showing the script, read it back once. If three sentences in a row start the same way or are all under 8 words, rewrite them.

## Option 2: Strict STE100 (Optional)

Use only if requested, or if the audience is non-native or the content is safety-critical. On-screen text is a short label, not a sentence.

- One fact per sentence.
- Use the active voice and a human subject when you can.
- Keep the same word for the same thing. Do not swap in a synonym.
- Define a technical term the first time you say it. Then use that term only.
- Prefer short sentences. Split a sentence that has "and" joining two facts.
- Do not use a metaphor, a joke, or a question as the explanation.
- If you are not sure a word is approved, ask the user. Do not replace it with a longer phrase to hide the doubt.
