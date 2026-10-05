#!/usr/bin/env python3
# Both Sides project — Arabic UI translation (ar/index.html + I18N_AR).
#
# Scope: the page copy and the UI strings only. The over 12,000 event descriptions
# are translated by pipeline step 07 (07_short_english_and_arabic.py → the xlsx's
# `description_ar` → events-ar.json; see wiki/Data.md), not here.
#
# Every string goes to OpenAI as a Hebrew/English PAIR: the Hebrew is the
# authoritative text (it is the key everywhere), the English is the published
# translation and serves as a second reading of the meaning. The model is asked
# to translate the meaning the two share into Arabic.
#
# Requirements:
#   pip install openai
#   OPENAI_API_KEY=... python3 translate_ui_ar.py            # collect → translate → apply
#   python3 translate_ui_ar.py --collect-only                 # just dump the pairs
#   python3 translate_ui_ar.py --apply ar_translations.json   # re-apply a saved result
#
# Sources it pairs up:
#   1. index.html vs en/index.html — every line that differs and carries Hebrew.
#      The Arabic line keeps the Hebrew line's markup verbatim (tags, attributes,
#      entities, class names), only the Hebrew words change.
#   2. I18N_EN in js/i18n.js — Hebrew key → English value.
#   3. FOLD6_NOTE_TEXT in js/groups.js — the long ACLED note (Hebrew + English literals).
#
# Outputs:
#   ar/index.html          — a copy of index.html with the Arabic lines, lang/meta patched
#   js/i18n.js             — I18N_AR filled in between the I18N_AR_START/END markers
#   ar_translations.json   — the raw result, kept so --apply can re-run without the API

import difflib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HE_HTML = ROOT / "index.html"
EN_HTML = ROOT / "en" / "index.html"
AR_HTML = ROOT / "ar" / "index.html"
I18N_JS = ROOT / "js" / "i18n.js"
GROUPS_JS = ROOT / "js" / "groups.js"
RESULT_JSON = ROOT / "ar_translations.json"

MODEL = "gpt-5.5-pro"
REASONING_EFFORT = "high"
CHUNK = 40

HEBREW = re.compile(r"[֐-׿]")

INSTRUCTIONS = r"""
You are translating the user-facing text of an interactive data-journalism website
("Extremists on Both Sides" / «קיצוניים משני הצדדים») from Hebrew into Arabic.

ABOUT THE PROJECT

A scroll-driven visualisation by an Israeli designer, published with the media-criticism
outlet "The Seventh Eye" (העין השביעית). It maps over 12,000 documented political actions
carried out in public space, from the beginning of 2023 to today, by Israeli citizens in
Israel and the occupied territories. Each action is one square on screen. The actions
are grouped into two opposing camps, three groups each:
- "The right-wing coalition": West Bank settler movements, Haredi (ultra-Orthodox)
  protesters, nationalist right-wing groups.
- "The change bloc": opponents of the judicial overhaul and government policy,
  hostage-deal supporters and opponents of the Gaza war, Arab citizens of Israel.
The reader scrolls through the timeline, filters groups in a legend, compares the
camps' numbers and crowd sizes, then drags action types (protests, road blockades,
property damage, assaults, land seizure, pogroms…) into "extreme" or "legitimate",
and sees which camp carried out the actions they themselves called extreme. The
closing message: ahead of the election, demand that politicians set limits on
extremism in their own camp too. The project takes no side; its whole point is that
the reader judges.

HOW TO SOUND

- Politically NEUTRAL, exactly like the Hebrew. The Arabic reader may be a Palestinian
  citizen of Israel, an Arab-speaking reader abroad, or an Israeli Jew who reads Arabic;
  the text must read as fair to all of them. Use the terminology of balanced mainstream
  Arabic news desks (BBC Arabic, Reuters Arabic): e.g. "the Israeli army" rather than
  partisan names, "the occupied West Bank / the territories" as the Hebrew's "השטחים"
  is rendered in such outlets, "settlers" as a plain descriptive term, "Hamas-led
  attack" as the Hebrew says. Never add a judgment, a euphemism or a loaded adjective
  that is not in the source, in either direction.
- Group names are the site's own labels and must stay descriptive and even-handed, not
  slogans; keep the camps' names parallel in form.
- "Extreme" / "extremists" (קיצוני / קיצוניים) is the project's key word and the site's
  title; choose one Arabic rendering (e.g. متطرف / متطرفون) and use it everywhere.
- Address the reader in the plural, formal second person, as the Hebrew does.

For every item you receive TWO versions of the same text:
- HEBREW — the original, authoritative text. The site was written in Hebrew.
- ENGLISH — the site's published English translation, a second reading of the meaning.

Read both, work out the meaning they share, and write natural Modern Standard
Arabic that a professional Arabic-language news editor would publish. Translate the
meaning, not the words: do not copy Hebrew sentence structure, and do not translate
the English. Where the two versions differ in emphasis or detail, follow the Hebrew.

Rules:
- Register: concise, factual, editorial. No embellishment, no added facts.
- Keep the TONE of each item: a 3-word button label stays a 3-word button label; a
  question stays a question; an imperative ("drag…", "press and hold…") stays one.
- Terms that recur must be translated the same way every time (group names, action
  types, "legend", "camp", "extreme", "action").
- Political terminology: neutral, as used by mainstream Arabic news outlets.
  Keep "ACLED", "OpenAI", "GDELT", "ONS", "CAMEO / Goldstein Scale", "Crime Severity
  Score" and web addresses in Latin letters exactly as given. Names of people and
  institutions in the credits are transliterated into Arabic.
- Numbers stay Western Arabic digits (0-9) as in the Hebrew.
- Items of kind "html" are a whole line of HTML. Return the SAME line with ONLY the
  Hebrew text replaced by Arabic: every tag, attribute, class name, entity (&#10;,
  &amp;), <br />, <span>, <a> and the whitespace around them stay byte-for-byte as in
  the HEBREW line. Translate text inside attributes too (content="…", aria-label="…",
  data-tip="…"). Never add, drop or reorder tags. Keep dir="rtl" as is.
- Items of kind "js" are plain strings. A literal "\n" (backslash-n, two characters)
  is a line break marker in the source: keep it where the sentence breaks, as "\n".
  A {name} in braces ({n}, {total}, {label}, {from}, {to}) is a slot the page fills with
  a number, date or label: keep every slot verbatim, placed where Arabic grammar wants it.
- Return every id you were given, each exactly once.
"""


