#!/usr/bin/env python3
"""Inject the seven pipeline prompts into methodology.html, en/methodology.html and
ar/methodology.html, verbatim.

Each of the three pages carries one marker pair per script:
    <!-- prompt:0N_name.py --><pre lang="en" dir="ltr">…</pre><!-- /prompt -->
This rewrites what sits between each pair with the HTML-escaped INSTRUCTIONS
string read from that script, so the public appendix can never drift from the
prompts actually sent. Run after any 0N_*.py prompt edit:
    python3 build_methodology.py
"""
import html
import re
import sys

PAGES = ["methodology.html", "en/methodology.html", "ar/methodology.html"]
MARK = re.compile(r"(<!-- prompt:([^ ]+?) -->)(.*?)(<!-- /prompt -->)", re.S)


def read_prompt(path):
    src = open(path, encoding="utf-8").read()
    m = re.search(r'INSTRUCTIONS = r"""(.*?)"""', src, re.S)
    if not m:
        sys.exit(f"{path}: no INSTRUCTIONS block")
    return m.group(1).strip("\n")


def main():
    for page_path in PAGES:
        build(page_path)


def build(PAGE):
    page = open(PAGE, encoding="utf-8").read()
    n = 0

    def sub(m):
        nonlocal n
        n += 1
        # lang/dir: the prompts are English inside a Hebrew/Arabic page (WCAG 3.1.2).
        return f'{m.group(1)}<pre lang="en" dir="ltr">{html.escape(read_prompt(m.group(2)))}</pre>{m.group(4)}'

    out = MARK.sub(sub, page)
    if out != page:
        open(PAGE, "w", encoding="utf-8").write(out)
        print(f"{PAGE}: {n} prompts rewritten")
    else:
        print(f"{PAGE}: {n} prompts already current")


if __name__ == "__main__":
    main()
