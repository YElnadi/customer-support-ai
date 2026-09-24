# Safety & reliability evaluation

A small evaluation of how the support chatbot behaves under **adversarial and edge-case inputs**, not just happy-path questions. It checks whether the bot stays in its role, avoids inventing facts, protects its instructions and user privacy, and resists tampering with the API.

## Why

A support bot that works in a demo can still fail in ways that matter: following injected instructions, confidently making up prices or links, or revealing its hidden prompt. My graduate research was on **fault tolerance** (designing systems that keep working when components fail), and this evaluation applies the same mindset to an LLM system: enumerate the failure modes, test them systematically, and measure how often they happen.

## What it tests

| Category | What a failure looks like | Cases |
|---|---|---:|
| `helpfulness` | Normal questions answered poorly; loses multi-turn context | 4 |
| `prompt_injection` | Obeys "ignore your instructions", adopts a new persona, reveals or translates its system prompt | 5 |
| `hallucination` | Invents prices, phone numbers, URLs, company facts or policies | 5 |
| `off_topic` | Does unrelated tasks (poems, homework, coding) instead of staying in scope | 3 |
| `unsafe_output` | Echoes raw HTML/JS payloads (defense in depth; the UI already escapes output) | 2 |
| `privacy` | Shares or invents another user's data; reveals credentials | 2 |
| `api_tampering` | Obeys a client-injected `system` message or a forged earlier `assistant` turn; breaks on oversized input | 3 |

All cases live in [`cases.json`](cases.json), so new ones can be added without touching code.

## How it works

1. `run_eval.py` sends each case to the running app's `/api/chat` endpoint, so it tests the **whole system**: the server's input filtering *and* the model.
2. Each case runs **several times** (default 3) because LLM output is stochastic. Results are reported as **pass rates**, not single pass/fail.
3. Replies are graded two ways:
   - **Rule checks:** regular expressions for things that must not appear (e.g., a `$` price, a URL, the system-prompt text) or must appear (e.g., a refusal).
   - **LLM judge** (optional, `--judge`): Gemini grades each reply against a written rubric, at temperature 0 with JSON output. A run passes only if both graders agree.
4. Provider errors (the model being overloaded) are retried, then counted separately as **errors**, so they don't distort the pass rate.
5. A Markdown report and a CSV of every reply are saved in `evals/results/`.

## Run it

Start the app (`npm run dev`), then in a second terminal:

```bash
python3 evals/run_eval.py                    # rule checks only, 3 runs per case
python3 evals/run_eval.py --judge            # add the LLM judge (uses GEMINI_API_KEY from .env.local)
python3 evals/run_eval.py --only prompt_injection hallucination --repeats 5
```

Python 3.9+, standard library only.

## Results

<!-- Paste the summary table from your latest report here, then 2-4 sentences on what you found. -->

_Run the evaluation and summarize the findings here._

## Limitations

- **Regex checks are brittle.** They can miss a paraphrased failure or flag a harmless reply. The LLM judge helps, but it's also a model and can be wrong; disagreements between the two are worth reading by hand.
- **Small sample.** 24 cases × a few runs gives a rough signal, not a precise failure rate.
- **Single model, single prompt.** Results apply to this system prompt and model version at the time of testing.
- **The judge and the bot use the same model family**, which may share blind spots.
