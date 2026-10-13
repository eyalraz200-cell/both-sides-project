#!/bin/zsh
# Hourly — what launchd runs (com.bothsides.approve-hourly):
#   1. publish once the review issue says approve (approve_check.py)
#   2. catch-up: if the weekly refresh is overdue (last run > 7 days ago — the Mac was
#      shut down on Wednesday, so launchd skipped it), run it now. A run in progress
#      holds a lock file so two can't overlap.
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"   # the python3 that has openpyxl/openai/requests
cd "${0:a:h}" || exit 1
python3 approve_check.py

LOCK=_acled-filter/refresh.lock
LAST=_acled-filter/last-fetch.json
if [[ -e $LOCK ]] && kill -0 "$(cat $LOCK 2>/dev/null)" 2>/dev/null; then
  exit 0                                   # a refresh is running right now
fi
if [[ ! -e $LAST ]] || [[ -n $(find $LAST -mtime +7) ]]; then
  echo "==== $(date) catch-up: weekly refresh overdue"
  ./refresh_weekly.sh >> _acled-filter/launchd-weekly.log 2>&1
fi
LAST_TIUD=_acled-filter/last-tiud.json                 # the monthly Fortress refresh, same idea (> 35 days)
if [[ -e $LAST_TIUD ]] && [[ -n $(find $LAST_TIUD -mtime +35) ]]; then
  echo "==== $(date) catch-up: monthly Fortress refresh overdue"
  ./refresh_monthly.sh >> _acled-filter/launchd-monthly.log 2>&1
fi
