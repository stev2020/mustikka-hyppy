import sys, math, random, bpy
sys.path.insert(0,'/home/claude/test/bg')
from lib import *
args=sys.argv[sys.argv.index('--')+1:]; layer=args[0]; q=args[1] if len(args)>1 else 'hi'
res=(720,1280) if q=='hi' else (360,640)
S=setup(res,32 if q=='hi' else 4,cz={'far':1.5,'mid':4.0,'near':6.2}[layer])
random.seed({'far':1,'mid':2,'near':3}[layer])
W=4.5  # half width
if layer=='far':
    # fells (tunturi) with snowy tops, height-based snow
    m=bpy.data.materials.new('fell'); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links; N.clear()
    out=N.new('ShaderNodeOutputMaterial'); d=N.new('ShaderNodeBsdfDiffuse'); s2r=N.new('ShaderNodeShaderToRGB'); L.new(d.outputs[0],s2r.inputs[0])
    bw=N.new('ShaderNodeRGBToBW'); L.new(s2r.outputs[0],bw.inputs[0])
    lit=N.new('ShaderNodeValToRGB'); e=lit.color_ramp.elements; lit.color_ramp.interpolation='EASE'
    e[0].position=0.2; e[0].color=(0.55,0.55,0.62,1); e[1].position=0.32; e[1].color=(1,1,1,1)
    L.new(bw.outputs[0],lit.inputs[0])
    geo=N.new('ShaderNodeNewGeometry'); sep=N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'],sep.inputs[0])
    nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=0.7; L.new(geo.outputs['Position'],nz.inputs[0])
    ma=N.new('ShaderNodeMath'); ma.operation='MULTIPLY_ADD'; L.new(nz.outputs['Fac'],ma.inputs[0]); ma.inputs[1].default_value=0.9; L.new(sep.outputs['Z'],ma.inputs[2])
    st=N.new('ShaderNodeValToRGB'); se=st.color_ramp.elements; st.color_ramp.interpolation='CONSTANT'
    se[0].position=0; se[0].color=(*srgb('5a4f86'),1); se[1].position=0.0; se[1].color=(*srgb('5a4f86'),1)
    x=se.new(2.5/5); x.color=(*srgb('dfe6f7'),1)
    mp=N.new('ShaderNodeMapRange'); mp.inputs[1].default_value=0; mp.inputs[2].default_value=5; L.new(ma.outputs[0],mp.inputs[0]); L.new(mp.outputs[0],st.inputs[0])
    mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1
    L.new(st.outputs[0],mx.inputs[6]); L.new(lit.outputs[0],mx.inputs[7])
    em=N.new('ShaderNodeEmission'); L.new(mx.outputs[2],em.inputs[0]); L.new(em.outputs[0],out.inputs[0])
    for (x,sx,sz,y) in [(-4.0,4.5,3.8,14),(1.6,5.5,4.6,16),(6.0,4.0,3.4,13),(-1.6,3.6,2.4,10),(3.6,3.4,2.2,9.5),(-5.2,2.6,1.9,9)]:
        o=sphere((x,y,-0.8),(sx,2.0,sz),m,seg=64); outline(o,0.03,srgb('2e2654'))
    # distant pine band (silhouette, no snow)
    far=('farpine','#34506a','#233651',None)
    x=-W-0.3
    while x<W+0.3:
        pine(x,6+random.uniform(0,2),random.uniform(0.9,1.5),ol=0.02,snow=False,tiers=3,pal=far); x+=random.uniform(0.25,0.45)
    blobs([(xx,6,-0.35,0.8) for xx in [i*0.6-W-0.5 for i in range(17)]],T(('fsnow','#c9d3ec','#8b95c4',None)),ol=0.02,res=0.1)
    cube((0,5.5,-6),(12,1,12),T(('fsnow','#c9d3ec','#8b95c4',None)))
