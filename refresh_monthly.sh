#!/bin/zsh
# Monthly Fortress (Tiud) refresh — what launchd runs (com.bothsides.refresh-monthly, the
# 10th of the month 09:00; their sources publish 1–3 weeks late, so the 2nd week catches
# the previous month), and what approve_hourly.sh runs as a catch-up when that day was missed.
#   collect (Tiud, ../Tiud, last two months, no classify) → export to the sheet →
#   dedupe new Fortress rows vs ACLED → pipeline (01–07, json rebuild) → review issue.
# Cost: ~$5 for the collection + a few cents dedupe + ~$0.50 pipeline.
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export APPDATA="$HOME/Library/Application Support"          # where Tiud keeps its database on this Mac
cd "${0:a:h}" || exit 1
TIUD="${0:a:h}/../Tiud"
LOCK=_acled-filter/refresh.lock
if [[ -e $LOCK ]] && kill -0 "$(cat $LOCK 2>/dev/null)" 2>/dev/null; then
  echo "==== $(date) a refresh is already running (pid $(cat $LOCK)) — skipped"; exit 0
fi
mkdir -p _acled-filter; echo $$ > $LOCK
trap 'rm -f $LOCK' EXIT
echo "==== $(date) monthly Fortress refresh"
FROM=$(date -v-1m +%Y-%m)                                  # last month: Tiud rescans it and the current one
( cd "$TIUD" && mkdir -p output && node scripts/run-ts.mjs scripts/overnight-collect.ts 15 5 --from=$FROM --skip-classify ) || exit 1
python3 -u 00_fetch_tiud.py \
  && python3 -u 08_dedupe_fortress.py events.xlsx --direction fortress \
  && python3 -u run_pipeline.py
