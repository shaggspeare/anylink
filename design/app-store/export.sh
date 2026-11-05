#!/bin/zsh
# Export 1290×2796 App Store PNGs per language: ./export.sh [lang …] (default: en + every i18n/*.js)
# Needs the static server: python3 -m http.server 4319 --directory <repo root>
cd "${0:A:h}"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
names=(library share-sheet add-link sort-unsorted collections search reader share-collection widgets)
langs=("$@"); (( $#langs )) || langs=(en i18n/*.js(:t:r))
for l in $langs; do
  mkdir -p png/$l
  for i in {1..9}; do
    "$CH" --headless=new --hide-scrollbars --force-device-scale-factor=3 --window-size=430,932 --virtual-time-budget=5000 \
      --screenshot=png/$l/$(printf %02d $i)-${names[$i]}.png "http://localhost:4319/design/app-store/?shot=$i&lang=$l" >/dev/null 2>&1 &
  done
  wait
  echo "$l: $(ls png/$l | wc -l | tr -d ' ') png"
done
