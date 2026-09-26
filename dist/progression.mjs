import {SHIFTS} from './sim.mjs';
export function normalizeRecords(saved={}){return{bests:SHIFTS.map((_,i)=>Math.max(0,Number(saved?.bests?.[i])||0)),unlocked:Math.max(1,Math.min(SHIFTS.length,Math.floor(Number(saved?.unlocked))||1))};}
export function starsFor(level,score){return SHIFTS[level-1].thresholds.filter(n=>score>=n).length;}
export function recordResult(records,level,score){const index=level-1,newBest=score>records.bests[index];if(newBest)records.bests[index]=score;if(starsFor(level,score)>0)records.unlocked=Math.max(records.unlocked,Math.min(SHIFTS.length,level+1));return newBest;}