elif layer=='mid':
    cube((0,1.5,-6.3),(12,1,12),T(SNOW))
    # snowy bank
    blobs([(xx,2,random.uniform(-0.1,0.3),random.uniform(0.9,1.3)) for xx in [i*0.8-W-0.6 for i in range(14)]],T(SNOW),ol=0.035,res=0.08)
    # forest
    xs=[-4.3,-3.5,-2.8,-2.0,1.0,1.8,2.7,3.6,4.4]
    for x in xs: pine(x+random.uniform(-0.15,0.15),3.5+random.uniform(0,1.5),random.uniform(2.6,3.8),ol=0.035)
    # red cabin centered-left
    FALU=toon('falu',srgb('b3372c'),srgb('6a1d24'),srgb('e0664f'))
    WHITE=T(SNOW); DARK=toon('roof',srgb('3b2a3a'),srgb('22162a'))
    cx,cy,bz=-0.6,2.2,0.6
    cube((cx,cy,bz+0.75),(2.4,1.8,1.5),FALU,ol=0.035)
    for sx in (-1,1):
        cube((cx+sx*1.2,cy-0.9,bz+0.75),(0.12,0.12,1.55),WHITE,ol=0.02)
    # gable roof
    for sx in (-1,1):
        r=cube((cx+sx*0.72,cy,bz+1.95),(1.7,2.2,0.14),DARK,rot=(0,math.radians(sx*35),0),ol=0.03)
        cube((cx+sx*0.70,cy,bz+2.06),(1.72,2.24,0.14),WHITE,rot=(0,math.radians(sx*35),0),ol=0.03,bevel=0.05)
    # gable front triangle
    import bmesh
    me=bpy.data.meshes.new('gable'); g=bpy.data.objects.new('gable',me); S.collection.objects.link(g)
    bm=bmesh.new(); v=[bm.verts.new(p) for p in [(-1.2,0,0),(1.2,0,0),(0,0,0.85)]]; f=bm.faces.new(v)
    r=bmesh.ops.extrude_face_region(bm,geom=[f]); 
    for vv in [e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]: vv.co.y+=1.8
    bm.to_mesh(me); bm.free(); g.location=(cx,cy-0.9,bz+1.5); mat(g,FALU); outline(g,0.03)
    WIN=flat('window',(1.0,0.78,0.38),1.0)
    for wx in (-0.55,0.55):
        cube((cx+wx,cy-0.92,bz+0.85),(0.52,0.05,0.6),WHITE,ol=0.02)
        cube((cx+wx,cy-0.96,bz+0.85),(0.38,0.05,0.46),WIN)
        cube((cx+wx,cy-0.99,bz+0.85),(0.04,0.03,0.46),WHITE); cube((cx+wx,cy-0.99,bz+0.85),(0.38,0.03,0.04),WHITE)
    cube((cx,cy-0.92,bz+2.0),(0.3,0.05,0.3),WIN)
    cube((cx+0.9,cy+0.3,bz+2.6),(0.3,0.3,0.8),toon('brick',srgb('7a3b35'),srgb('45202a')),ol=0.025)
    blobs([(cx+0.9,cy+0.3,bz+3.0,0.22)],WHITE,ol=0.02,res=0.04)
