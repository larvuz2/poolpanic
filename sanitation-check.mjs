import assert from 'node:assert/strict';
import {PoolSimulation,LANES} from './dist/sim.mjs';
import {SANITATION as S,isDeckPosition} from './dist/spatial.mjs';
import {PoolAudio} from './dist/audio.mjs';
const tick=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)s.tick(1/60);};
const game=(level=3)=>{const s=new PoolSimulation(level,31);s.schedule=[];s.start();return s;};
const swim=(s,lane=1,sick=false)=>{const p=s.spawn({type:'beginner',sick});Object.assign(p,{status:'swim',lane,x:LANES[lane],z:0,p:7.2,needsFins:false,problem:null,stomachDelay:.1});return p;};
const at=(s,x,z)=>{assert.ok(isDeckPosition(x,z),`Coach approach ${x},${z} must be on deck`);Object.assign(s.coach,{x,z,y:0,vx:0,vz:0});s.clearInput();};
for(const level of [1,2]){const s=game(level);assert.ok(s.director().every(p=>!p.sick));const p=swim(s,1,true);assert.equal(p.sick,false);tick(s,16);assert.equal(s.cleanup,null);assert.equal(s.fetch('skimmer'),false);}
{
 const s=game(),p=swim(s,1,true);tick(s,.2);assert.equal(p.stomachWarning,true);assert.ok(p.sicknessTimer<10);s.status='paused';const before=p.sicknessTimer;tick(s,3);assert.equal(p.sicknessTimer,before);s.status='playing';s.select(p.id);s.home();assert.equal(s.stats.prevented,1);assert.equal(p.status,'evacuating');assert.equal(s.cleanup,null);tick(s,16);assert.equal(p.status,'gone');assert.equal(s.stats.catastrophes,0);
}
function incident(){const s=game(),p=swim(s,1,true),a=swim(s,0),b=swim(s,2);p.sicknessTimer=.05;tick(s,.2);assert.equal(s.closed,1);assert.equal(s.cleanup.stage,'floating');assert.equal(s.score,-500);assert.ok(s.people.every(p=>p.status==='evacuating'));return{s,p,a,b};}
function collect(s){const q=s.cleanup;at(s,0,10);assert.equal(s.fetch('skimmer'),false);at(s,-12.3,-1.9);assert.ok(s.interact());assert.equal(s.coach.carry,'skimmer');assert.equal(s.scoop(),false,'Cannot catch from the equipment wall');const side=q.x<0?-1:1;at(s,side*5.8,q.z);assert.ok(s.scoop());assert.equal(s.scoop(),false,'One cast at a time');tick(s,.5);assert.equal(s.cleanup.stage,'caught');assert.equal(s.coach.skimmerLoaded,true);assert.equal(s.returnItem(),false,'Loaded net cannot be hung');at(s,-12.5,.4);assert.ok(s.disposeWaste());assert.equal(s.cleanup.stage,'return');assert.equal(s.coach.skimmerLoaded,false);at(s,-12.3,-1.9);assert.ok(s.returnItem());assert.equal(s.coach.carry,null);assert.equal(s.cleanup.stage,'treat');}
function dose(s){at(s,9.5,7.8);assert.ok(s.fetch('chlorine'));at(s,5.8,4);assert.ok(s.deliverWater(1));}
for(const overdose of [false,true]){
 const {s,p,a,b}=incident(),clock=s.time,arrival=s.arrivalTime,x=s.cleanup.x;s.schedule=[{at:arrival+1,type:'intermediate'}];tick(s,16);assert.equal(s.time,clock,'Clock holds for the playable cleanup');assert.ok(s.arrivalTime>arrival+15);assert.equal(s.nextArrival,1,'Arrivals continue during cleanup');assert.equal(s.people.find(v=>v.id===a.id).status,'panic');assert.equal(p.status,'gone');assert.notEqual(s.cleanup.x,x);assert.ok(s.waterBrown>.3);assert.ok(s.contamination>70);assert.equal(s.closed,1,'No automatic cleanup countdown');
 const waiting=s.people.find(v=>v.status==='queue');s.select(waiting.id);assert.equal(s.assign(1),false);s.coach.carry='chlorine';at(s,5.8,0);assert.equal(s.deliverWater(1),false,'Cannot skip the physical cleanup');s.coach.carry=null;
 collect(s);dose(s);assert.equal(s.closed,1);dose(s);assert.ok(s.chlorine>=40&&s.chlorine<=65);if(overdose)dose(s);tick(s,3.2);assert.equal(s.cleanup,null);assert.equal(s.closed,0);assert.equal(s.waterBrown,0);tick(s,10);assert.ok(s.people.some(p=>p.status==='swim'),'Evacuees reenter the pool');
 if(overdose){const eyes=s.people.find(p=>p.status==='swim'&&p.problem==='eyes');assert.ok(eyes,'Overdosing produces sore eyes on returning swimmers');at(s,9.5,3.9);assert.ok(s.fetch('relief'));for(let i=0;i<1200&&eyes.z>-6.55;i++)s.tick(1/60);const point=s.servicePoint(eyes);at(s,point.x,point.z);assert.ok(s.deliver(eyes.id));assert.equal(eyes.problem,null);assert.equal(s.coach.carry,null);}else assert.ok(s.people.every(p=>p.problem!=='eyes'));
}
{
 const {s}=incident();at(s,-12.3,-1.9);s.fetch('skimmer');at(s,5.8,s.cleanup.z);assert.ok(s.scoop());at(s,-12.3,-1.9);tick(s,.5);assert.equal(s.cleanup.stage,'floating','Leaving reach during a cast misses');assert.equal(s.coach.skimmerLoaded,false);
 const a=new PoolAudio();a.ctx={currentTime:0};a.playing=true;a.enabled=true;const calls=[];a.tone=(...args)=>calls.push(args);a.noise=()=>{};a.next=0;a.schedule();const calmNext=a.next;a.next=0;a.step=0;a.panic=true;calls.length=0;a.schedule();assert.ok(calls.some(c=>c[4]==='square'),'Panic adds an alarm voice');assert.notEqual(a.next,calmNext);a.enabled=false;const before=calls.length;a.schedule();assert.equal(calls.length,before);
}
console.log('Sanitation checks passed: level gating, warnings/prevention, pause, evacuation, panic, drifting contamination, held shift clock with continuing arrivals, physical scoop/dispose/return, correct doses, overdose/eye treatment, misses, and panic audio.');

