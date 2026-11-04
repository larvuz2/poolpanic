#!/bin/bash
# queue.sh job.json... : runs the shots two at a time, a log next to each
run() { j=$1; timeout 1500 xvfb-run -a node photo.cjs $j > ${j%.json}.log 2>&1; echo "done $j: $(grep -E '^after|^errors|Error' ${j%.json}.log | tr '\n' ' ' | cut -c1-300)"; }
export -f run
printf "%s\n" "$@" | xargs -P 2 -I{} bash -c 'run {}'
echo "queue finished"
