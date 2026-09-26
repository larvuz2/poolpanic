import {isDeckPosition} from './spatial.mjs';

const DIAMETER=.72;
export const BUMP_DURATION=.48;
export function onDeck(p){
 return ['queue','arriving','enter','exit','evacuating','panic','recovering'].includes(p.status)&&p.recoveryStage!=='resting'
  &&!p.evacWater&&!['water','climb'].includes(p.exitPhase)&&!(Math.abs(p.x)<5.5&&Math.abs(p.z)<8.7);
}
const resting=p=>p.status==='queue'||p.status==='panic';

// Corrections respect solid deck edges. Authored door/entry transitions retain their routes.
function displace(p,x,z,level){
 const safe=isDeckPosition(p.x,p.z,level);
 const allowed=(x,z)=>x>=-14.1&&x<=14.1&&z>=-15.2&&z<=12.65
  &&!(Math.abs(x)<5.5&&Math.abs(z)<8.7)&&(!safe||isDeckPosition(x,z,level));
 if(allowed(p.x+x,p.z+z)){p.x+=x;p.z+=z;}
 else{if(allowed(p.x+x,p.z))p.x+=x;if(allowed(p.x,p.z+z))p.z+=z;}
}

export function prepareDeck(sim,dt){
 for(const p of [...sim.people,sim.coach]){
  p.bumpTime=Math.max(0,(p.bumpTime||0)-dt);
  p.bumpCooldown=Math.max(0,(p.bumpCooldown||0)-dt);
  if(!onDeck(p))continue;
  if(resting(p)){
   p.deckRest??={x:p.x,z:p.z};
   const dx=p.deckRest.x-p.x,dz=p.deckRest.z-p.z;
   const rate=Math.min(1,dt*2);
   displace(p,dx*rate,dz*rate,sim.level);
  }else p.deckRest=null;
  if(p.bumpTime>0&&p.slipTime<=0){
   const fade=p.bumpTime/BUMP_DURATION;
   displace(p,(p.bumpX||0)*dt*fade,(p.bumpZ||0)*dt*fade,sim.level);
  }
 }
}

// Brief right-hand sidesteps break head-on symmetry without changing any destination.
export function deckHeading(sim,p,dx,dz){
 if(!onDeck(p)||!p.bumpTime)return {x:dx,z:dz};
 const obstacles=sim.people.filter(a=>a!==p&&onDeck(a));
 if(sim.coach.y<.5)obstacles.push(sim.coach);
 for(const a of obstacles){
  const x=a.x-p.x,z=a.z-p.z,ahead=x*dx+z*dz,lateral=x*dz-z*dx;
  if(ahead>-.05&&ahead<1.15&&Math.abs(lateral)<.8){
   // Both walkers take their own right; already offset walkers keep their passing side.
   const side=Math.abs(lateral)>.12?-Math.sign(lateral):1;
   const x=dx*.55+dz*side*.95,z=dz*.55-dx*side*.95,n=Math.hypot(x,z);
   return {x:x/n,z:z/n};
  }
 }
 return {x:dx,z:dz};
}

function bump(p,x,z){
 if(p.bumpCooldown>0||p.slipTime>0)return;
 p.bumpTime=BUMP_DURATION;p.bumpCooldown=.65;p.bumpX=x*.9;p.bumpZ=z*.9;
}

export function resolveDeck(sim){
 const people=sim.people.filter(onDeck),coach=sim.coach;
 // A few positional passes resolve crowded contacts; no stops, falls, or score penalties.
 for(let pass=0;pass<5;pass++){
  for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
   const a=people[i],b=people[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
   if(d>=DIAMETER)continue;
   const nx=d>.0001?dx/d:0,nz=d>.0001?dz/d:(a.id<b.id?1:-1);
   if(resting(a))a.deckRest??={x:a.x,z:a.z};
   if(resting(b))b.deckRest??={x:b.x,z:b.z};
   bump(a,-nx,-nz);bump(b,nx,nz);
   const overlap=(DIAMETER-d+.001)/2;
   displace(a,-nx*overlap,-nz*overlap,sim.level);
   displace(b,nx*overlap,nz*overlap,sim.level);
  }
  if(coach.y>=.5||coach.swimming||coach.waterTransition)continue;
  for(const p of people){
   const dx=p.x-coach.x,dz=p.z-coach.z,d=Math.hypot(dx,dz);
   if(d>=DIAMETER)continue;
   const nx=d>.0001?dx/d:Math.cos(coach.angle),nz=d>.0001?dz/d:-Math.sin(coach.angle);
   if(resting(p))p.deckRest??={x:p.x,z:p.z};
   bump(p,nx,nz);bump(coach,-nx,-nz);
   // Coach keeps responsive controls; swimmers yield most of the small displacement.
   const overlap=DIAMETER-d+.001;
   displace(p,nx*overlap*.85,nz*overlap*.85,sim.level);
   displace(coach,-nx*overlap*.15,-nz*overlap*.15,sim.level);
  }
 }
}

export function bumpLean(p,reducedMotion=false){
 if(reducedMotion||!p.bumpTime||p.slipTime>0)return {x:0,z:0};
 const t=1-p.bumpTime/BUMP_DURATION;
 const wave=Math.sin(t*Math.PI*3)*(1-t)*.13;
 const a=p.angle||0,x=p.bumpX||0,z=p.bumpZ||0;
 return {x:wave*(x*Math.sin(a)+z*Math.cos(a)),z:-wave*(x*Math.cos(a)-z*Math.sin(a))};
}
