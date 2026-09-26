import assert from 'node:assert/strict';
import {PoolSimulation} from './dist/sim.mjs';
import {CoachInput} from './dist/input.mjs';
import {COACH_TUNING as T,isDeckPosition} from './dist/spatial.mjs';
import {guidanceState,cuePulse} from './dist/guidance.mjs';
import {PoolAudio} from './dist/audio.mjs';
const game=()=>{const s=new PoolSimulation(1,142);s.schedule=[];s.start();Object.assign(s.coach,{x:0,z:10.8});return s;};
const step=(s,n)=>{for(let i=0;i<n;i++)s.tick(1/60);};
{
 const s=game();s.setMovement(1,0);const start=s.coach.x;assert.equal(s.dash(),true);assert.equal(s.dash(),false,'Cannot stack dashes');step(s,10);assert.ok(s.coach.x-start>2.9&&s.coach.x-start<3.4,'A dash should be about three deck units');assert.equal(s.coach.dashTime,0);assert.ok(s.coach.dashCooldown>0);assert.equal(s.dash(),false);step(s,40);assert.equal(s.dash(),true,'Dash becomes available again without a UI meter');
 s.clearInput();assert.equal(s.coach.dashTime,0);assert.equal(s.coach.vx,0);s.status='paused';assert.equal(s.dash(),false);
 const q=game();q.coach.angle=Math.PI/2;q.dash();step(q,1);assert.ok(q.coach.x>0,'Idle dash follows facing');
}
{
 const a=game(),b=game();for(const s of [a,b])Object.assign(s.coach,{x:7,z:6});a.setMovement(0,-1);b.setMovement(1,-1);a.dash();b.dash();step(a,8);step(b,8);assert.ok(Math.abs(Math.hypot(a.coach.x-7,a.coach.z-6)-Math.hypot(b.coach.x-7,b.coach.z-6))<1e-6,'Diagonal dash stays normalized');
 const s=game();Object.assign(s.coach,{x:0,z:-10.8});s.setMovement(0,1);s.jump();s.dash();for(let i=0;i<30;i++){s.tick(1/60);assert.ok(isDeckPosition(s.coach.x,s.coach.z),'Jump dash cannot tunnel into the starting block or pool');}assert.ok(s.coach.y>=0);assert.equal(s.status,'playing');
 const w=game();Object.assign(w.coach,{x:13.8,z:0});w.setMovement(1,0);w.dash();step(w,20);assert.ok(w.coach.x<=14.1&&isDeckPosition(w.coach.x,w.coach.z));
 const f=game();Object.assign(f.coach,{x:7,z:4,carry:'fins'});f.setMovement(0,-1);f.dash();step(f,10);assert.equal(f.coach.carry,'fins','Dash preserves the carrying slot');
}
{
 let dashes=0,playing=true;const input=new CoachInput({onDash:()=>dashes++,onJump:()=>{},onInteract:()=>{},onPause:()=>{},onShortcut:()=>{},isPlaying:()=>playing});
 const key=(code,repeat=false,editing=false)=>({code,key:code,repeat,preventDefault(){},target:{matches:()=>editing}});
 input.keyDown(key('ShiftLeft'));input.keyDown(key('ShiftLeft',true));input.keyDown(key('ShiftRight'));assert.equal(dashes,2);input.keyDown(key('ShiftLeft',false,true));assert.equal(dashes,2);playing=false;input.keyDown(key('ShiftLeft'));assert.equal(dashes,2);input.clear();assert.deepEqual(input.vector(),{x:0,z:0});
}
{
 const s=game(),p=s.spawn({type:'beginner'});assert.equal(s.selected,null,'First swimmer must be clicked, never auto-selected');assert.deepEqual(guidanceState(s),{swimmerId:p.id,lanes:false});s.select(p.id);assert.ok(s.events.some(e=>e.type==='select'&&e.id===p.id));assert.deepEqual(guidanceState(s),{swimmerId:p.id,lanes:true});assert.equal(s.assign(3),false);assert.equal(s.assign(1),true);assert.equal(p.status,'enter');assert.equal(s.selected,null);assert.deepEqual(guidanceState(s),{swimmerId:null,lanes:false});
 const q=s.spawn({type:'advanced'});assert.equal(guidanceState(s).swimmerId,q.id);s.select(q.id);s.closed=3;assert.equal(guidanceState(s).lanes,false);assert.equal(s.assign(0),false);s.closed=0;s.coach.carry='chlorine';assert.equal(guidanceState(s).lanes,true);assert.equal(s.assign(2),true,'A glowing lane must assign even with chlorine in hand');assert.equal(q.status,'enter');assert.equal(s.coach.carry,'chlorine');
 const r=s.spawn({type:'beginner'});s.select(r.id);s.home();assert.equal(guidanceState(s).lanes,false);s.status='paused';assert.deepEqual(guidanceState(s),{swimmerId:null,lanes:false});
 const retry=game(),first=retry.spawn({type:'beginner'});assert.deepEqual(guidanceState(retry),{swimmerId:first.id,lanes:false});assert.equal(cuePulse(1,true),1);assert.equal(cuePulse(99,true),1);assert.ok(cuePulse(0)!==cuePulse(.3375));
}
{
 const audio=new PoolAudio();audio.ctx={currentTime:3};const calls=[];audio.tone=(...args)=>calls.push(args);audio.noise=()=>{};audio.effect('select');assert.equal(calls.length,2);assert.ok(calls[1][0]>calls[0][0]);assert.ok(calls[1][1]-calls[0][1]<.1,'Selection cue responds immediately');audio.enabled=false;audio.effect('select');assert.equal(calls.length,2,'Muted selection stays muted');
}
console.log('Sprint checks passed: dash timing, cooldown, normalization, walls, jump/carry, both Shift keys, guidance transitions/recovery, chlorine assignment, and selection sound.');
