import sys, math, random, bpy, bmesh
sys.path.insert(0,'/home/claude/test/bg')
from lib import *
args=sys.argv[sys.argv.index('--')+1:]; job=args[0]; q=args[1] if len(args)>1 else 'hi'
res={'cloud1':(640,320),'cloud2':(640,320),'cloud3':(640,320),'moon':(512,512)}.get(job,(720,1280))
if q=='lo': res=(res[0]//2,res[1]//2)
S=setup(res,32 if q=='hi' else 4)
cam=S.camera; cam.rotation_euler=(math.radians(90),0,0); cam.location=(0,-40,8)
random.seed(hash(job)%1000)
TH=16.0
def wrap(fn,z,margin=2.0,*a,**k):
    fn(z,*a,**k)
    if z<margin: fn(z+TH,*a,**k)
    if z>TH-margin: fn(z-TH,*a,**k)
def grain(name,base,shade,hi,scale=(3,0.3,0.3),dir='X',dark=0.62):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links; N.clear()
    o=N.new('ShaderNodeOutputMaterial'); d=N.new('ShaderNodeBsdfDiffuse'); s2r=N.new('ShaderNodeShaderToRGB'); L.new(d.outputs[0],s2r.inputs[0])
    bw=N.new('ShaderNodeRGBToBW'); L.new(s2r.outputs[0],bw.inputs[0])
    cr=N.new('ShaderNodeValToRGB'); e=cr.color_ramp.elements; cr.color_ramp.interpolation='EASE'
    e[0].position=0.18; e[0].color=(*srgb(shade),1); e[1].position=0.32; e[1].color=(*srgb(base),1)
    a=e.new(0.75); a.color=(*srgb(base),1); b=e.new(0.85); b.color=(*srgb(hi),1)
    L.new(bw.outputs[0],cr.inputs[0])
    tc=N.new('ShaderNodeTexCoord'); mp=N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=scale; L.new(tc.outputs['Generated' if False else 'Object'],mp.inputs[0])
    wv=N.new('ShaderNodeTexWave'); wv.wave_type='BANDS'; wv.bands_direction=dir; wv.inputs['Scale'].default_value=2; wv.inputs['Distortion'].default_value=5; wv.inputs['Detail'].default_value=2
    L.new(mp.outputs[0],wv.inputs[0])
    gr=N.new('ShaderNodeValToRGB'); ge=gr.color_ramp.elements; ge[0].position=0.6; ge[0].color=(1,1,1,1); ge[1].position=0.66; ge[1].color=(dark,dark*0.95,dark*0.95,1)
    L.new(wv.outputs['Fac'],gr.inputs[0])
    mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1
    L.new(cr.outputs[0],mx.inputs[6]); L.new(gr.outputs[0],mx.inputs[7])
    em=N.new('ShaderNodeEmission'); L.new(mx.outputs[2],em.inputs[0]); L.new(em.outputs[0],o.inputs[0]); return m
BARK=grain('bark','8a5a3c','4a2a22','b27a52',scale=(4,1,0.25),dir='X')
NEEDLE=T(PINE); SNOWM=T(SNOW)
def trunk(x,r,ol):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=TH+6,location=(x,0,TH/2)); o=last(); smooth(o); mat(o,BARK); outline(o,ol)
def branch(z,x0,side,length,ol,snow=True):
    droop=random.uniform(6,14)
    th=math.radians(side*(90+droop)); dx,dz=math.sin(th),math.cos(th)
    # main bough
    cone((x0+dx*(length/2+0.1),0,z+dz*length/2),0.34,0.05,length,NEEDLE,verts=12,ol=ol,rot=(0,th,0))
    # hanging tufts along the bough -> fir silhouette
    n=max(3,int(length/0.45))
    for i in range(n):
        t=(i+0.6)/(n+0.3); px=x0+dx*(length*t+0.1); pz=z+dz*length*t
        tl=(0.95-0.55*t)*random.uniform(0.85,1.1); tr=(0.42-0.2*t)
        ang=math.radians(side*(140+random.uniform(-8,8)))
        cone((px+math.sin(ang)*tl*0.4,random.uniform(-0.15,0.15),pz+math.cos(ang)*tl*0.4-0.05),tr,0.02,tl,NEEDLE,verts=10,ol=ol,rot=(0,ang,0))
    if snow:
        sd=math.radians(droop if side>0 else -droop)
        s=sphere((x0+dx*(length*0.48+0.1),-0.1,z+dz*length*0.48+0.26),(length*0.46,0.4,0.15),SNOWM,ol=ol)
        s.rotation_euler=(0,sd,0)
def birdhouse(z,x,ol):
    RED=toon('bh',srgb('c9493a'),srgb('7a2430'),srgb('e87a5f'))
    cube((x,-0.3,z),(0.55,0.4,0.6),RED,ol=ol)
    for s_ in (-1,1):
        cube((x+s_*0.2,-0.3,z+0.38),(0.42,0.52,0.08),T(SNOW),rot=(0,math.radians(s_*38),0),ol=ol)
    sphere((x,-0.52,z+0.05),(0.1,0.02,0.1),flat('hole',(0.05,0.03,0.08)))
    cube((x,-0.55,z-0.15),(0.18,0.2,0.03),toon('perch',srgb('6b4428'),srgb('3a2216')))
