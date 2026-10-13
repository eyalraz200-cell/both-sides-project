#!/bin/zsh
# Hourly — what launchd runs (com.bothsides.approve-hourly): publish once the review issue says approve.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "${0:a:h}" || exit 1
python3 approve_check.py
