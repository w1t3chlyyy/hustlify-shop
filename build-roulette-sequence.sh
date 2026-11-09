#!/usr/bin/env bash
set -euo pipefail

input="public/videos/roulette-wheel.webm"
output="public/videos/roulette-wheel-sequence.webm"

ffmpeg -y -i "$input" \
  -filter_complex "[0:v]scale=960:960:flags=lanczos,minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,split=3[loop1][loop2][final];[loop1]trim=start=0:duration=2,setpts=PTS-STARTPTS[part1];[loop2]trim=start=0:duration=2,setpts=PTS-STARTPTS[part2];[final]trim=start=0,setpts=PTS-STARTPTS[part3];[part1][part2][part3]concat=n=3:v=1:a=0[outv]" \
  -map '[outv]' -an -fps_mode cfr -r 48 \
  -c:v libvpx-vp9 -crf 30 -b:v 0 \
  -deadline good -cpu-used 4 -row-mt 1 -tile-columns 1 \
  "$output"