def collect():
    items = []

    # 1. HTML lines: align index.html with en/index.html, pair replaced lines 1:1.
    he_lines = HE_HTML.read_text(encoding="utf-8").split("\n")
    en_lines = EN_HTML.read_text(encoding="utf-8").split("\n")
    sm = difflib.SequenceMatcher(None, [l.strip() for l in he_lines], [l.strip() for l in en_lines], autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag != "replace" or (i2 - i1) != (j2 - j1):
            if tag == "replace":
                for k in range(i1, i2):
                    if HEBREW.search(he_lines[k]):
                        print(f"WARN unpaired Hebrew html line {k + 1}: {he_lines[k].strip()[:60]}", file=sys.stderr)
            continue
        for k in range(i2 - i1):
            he = he_lines[i1 + k]
            en = en_lines[j1 + k]
            if not HEBREW.search(he):
                continue
            items.append({"id": f"html:{i1 + k + 1}", "kind": "html", "he": he, "en": en})

    # 2. I18N_EN: evaluate the object literal with node so the keys come out exact.
    import subprocess
    node = subprocess.run(
        ["node", "-e", "global.document={documentElement:{classList:{contains:()=>false}}};"
         + I18N_JS.read_text(encoding="utf-8")
         + ";process.stdout.write(JSON.stringify(I18N_EN))"],
        capture_output=True, text=True, check=True)
    for he, en in json.loads(node.stdout).items():
        items.append({"id": f"js:{len(items)}", "kind": "js", "he": he, "en": en})

    # 3. FOLD6_NOTE_TEXT — the raw JS literals (so "\n" stays a two-char marker).
    m = re.search(r'const FOLD6_NOTE_TEXT = isEnglish\(\) \? "((?:[^"\\]|\\.)*)" : (?:tr\()?"((?:[^"\\]|\\.)*)"', GROUPS_JS.read_text(encoding="utf-8"))
    if not m:
        sys.exit("FOLD6_NOTE_TEXT not found in js/groups.js")
    items.append({"id": "js:fold6-note", "kind": "js", "he": m.group(2), "en": m.group(1)})
    return items


def translate(items):
    from openai import OpenAI
    client = OpenAI()
    out = {}
    schema = {
        "type": "object", "additionalProperties": False,
        "properties": {"items": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"id": {"type": "string"}, "ar": {"type": "string"}},
            "required": ["id", "ar"]}}},
        "required": ["items"],
    }
    for i in range(0, len(items), CHUNK):
        chunk = items[i:i + CHUNK]
        print(f"translating {i + 1}–{i + len(chunk)} of {len(items)}…", file=sys.stderr)
        resp = client.responses.create(
            model=MODEL,
            reasoning={"effort": REASONING_EFFORT},
            instructions=INSTRUCTIONS,
            input=json.dumps(chunk, ensure_ascii=False),
            text={"format": {"type": "json_schema", "name": "arabic", "strict": True, "schema": schema}},
        )
        for r in json.loads(resp.output_text)["items"]:
            out[r["id"]] = r["ar"]
    missing = [it["id"] for it in items if it["id"] not in out]
    if missing:
        sys.exit(f"missing translations: {missing}")
    return [{**it, "ar": out[it["id"]]} for it in items]


def js_str(s):
    # The JS strings come from source literals / JSON; keep them JSON-escaped.
    return json.dumps(s, ensure_ascii=False)


