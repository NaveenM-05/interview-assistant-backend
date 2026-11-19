# Verified warm-up (explain first, then code)

Before the coding interview for a DSA topic, the candidate explains a problem from that
topic out loud. The explanation is graded with the pipeline from our CSCT 2026 paper
(Paper 259). Scoring **70% or more** on any warm-up question in a topic unlocks that
topic's coding interview on the Setup page. The aim is to build confidence in the idea
before writing code.

* The LLM only **extracts** the approach and the stated time/space complexity (or the STAR
  parts), each with a verbatim quote from the answer. A field whose quote is not found in
  the answer is dropped (`ia/grounding.py`).
* A **deterministic rule engine** grades the extraction against a fixed rubric
  (`ia/rules.py`, `data/rubric/`): verdict, score out of 10 (approach 4, time 4, space 2),
  and up to 2 follow-up questions.
* Topics with no warm-up questions (Strings, Queues, Tries, Backtracking, 2D DP,
  Bit Manipulation, Math & Geometry) are never locked.
* Behavioral (STAR) warm-ups are available for practice but don't lock anything.
* If the warm-up backend can't be reached, the gate **fails open**: coding stays available.

## Files

| File | What it is |
|---|---|
| `ia/` | Grading core copied from the research code |
| `data/rubric/` | 20 DSA problems with rubric + behavioral questions |
| `verified_service.py` | Grading + unlock logic (no FastAPI/DB imports; unit-tested) |
| `verified_store.py` | Own table `verified_attempts` (existing tables are not touched) |
| `verified_router.py` | `GET /api/verified/questions`, `GET /api/verified/progress/{user_id}`, `POST /api/verified/assess` |
| `test_verified.py` | Offline tests: `python -m pytest test_verified.py -q` |
| `frontend/src/pages/VerifiedPractice.jsx` | The warm-up page (`/verified`) |
| `frontend/src/components/verified/TopicGate.jsx` | Lock / unlocked banner on the Setup page |
| `frontend/src/hooks/useTopicGate.js` | Loads which topics are unlocked |
| `frontend/src/lib/verifiedApi.js` | API calls for the warm-up |

Small edits to existing files: `main.py` (mount the router), `App.jsx` (route),
`NavBar.jsx` (link), `Setup.jsx` (lock badge, gate banner, disabled Generate button
for locked topics, `?topic=` preselect).

## Configuration (optional, in `.env`)

Uses the existing `GEMINI_API_KEY` with `gemini-2.5-flash`. Overrides:

```
VERIFIED_UNLOCK_THRESHOLD=0.7
VERIFIED_LLM_MODEL=gemini-2.5-flash
VERIFIED_LLM_API_KEY=...         # defaults to GEMINI_API_KEY
VERIFIED_LLM_TIMEOUT_S=45
```

The rubric has not been reviewed by faculty; an approach it doesn't list is marked
"Needs human review" rather than wrong.
