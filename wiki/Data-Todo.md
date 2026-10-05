# Data to-do (pinned 2026-10-03)

The running list of data work agreed with the user. Strike items as they land and note the
date; the rules behind each one live in [Data](Data.md).

## In flight
- [x] Second split pass (70 rows → 84 children): classified, translated, crowds corrected, shipped (2026-10-03).

## Tail cut (temporary)
- [ ] `server.py` drops every row dated after ACLED's last day (`last_acled`, 2026-07-03 today) —
      633 Fortress rows are off the site **for now only**. Every pipeline step (actor, split,
      type, Hebrew, English, Arabic, crowd) still runs over them so they are ready the day the
      cut is lifted. Lifting it = removing the `last_acled` check, not re-processing.

## Completeness
- [x] **Every shipped event must carry actor, date, Hebrew description, event type and a crowd
      field** — crowd may be "unknown", but the field exists and is deliberate, never an
      accident of a missing column. Today: actor/date/type/desc complete; crowd known on
      ~3,000 of ~12,400.
- [x] Crowd for the rest — `05_extract_crowd.py`, 2026-10-03: 4,697 rows sent, 817 new figures (479 ACLED, 338 Fortress), 3,880 `no report`, 9,439 cue-less ACLED blanks marked `no report` by rule. Every live row now has a deliberate crowd value.
- [x] **Fortress Hebrew** is the log's terse line ("בתים הותקפו"). Rewrite every Fortress row in
      the ACLED-derived Hebrew register: past tense, the actor named explicitly ("מתנחלים תקפו
      בתים ב…"), place kept, same length as the ACLED Hebrew rows.
      → `06_rewrite_fortress_desc.py`, queued 2026-10-03 behind the crowd run (2,352 rows); writes
      the English line in the same call. Then: sample review, restart, commit.
- [x] **English is far too long** — step 07 done 2026-10-04: every shipping row has `description_en_short` (median 1.35× its Hebrew, max 380 chars). Shorten every English description to the
      Hebrew length — same facts as the Hebrew, nothing more.
- [x] **Fortress → English**: the English page shows Hebrew tooltips for Fortress rows — covered by step 06 above.
- [x] **Arabic for every event** — `description_ar` on every shipping row (step 07, 2026-10-04); server writes `events-ar.json`, page7 loads it on ar/.
- [x] Hebrew terminology pass (2026-10-03, user's calls): משתמטים/השתמטות → עריקים/עריקות everywhere; ASCII `"` → ״; המהפכה המשפטית → הרפורמה המשפטית (both translated ACLED's "overhaul"); כיכר אל־קודס (Tamra) kept — a place name. ערבים־ישראלים → ערבים ישראלים.

## Classification
- [ ] **244 Fortress rows un-hidden (2026-10-04)**: they were hidden as `dup of row-N`, but row-N is an ACLED row that never ships (PLO-only or hidden), so the event vanished from both sources. Rule now: a Fortress duplicate is hidden only when its ACLED match ships. The note is in `dedupe_note` («kept 2026-10-04»); backup in `_xlsx-archive/`. They need step 02 (164 rows), 05 (164), 06 (all 244) and 07 (all 244); `server.py` holds back any row with no `event_type` or an un-rewritten Fortress line, so they ship by themselves once processed. Restart + commit `events.json` after.
- [x] Commit `events.json` / `events-en.json` + today's scripts, server and wiki (site is stale).
- [x] Prompt check before the rerun (2026-10-04): 190 stratified ACLED rows run live; user ruled on block+clash, police clashes, counter-protesters, abduction vs in-place detention, road paving — all in the 02 prompt.
- [x] Dot flagging round 1 (2026-10-04): pogrom crowd threshold raised to 30+ (a stated 15/20 or no size is not a crowd); 5 live pogroms reclassified by hand (rows 8668, 9523, 11015, 13442, 18628). 20 pogroms remain.
- [x] Dot flagging round 2 (2026-10-04): עימותים / confrontations / scuffles without a described assault are הפרות סדר, not תקיפה פיזית; protesters who were attacked keep their own conduct; one participant's act ≠ the crowd's. 7 rows set by hand (13, 42, 1253, 1707, 3253, 4630, 4667).
- [x] Dot flagging round 3 (2026-10-04): fireworks, firecrackers, flares, torches or Molotovs launched/thrown AT A PERSON are תקיפה בנשק חם (were קר); rows 19276, 19391 set by hand; fireworks fired during a riot/clash with police count as at them — rows 940, 948, 954, 955, 2245, 6317, 19195 → חם; 4773 (set off while chasing people) stays קר.
- [x] Abduction wording (2026-10-04): in החזקה בכפייה events, detained → החזיקו בכפייה (never עיכבו); abducted → חטפו only when the place or manner is given, else לקחו בכפייה. 36 of 40 Hebrew + Arabic lines updated; rule in 03, 06 and 07 prompts.
- [x] Pogrom standard (2026-10-04): big crowd with stated size + Palestinians hurt/killed by the main actor + named fire + concrete detail, all four; 22 pogroms reclassified by hand, 16 kept and stamped. In the 02 prompt.
- [x] 244 un-hidden Fortress rows whose ACLED twin was PLO-only (2026-10-05): switched to the ACLED rows instead — 230 ACLED rows marked `corroborated_by`, now ship and went through steps 02, 05 and 07; the 244 Fortress copies are hidden again as their duplicates. Site 12,053 → 12,283; methodology counts updated.
- [x] **Second pass of step 02** (2026-10-04, `RERUN_ALL=1`): 12,332 rows re-sent; old value kept in `event_type_prev` where it changed. Review: bulldozing without a road is פגיעה ברכוש, Molotovs at inhabited houses / fire on an occupied car are תקיפה בנשק חם — prompt fixed, 116 rows re-run, 3 set by hand.
- [x] The 342 `unsure` Fortress↔ACLED pairs — second reading 2026-10-03 (`_dedupe/pass2/`): 298 sure (hidden `dup of row-N`), 44 distinct (stay live); the last 11 decided by the user.
- [x] Internal Fortress duplicates (2026-10-04, `_dedupe/fint/`): live Fortress rows grouped by place ±1 day (273 groups), read by 6 readers — 63 duplicate sets, 87 rows hidden as `fortress dup of row-N` (most detailed row kept).
- [x] Flagged Fortress rows (2026-10-03): 55 settled by the existing rules, 15 by the user. User rule: an act done by soldiers, a regional-defence (גמ״ר) soldier or a settlement guard — even with settlers along or at their request — is `not relevant` (army act, off the site); a רבש״ץ who shoots stays `settlers`. Refined the same day: settlers WITH soldiers, settlers-then-soldiers, and a guard alone stay `settlers`; "soldiers known as settlers" are `not relevant` (10 rows).

## Methodology copy (its own task)
- [x] `methodology.html` — the full write-up, prompts injected by `build_methodology.py`; linked from the legend note and the @fold16 credits (2026-10-04).
- [ ] The @fold6 card («תיאורי האירועים … לקוחים ברובם ממאגר ACLED…»), the legend note
      (`FOLD6_NOTE_TEXT`, js/groups.js) and the @fold16 credits still describe an ACLED-only
      dataset. Rewrite to name the Fortress log as the second source, say that its lines were
      rephrased (step 06) and that duplicates were removed in ACLED's favour, and that crowd
      sizes / descriptions were shortened and translated with OpenAI. Hebrew first, then a
      Translation-Pending row; English and Arabic follow.
