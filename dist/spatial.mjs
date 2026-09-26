export const RING_MOUNTS=[{x:-4,z:-15.7,angle:0},{x:-14.35,z:-5,angle:Math.PI/2},{x:14.35,z:5,angle:-Math.PI/2}];
export const RESCUE={wall:{x:-4,z:-15.7},bench:{x:-10.2,z:-.25},approach:{x:-8.9,z:-.25},restSeconds:4,swimSpeed:4.2};
export const LANES=[-3.2,0,3.2];
export const STATIONS={fins:{x:-10.3,z:7.8},chlorine:{x:10.8,z:7.8},relief:{x:10.8,z:3.9}};
export const SANITATION={rack:{x:-13.5,z:-1.9},bin:{x:-12.5,z:1.5},reach:6.2};
export const COACH_TUNING={speed:7.6,acceleration:58,braking:76,radius:.32,jumpSpeed:7.4,gravity:23,reach:1.8,handoffReach:3.6,dashSpeed:19,dashDuration:.16,dashCooldown:.82};
// Simple collision proxies follow the authored furniture, never the detailed render meshes.
export const DECK_OBSTACLES=[
 {...SANITATION.bin,hx:.62,hz:.62,kind:'waste-bin'},
 {x:0,z:0,hx:5.3,hz:8.65,kind:'pool'},
 ...LANES.map(x=>({x,z:-9.15,hx:.6,hz:.56,kind:'block'})),
 ...[[-10.2,-.9],[10.3,-.5],[-9.8,3.3]].map(([x,z])=>({x,z,hx:.49,hz:1.7,kind:'bench'})),
 {x:-10.3,z:7.8,hx:.48,hz:1.03,kind:'rack'},
 ...['chlorine','relief'].map(item=>({...STATIONS[item],hx:item==='chlorine'?.6:.9,hz:item==='chlorine'?.9:.6,kind:'station'})),
 ...[[-13,10.6]].map(([x,z])=>({x,z,hx:.5,hz:.5,kind:'plant'})),
 {x:-12.9,z:5.5,hx:.54,hz:.5,kind:'fountain'},
 {x:12.2,z:-7.3,hx:.6,hz:.7,kind:'chair'},
 {x:13,z:9.5,hx:.6,hz:1.4,kind:'desk'},
 ...[-10.7,10.7].flatMap(x=>[
  {x:x-2.65,z:-15.06,hx:.15,hz:1.4,kind:'locker-wall'},
  {x:x+2.65,z:-15.06,hx:.15,hz:1.4,kind:'locker-wall'},
  {x,z:-16.2,hx:2.65,hz:.3,kind:'locker-wall'},
  {x,z:-15.17,hx:1.55,hz:.36,kind:'locker-bench'}
 ])
];
export function isDeckPosition(x,z,level=3){if(x< -14.1||x>14.1||z< -15.2||z>12.65)return false;const r=COACH_TUNING.radius;return !DECK_OBSTACLES.some(b=>(b.kind!=='waste-bin'||level>=3)&&Math.abs(x-b.x)<b.hx+r&&Math.abs(z-b.z)<b.hz+r);}
export function createCoach(){return{x:-6.6,z:0,y:0,vx:0,vz:0,vy:0,angle:Math.PI/2,carry:null,carryOwner:null,job:null,path:[],state:'Ready to help',input:{x:0,z:0},jumpBuffer:0,dashTime:0,dashCooldown:0,dashX:0,dashZ:0,landing:0,slipTime:0,slipCooldown:0,goal:null,feedback:0};}

// The starting-block end now sits beside the locker rooms.
export const ENTRY={walkZ:-9.9,edgeZ:-8.7,serviceZ:-9.55,waterZ:-7.2,dropZ:-9.6};
// Across-pool camera: screen right is +Z, screen up is +X.
export function screenMovement(x,z){return{x:-z,z:x};}

export const ARRIVAL={firstDelay:3.4,doorDuration:2.2,hold:.35,insideX:8.8,doorX:8.05,doorZ:-14.4,outsideX:7.25,walkSpeed:5};
export function doorOpening(remaining){if(remaining<=0)return 0;const t=Math.min(1,(ARRIVAL.doorDuration-remaining)/.3,remaining/.45);return Math.sin(Math.max(0,t)*Math.PI/2);}

// Waiting rows sit behind the starting blocks, beneath the clubhouse wall.
export function queuePosition(side,slot){return{x:side*(4.6-(slot%4)*1.1),z:-11.1-Math.floor(slot/4)*1.15};}