else:  # near: lake, sauna, jetty, foreground pines
    WATER=bpy.data.materials.new('water'); WATER.use_nodes=True; nt=WATER.node_tree; N=nt.nodes; L=nt.links; N.clear()
    out=N.new('ShaderNodeOutputMaterial'); tc=N.new('ShaderNodeTexCoord'); mp=N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(0.35,3.2,1)
    L.new(tc.outputs['Object'],mp.inputs[0]); wv=N.new('ShaderNodeTexWave'); wv.wave_type='BANDS'; wv.bands_direction='Y'; wv.inputs['Scale'].default_value=1.4; wv.inputs['Distortion'].default_value=9; L.new(mp.outputs[0],wv.inputs[0])
    cr=N.new('ShaderNodeValToRGB'); e=cr.color_ramp.elements; cr.color_ramp.interpolation='CONSTANT'
    e[0].position=0; e[0].color=(*srgb('2c3a78'),1); e[1].position=0.9; e[1].color=(*srgb('6d7fc4'),1)
    L.new(wv.outputs['Fac'],cr.inputs[0]); em=N.new('ShaderNodeEmission'); L.new(cr.outputs[0],em.inputs[0]); L.new(em.outputs[0],out.inputs[0])
    bpy.ops.mesh.primitive_plane_add(size=1,location=(0,-12,0)); lake=last(); lake.scale=(12,34,1); mat(lake,WATER)
    # far shore snow line
    blobs([(xx,4.6,-0.1,random.uniform(0.35,0.55)) for xx in [i*0.55-W-0.5 for i in range(19)]],T(SNOW),ol=0.03,res=0.05)
    # left shore with sauna
    blobs([(-W+xx,yy,0,r) for xx,yy,r in [(-0.3,2.5,1.5),(0.6,2.6,1.4),(1.6,3.0,1.1),(-0.2,0.6,1.4),(0.8,1.0,1.2),(1.5,0.4,0.8)]],T(SNOW),ol=0.035,res=0.08)
    LOG=toon('log',srgb('5b3a2a'),srgb('2e1c1c'),srgb('8a5c3d'))
    sx,sy,sz=-3.3,2.3,0.9
    for i in range(6):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=0.13,depth=1.9,location=(sx,sy-0.6,sz+i*0.24),rotation=(0,math.radians(90),0)); o=last(); smooth(o); mat(o,LOG); outline(o,0.025)
    cube((sx,sy,sz+0.7),(1.8,1.2,1.4),LOG)
    for s_ in (-1,1):
        cube((sx+s_*0.55,sy,sz+1.6),(1.25,1.6,0.12),toon('roof2',srgb('3b2a3a'),srgb('22162a')),rot=(0,math.radians(s_*30),0),ol=0.03)
        cube((sx+s_*0.53,sy,sz+1.7),(1.27,1.64,0.12),T(SNOW),rot=(0,math.radians(s_*30),0),ol=0.03,bevel=0.05)
    cube((sx+0.45,sy-0.75,sz+0.75),(0.34,0.05,0.28),flat('window',(1.0,0.78,0.38)))
    cube((sx-0.4,sy-0.75,sz+0.55),(0.45,0.05,0.95),toon('door',srgb('3a2418'),srgb('1f120e')),ol=0.02)
    cube((sx+0.5,sy+0.2,sz+2.1),(0.22,0.22,0.6),toon('stack',srgb('4a4a5a'),srgb('25252f')),ol=0.02)
    # steam
    for i,(dx,dz,r) in enumerate([(0.55,2.65,0.2),(0.7,2.95,0.27),(0.95,3.3,0.33),(1.3,3.7,0.4)]):
        sphere((sx+dx,sy+0.2,sz+dz),(r,r,r*0.85),toon('steam',srgb('d9dcf0'),srgb('9ea3c8')),ol=0.02)
    # jetty
    WOOD=toon('wood',srgb('9a6436'),srgb('55331c'),srgb('c68d55'))
    for i in range(9):
        cube((-2.9+i*0.36,-0.2,0.3),(0.32,1.2,0.08),WOOD,ol=0.02)
    for px in (-2.5,-0.3):
        for py in (-0.7,):
            cube((px,py,0.05),(0.14,0.14,0.5),LOG,ol=0.02)
    # reflections of sauna window on water
    for i,(w,dz) in enumerate([(0.5,0.0),(0.35,0.0),(0.22,0.0)]):
        cube((sx+0.45,-1.2-i*2.5,0.01),(w,0.08,0.01),flat('refl',(0.95,0.72,0.45)))
    # foreground right: snowy rocks + big pines
    blobs([(W-0.2+xx,yy,0,r) for xx,yy,r in [(0,-12,1.6),(-1.0,-14,1.1),(0.3,-9,1.2)]],T(SNOW),ol=0.045,res=0.08)
    pine(W-0.3,-11,5.6,ol=0.05); pine(W-1.5,-14,3.8,ol=0.05)
    blobs([(-W+xx,yy,0,r) for xx,yy,r in [(0,-20,1.4),(0.9,-22,1.0)]],T(SNOW),ol=0.045,res=0.08)
    pine(-W+0.2,-20,4.2,ol=0.05)
    # foreground left bottom rock
    sphere((0.6,-22,-0.3),(0.9,0.6,0.5),toon('rock',srgb('6c6a8a'),srgb('3a3858'),srgb('9a98ba')),ol=0.035)
    blobs([(0.6,-22,0.1,0.55),(1.0,-22.3,0.05,0.4)],T(SNOW),ol=0.03,res=0.05)
render(f'/home/claude/test/bg/{layer}_{q}.png')
