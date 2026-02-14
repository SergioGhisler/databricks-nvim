# Oncology Learning App (V1)

Local single-user **veterinary oncology** internship/residency learning app.

## Scope (V1.1)
- Oncology-only topic mastery dashboard (0-100)
- XP + streak gamification
- Daily review plan (auto-prioritized by low mastery)
- Quiz mode (MCQ + short answer with immediate feedback)
- Explain-why mode (clinical rationale + common mistake)
- Difficulty toggle (Intern / Resident)
- Topic-focused quiz selector (all or single oncology topic)
- Oncology case review templates
- Admin ingest script for local notes/PDF extracts -> structured JSON KB
- English only
- No login/account (single-user)

## Quick Start
```bash
cd /Users/Alyx/.openclaw/workspace/oncology-learning-app
npm install
npm run start
```
Open:
- Local: `http://localhost:4040`

## Quiz Usage (V1.1)
In Quiz Mode you can now:
- Select **Topic** (`All oncology topics` or a specific topic like mast cell, lymphoma, osteosarcoma)
- Select **Difficulty**:
  - `Intern` = intern-tagged questions
  - `Resident` = intern + resident-tagged questions with deeper feedback cues
- Toggle **Explain-why mode** to include concise:
  - Clinical rationale
  - Common mistake

Feedback behavior remains immediate:
- MCQ: correct/incorrect + highlighted correct option
- Short answer: pass/partial/fail + model answer + explanation
- Score updates live and `Next Question` resets state cleanly

## Tailscale Sharing
This app is designed for private Tailscale-only sharing.

Run server on your node, then access from another Tailscale device:
- `http://<your-tailscale-ip>:4040`

Optional hardening: firewall allow port 4040 only on `tailscale0` interface.

## Data Files
- Seed KB: `data/kb.json`
- Generated KB output: `data/kb.generated.json`
- Raw ingest input folder: `content/raw/`

## Admin Content Ingestion
Use local book notes or PDF extracts converted to `.txt` / `.md` / `.json` in `content/raw/`.

Run:
```bash
npm run ingest
```

This generates:
- `data/kb.generated.json`

To use generated content in V1 quickly:
1. Review `data/kb.generated.json`
2. Copy/merge into `data/kb.json`
3. Refresh browser

## Input Template Example (`content/raw/*.txt`)
```text
TOPIC: Canine lymphoma staging

QUIZ-MCQ: Which stage generally implies marrow involvement?
- Stage II
- Stage V
ANSWER: Stage V
EXPLAIN: ...

QUIZ-SHORT: Name two chemo toxicities.
KEYWORDS: neutropenia, gastrointestinal toxicity
EXPLAIN: ...

CASE: Feline lymphoma workup template
- signalment
- staging
- protocol selection
```

## V2 TODO (clear next steps)
1. Add structured topic taxonomy (tumor type, species, modality)
2. Add spaced-repetition scheduler per topic/question
3. Add adaptive difficulty engine (performance-based auto level, not manual only)
4. Add richer case authoring + export to PDF
5. Add deterministic ingest validation + schema checks
6. Add oncology protocol calculators and toxicity grading tools
7. Add study analytics timeline (weekly/monthly)
8. Add optional local semantic retrieval backend (still no public exposure)
9. Add explain-why authoring QA checks to enforce rationale quality in imported content

## Notes
- Browser localStorage stores progress (`xp`, `streak`, mastery updates)
- No authentication by design (single user)
- V1 intentionally lightweight for fast iteration
