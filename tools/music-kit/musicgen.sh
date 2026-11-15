#!/usr/bin/env bash
# Takes from MusicGen-melody, guided by our notes (guides.py), for comparison with creation.py.
#   MUSICGEN_URL=http://<host>:<port> [MUSICGEN_API_KEY=...] ./musicgen.sh [seeds...]
# Never name a composer or a film in a description: describe the music itself.
set -euo pipefail
cd "$(dirname "$0")"
: "${MUSICGEN_URL:?set MUSICGEN_URL to the MusicGen service, e.g. http://<host>:<port>}"
SEEDS=("${@:-1 2 3}")
AUTH=()
[[ -n "${MUSICGEN_API_KEY:-}" ]] && AUTH=(-H "Authorization: Bearer ${MUSICGEN_API_KEY}")

THEME="Slow, awe-filled orchestral music for the creation of a world out of the void: a wordless choir \
and warm high violins over deep sustained strings, a noble horn, distant bells, vast reverberant space, \
majestic, gentle and full of wonder"
DISCORD="Dark orchestral music: harsh, braying brass in loud unison hammering a dissonant repeated figure, \
a grinding low roar, while a noble horn melody holds against it; then the clash gives way and resolves \
into a radiant major chord"

mkdir -p takes
take() { # name guide duration description seed
  local out="takes/$1-seed$5.wav"
  [[ -f $out ]] && { echo "have $out"; return; }
  echo "generating $out ..."
  local t0=$SECONDS
  curl -sf --max-time 900 "${AUTH[@]}" -X POST "$MUSICGEN_URL/generate" \
    -F "description=$4" -F "melody=@$2" -F "duration=$3" -F "seed=$5" -o "$out.part"
  mv "$out.part" "$out"
  echo "  done in $((SECONDS - t0)) s"
}

for s in ${SEEDS[@]}; do
  take theme guide-theme.wav 30 "$THEME" "$s"
  take discord guide-discord.wav 16 "$DISCORD" "$s"
done
for f in takes/*.wav; do
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$f" -af loudnorm=I=-20:TP=-2 -ar 44100 -c:a libmp3lame -q:a 2 "${f%.wav}.mp3"
done
ls -la takes
