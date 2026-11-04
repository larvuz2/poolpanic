import math, json, sys
def proj(cam, p, W=1920, H=1080):
    P=cam['pos']; T=cam['at']; fov=math.radians(cam['fov'])
    f=[T[i]-P[i] for i in range(3)]; n=math.sqrt(sum(v*v for v in f)); f=[v/n for v in f]
    up=[0,1,0]
    r=[f[1]*up[2]-f[2]*up[1], f[2]*up[0]-f[0]*up[2], f[0]*up[1]-f[1]*up[0]]; n=math.sqrt(sum(v*v for v in r)); r=[v/n for v in r]
    u=[r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]]
    d=[p[i]-P[i] for i in range(3)]
    x=sum(d[i]*r[i] for i in range(3)); y=sum(d[i]*u[i] for i in range(3)); z=sum(d[i]*f[i] for i in range(3))
    t=math.tan(fov/2); a=W/H
    return (W/2*(1+x/(z*t*a)), H/2*(1-y/(z*t)))
CAMS={'stack-a-0':{"pos":[0,2.3,1.2],"at":[0,1.85,-11.6],"fov":23},'stack-b-1':{"pos":[0,1.9,0.6],"at":[0,2.25,-11.6],"fov":27.5}}
HEADS={'stack-a-0':{'karen':(-2.5,-9.95,1.6),'marco':(0.02,-10.65,2.3),'waters':(-0.42,-9.85,1.62)},
       'stack-b-1':{'karen':(-2.4,-9.25,1.6),'marco':(0.0,-9.95,2.3),'waters':(-0.4,-9.15,1.62)}}
out={k:{c:[round(v) for v in proj(CAMS[k],(p[0],p[2],p[1]))] for c,p in h.items()} for k,h in HEADS.items()}
print(json.dumps(out))