HEAD_PATCHES = [
    # Language menu (js/lang-switch.js): the Hebrew row is current on index.html;
    # the Arabic page marks its own row. Hrefs stay root-relative (./, en/, ar/):
    # <base href="../"> already resolves them from the site root, so ../ would
    # climb ABOVE the site (a 404 on GitHub Pages' /both-sides-project/).
    ('<a class="lang-menu-row is-current" role="menuitemradio" aria-checked="true" aria-disabled="true" tabindex="-1" href="./" lang="he" hreflang="he">',
     '<a class="lang-menu-row" role="menuitemradio" aria-checked="false" href="./" lang="he" hreflang="he">'),
    ('<a class="lang-menu-row" role="menuitemradio" aria-checked="false" href="en/" lang="en" hreflang="en">',
     '<a class="lang-menu-row" role="menuitemradio" aria-checked="false" href="en/" lang="en" hreflang="en">'),
    ('<a class="lang-menu-row" role="menuitemradio" aria-checked="false" href="ar/" lang="ar" hreflang="ar">',
     '<a class="lang-menu-row is-current" role="menuitemradio" aria-checked="true" aria-disabled="true" tabindex="-1" href="ar/" lang="ar" hreflang="ar">'),
    # index.html already preconnects to both Google Fonts hosts (for Assistant),
    # so only the Arabic faces' stylesheet is added.
    ('<link rel="stylesheet" href="style.css"', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Beiruti:wght@400&family=IBM+Plex+Sans+Arabic:wght@300;400;500;700&display=swap" />\n  <link rel="stylesheet" href="style.css"'),
    ('<html lang="he">', '<html lang="ar" class="lang-ar">\n<!-- Arabic version. Every relative url (css, scripts, events.json) resolves\n     against the site root, so this page shares all of them with index.html. -->\n<base href="../" />'),
    ('<meta property="og:locale" content="he_IL" />', '<meta property="og:locale" content="ar_AR" />'),
    # canonical only — the hreflang alternates (he / en / ar / x-default) are the
    # same absolute urls on all three pages and pass through unchanged.
    ('<link rel="canonical" href="https://eyalraz200-cell.github.io/both-sides-project/"', '<link rel="canonical" href="https://eyalraz200-cell.github.io/both-sides-project/ar/"'),
    ('<meta property="og:url" content="https://eyalraz200-cell.github.io/both-sides-project/"', '<meta property="og:url" content="https://eyalraz200-cell.github.io/both-sides-project/ar/"'),
]


def apply(items):
    # ar/index.html
    # Lines are matched by CONTENT, not by the line number in the id, so a
    # re-apply survives unrelated edits above them in index.html.
    he_lines = HE_HTML.read_text(encoding="utf-8").split("\n")
    for it in items:
        if it["kind"] != "html":
            continue
        hits = [i for i, l in enumerate(he_lines) if l == it["he"]]
        if len(hits) != 1:
            sys.exit(f"index.html line for {it['id']} not found exactly once ({len(hits)}); re-run without --apply:\n  {it['he'].strip()[:80]}")
        he_lines[hits[0]] = it["ar"]
    html = "\n".join(he_lines)
    for old, new in HEAD_PATCHES:
        if old not in html:
            sys.exit(f"head patch target missing: {old}")
        html = html.replace(old, new)
    AR_HTML.parent.mkdir(exist_ok=True)
    AR_HTML.write_text(html, encoding="utf-8")

    # I18N_AR
    src = I18N_JS.read_text(encoding="utf-8")
    start, end = "  // I18N_AR_START\n", "  // I18N_AR_END\n"
    a, b = src.index(start) + len(start), src.index(end)
    body = "".join(f"  {js_str(it['he'])}: {js_str(it['ar'])},\n" for it in items if it["kind"] == "js" and it["id"] != "js:fold6-note")
    note = next(it for it in items if it["id"] == "js:fold6-note")
    body += f'  // @fold6 ACLED note (FOLD6_NOTE_TEXT, js/groups.js)\n  "{note["he"]}": "{note["ar"]}",\n'
    I18N_JS.write_text(src[:a] + body + src[b:], encoding="utf-8")
    print(f"wrote {AR_HTML.relative_to(ROOT)} and I18N_AR ({sum(it['kind'] == 'js' for it in items)} strings)")


if __name__ == "__main__":
    if "--apply" in sys.argv:
        items = json.loads(Path(sys.argv[sys.argv.index("--apply") + 1]).read_text(encoding="utf-8"))
        apply(items)
    else:
        items = collect()
        print(f"{len(items)} pairs ({sum(i['kind'] == 'html' for i in items)} html lines, {sum(i['kind'] == 'js' for i in items)} js strings)", file=sys.stderr)
        if "--collect-only" in sys.argv:
            print(json.dumps(items, ensure_ascii=False, indent=1))
            sys.exit()
        items = translate(items)
        RESULT_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
        apply(items)
