#!/bin/zsh
# Weekly ACLED refresh — what launchd runs (com.bothsides.refresh-weekly, Wednesdays 09:00).
# fetch → pipeline (01–07, json rebuild) → review issue on GitHub (notify.py).
# Tiud (the Fortress gatherer) is NOT here — monthly, by hand for now; see wiki/Data.md.
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"   # the python3 that has openpyxl/openai/requests
cd "${0:a:h}" || exit 1
echo "==== $(date) weekly refresh"
python3 -u 00_fetch_acled.py && python3 -u run_pipeline.py