{
 const {s,p,a}=incident();p.hasFins=true;a.hasFins=true;s.coach.carry='fins';s.finsAvailable=0;tick(s,16);
 const inventory=()=>s.finsAvailable+s.people.filter(p=>p.hasFins).length+s.clutter.filter(p=>p.type==='fins').length+(s.coach.carry==='fins'?1:0);
 assert.equal(inventory(),3,'Evacuation retains carried, worn, and dropped fins');at(s,-9.3,7.8);assert.ok(s.returnItem());assert.equal(inventory(),3);assert.equal(s.coach.carry,null);
 const fresh=game();assert.equal(fresh.cleanup,null);assert.equal(fresh.coach.carry,null);assert.equal(fresh.closed,0);
}
// Every cleanup station and either pool edge is reachable through the authored furniture.
{
 const reached=new Set(),queue=[[-6.6,0]];reached.add('-33,0');
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz] of [[.2,0],[-.2,0],[0,.2],[0,-.2]]){const nx=Math.round((x+dx)*5)/5,nz=Math.round((z+dz)*5)/5,key=Math.round(nx*5)+','+Math.round(nz*5);if(!reached.has(key)&&isDeckPosition(nx,nz,3)){reached.add(key);queue.push([nx,nz]);}}}
 for(const p of [S.rack,S.bin,{x:10.8,z:7.8},{x:10.8,z:3.9},{x:5.8,z:0},{x:-5.8,z:0}])assert.ok(queue.some(([x,z])=>Math.hypot(x-p.x,z-p.z)<1.6),'Cleanup destination must be reachable');
 assert.equal(isDeckPosition(S.bin.x,S.bin.z,1),true,'Hidden level-one bin must not block movement');assert.equal(isDeckPosition(S.bin.x,S.bin.z,3),false);
}
console.log('Cleanup inventory and station access checks passed.');
