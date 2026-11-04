#!/bin/bash
# mk.sh <frames dir> <name> <fps>: the frames as a GIF (1170 wide, palette made for the clip) and an MP4 and a WEBM
d=$1; n=$2; fps=${3:-15}
mkdir -p out
ffmpeg -loglevel error -y -framerate $fps -i $d/f%03d.png -vf "scale=1170:-2:flags=lanczos,palettegen=max_colors=192:stats_mode=diff" /tmp/pal-$n.png
ffmpeg -loglevel error -y -framerate $fps -i $d/f%03d.png -i /tmp/pal-$n.png -lavfi "scale=1170:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 out/clip-$n.gif
ffmpeg -loglevel error -y -framerate $fps -i $d/f%03d.png -vf "scale=1170:-2:flags=lanczos,format=yuv420p" -c:v libx264 -crf 20 -preset slow -movflags +faststart -an out/clip-$n.mp4
ffmpeg -loglevel error -y -framerate $fps -i $d/f%03d.png -vf "scale=1170:-2:flags=lanczos" -c:v libvpx-vp9 -b:v 0 -crf 34 -an out/clip-$n.webm
ls -la out/clip-$n.*
# a GIF over Steam's 5 MB: squeezed with gifsicle (lossy) from the full one, harder until it fits
cp out/clip-$n.gif /tmp/full-$n.gif
for l in 60 100 140 180 240; do
  s=$(stat -c %s out/clip-$n.gif); [ $s -lt 4700000 ] && break
  gifsicle -O3 --lossy=$l --colors 128 /tmp/full-$n.gif -o out/clip-$n.gif 2>/dev/null
done
ls -la out/clip-$n.gif
