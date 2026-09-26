// One cue language, shared by the world and HUD. No timer or tutorial modal.
export function guidanceState(sim){
 if(sim.status!=='playing')return{swimmerId:null,lanes:false};
 if(sim.rescue)return{swimmerId:sim.rescue.stage==='stranded'?sim.rescue.victim:null,lanes:false};
 const selected=sim.get(sim.selected);
 if(selected?.status==='queue')return{swimmerId:selected.id,lanes:sim.closed<=0};
 const next=sim.people.find(p=>p.status==='queue');
 return{swimmerId:next?.id??null,lanes:false};
}
export function cuePulse(time,reduced=false){return reduced?1:.5+.5*Math.sin(time*Math.PI*2/1.35);}