def cones(z,x,ol):
    for i in range(random.randint(1,2)):
        sphere((x+i*0.15,-0.3,z-0.25-i*0.1),(0.08,0.08,0.15),toon('pc',srgb('7a4a2a'),srgb('3e2418'),srgb('a8703f')),ol=ol*0.6)
if job.startswith('forest'):
    lay=job.split('_')[1]
    if lay=='near':
        ol=0.045
        for x,side in ((-4.45,1),(4.5,-1)):
            trunk(x,0.6,ol)
            z=random.uniform(0,1.5)
            while z<TH:
                L=random.uniform(2.0,3.0)
                wrap(branch,z,2.0,x+side*0.3,side,L,ol)
                if random.random()<0.4: wrap(cones,z,2.0,x+side*(0.6+L*0.5),ol)
                z+=random.uniform(2.2,3.0)
        wrap(birdhouse,9.0,2.0,-3.55,ol)
    elif lay=='mid':
        ol=0.035
        for x in (-2.7,0.4,3.0):
            trunk(x,0.33,ol)
            for side in (1,-1):
                z=random.uniform(0,2)
                while z<TH:
                    wrap(branch,z,2.0,x+side*0.15,side,random.uniform(0.9,1.6),ol); z+=random.uniform(2.2,3.4)
    else:
        ol=0.025
        for x in (-3.6,-1.6,1.4,3.5,-0.2):
            trunk(x,0.2,ol)
            for side in (1,-1):
                z=random.uniform(0,2)
                while z<TH:
                    wrap(branch,z,2.0,x+side*0.1,side,random.uniform(0.6,1.1),ol,snow=False); z+=random.uniform(1.8,2.8)
elif job.startswith('fjell'):
    lay=job.split('_')[1]
    ROCK=toon('rock',srgb('7b7596'),srgb('3b3658'),srgb('b0aacb'),lo=0.22,mid=0.30)
    ICE=toon('ice',srgb('bfe3f5'),srgb('6fa4cf'),srgb('ffffff'))
    def rock(z,x,r,ol,ledge):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=r,location=(x,0.5,z)); o=last()
        for v in o.data.vertices: v.co*= (1+random.uniform(-0.18,0.18))
        o.scale=(1.0,0.8,random.uniform(0.75,1.0)); mat(o,ROCK); outline(o,ol)
        if ledge:
            blobs([(x+random.uniform(-0.2,0.2)*r,0.3,z+r*0.72,r*0.62),(x+0.35*r,0.2,z+r*0.62,r*0.45)],SNOWM,ol=ol,res=0.05)
            for i in range(random.randint(2,4)):
                ix=x+random.uniform(-0.5,0.5)*r
                L=random.uniform(0.25,0.6)
                cone((ix,-0.2,z-r*0.55-L/2),0.07,0.0,L,ICE,verts=8,ol=ol*0.5,rot=(math.radians(180),0,0))
    if lay=='near':
        ol=0.045
        for side in (-1,1):
            z=-1
            while z<TH+1:
                r=random.uniform(1.3,2.0); x=side*random.uniform(4.7,5.3)
                wrap(rock,z,3.0,x,r,ol,random.random()<0.35)
                if random.random()<0.55:
                    r2=random.uniform(0.7,1.1); wrap(rock,z+random.uniform(-0.4,0.4),3.0,side*random.uniform(3.5,3.9),r2,ol,random.random()<0.6)
                z+=r*random.uniform(0.75,1.0)
        # little dwarf pine on a ledge
        pine(-3.2,-0.2,1.4,ol=0.03)
    else:
        ol=0.03
        for x0 in (-3.2,2.9):
            z=-1
            while z<TH+1:
                r=random.uniform(0.8,1.3); x=x0+random.uniform(-0.4,0.4)
                if random.random()<0.85: wrap(rock,z,2.0,x,r,ol,random.random()<0.5)
                z+=r*random.uniform(0.8,1.3)
elif job.startswith('cloud'):
    cam.data.ortho_scale=6.4; cam.location=(0,-40,0)
    random.seed(int(job[-1])*7)
    pts=[]
    n=random.randint(7,9)
    for i in range(n):
        x=-2.3+4.6*i/(n-1); pts.append((x,0,-0.25,0.75))
    for i in range(random.randint(3,5)):
        x=random.uniform(-1.6,1.6); pts.append((x,0,random.uniform(0.2,0.55)*(1-abs(x)/2.5)+0.1,random.uniform(0.75,1.05)))
    blobs(pts,toon('cloud',srgb('eef0ff'),srgb('a79fd2'),srgb('ffffff'),lo=0.25,mid=0.4),ol=0.045,res=0.06)
elif job=='moon':
    cam.data.ortho_scale=3.2; cam.location=(0,-40,0)
    sphere((0,0,0),(1.2,1.2,1.2),toon('moon',srgb('fbf0c9'),srgb('c9b98f'),srgb('ffffff'),lo=0.1,mid=0.3),ol=0.04,seg=64)
    for (x,z,r) in [(-0.4,0.35,0.22),(0.35,-0.3,0.3),(0.5,0.45,0.13),(-0.3,-0.55,0.12),(-0.75,-0.1,0.1)]:
        y=-math.sqrt(max(0,1.2**2-x*x-z*z))+0.02
        sphere((x,y,z),(r,0.05,r),toon('crater',srgb('e0d2a8'),srgb('b5a57c')))
render(f'/home/claude/test/zones/{job}_{q}.png')
