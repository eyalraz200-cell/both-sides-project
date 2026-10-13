#!/bin/zsh
# Hourly — what launchd runs (com.bothsides.approve-hourly): publish once the review issue says approve.
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"   # the python3 that has openpyxl/openai/requests
cd "${0:a:h}" || exit 1
python3 approve_check.py
