import bpy, math, sys
from mathutils import Vector
which=sys.argv[sys.argv.index('--')+1]; pose=sys.argv[sys.argv.index('--')+2] if len(sys.argv)>sys.argv.index('--')+2 else 'idle'
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene
S.render.engine='BLENDER_EEVEE'
S.render.film_transparent=True
S.view_settings.view_transform='Standard'
S.eevee.taa_render_samples=64
S.render.resolution_x=S.render.resolution_y=512
if which in('plank','word'): S.render.resolution_x=1024; S.render.resolution_y=320

def toon(name,col,shade,hi=None,rim=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links
    N.clear()
    out=N.new('ShaderNodeOutputMaterial')
    d=N.new('ShaderNodeBsdfDiffuse'); d.inputs[0].default_value=(1,1,1,1)
    s2r=N.new('ShaderNodeShaderToRGB'); L.new(d.outputs[0],s2r.inputs[0])
    bw=N.new('ShaderNodeRGBToBW'); L.new(s2r.outputs[0],bw.inputs[0])
    cr=N.new('ShaderNodeValToRGB'); cr.color_ramp.interpolation='EASE'
    e=cr.color_ramp.elements
    e[0].position=0.18; e[0].color=(*shade,1)
    e[1].position=0.32; e[1].color=(*col,1)
    if hi:
        x=e.new(0.75); x.color=(*col,1); y=e.new(0.85); y.color=(*hi,1)
    L.new(bw.outputs[0],cr.inputs[0])
    em=N.new('ShaderNodeEmission'); L.new(cr.outputs[0],em.inputs[0])
    L.new(em.outputs[0],out.inputs[0])
    return m
def flat(name,col,strength=1.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; N=m.node_tree.nodes; N.clear()
    o=N.new('ShaderNodeOutputMaterial'); e=N.new('ShaderNodeEmission'); e.inputs[0].default_value=(*col,1); e.inputs[1].default_value=strength
    m.node_tree.links.new(e.outputs[0],o.inputs[0]); return m
OUT=flat('outline',(0.06,0.04,0.12))
OUT.use_backface_culling=True
def outline(o,th=0.05):
    o.data.materials.append(OUT)
    sm=o.modifiers.new('ol','SOLIDIFY'); sm.thickness=th; sm.offset=1; sm.use_flip_normals=True; sm.material_offset=len(o.data.materials)-1
def smooth(o):
    for p in o.data.polygons: p.use_smooth=True
def srgb(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(((x+0.055)/1.055)**2.4 if x>0.04045 else x/12.92 for x in c)

sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); S.collection.objects.link(sun)
sun.rotation_euler=(math.radians(50),math.radians(-35),math.radians(-20)); sun.data.energy=3; sun.data.use_shadow=False
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); S.collection.objects.link(cam); S.camera=cam
cam.data.type='ORTHO'; cam.location=(0,-10,0); cam.rotation_euler=(math.radians(90),0,0)

if which=='berry':
    cam.data.ortho_scale=3.2
    sq={'idle':(1,1,1),'jump':(0.88,0.88,1.16),'land':(1.18,1.18,0.82),'hurt':(1,1,1)}[pose]
    root=bpy.data.objects.new('root',None); S.collection.objects.link(root)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,radius=1)
    b=bpy.context.object; b.scale=(1.0,0.95,0.92); smooth(b); b.parent=root
    b.data.materials.append(toon('berry',srgb('4a5fd0'),srgb('27296e'),srgb('9fb0ff'))); outline(b,0.045)
    # dusty bloom speckles
    # calyx: 5-point star crown
    import bmesh
    me=bpy.data.meshes.new('calyx'); c=bpy.data.objects.new('calyx',me); S.collection.objects.link(c)
    bm=bmesh.new(); vs=[]
    for i in range(10):
        a=i*math.pi/5; r=0.42 if i%2==0 else 0.16
        vs.append(bm.verts.new((r*math.cos(a),r*math.sin(a),0)))
    f=bm.faces.new(vs); ex=bmesh.ops.extrude_face_region(bm,geom=[f]); 
    for v in [e for e in ex['geom'] if isinstance(e,bmesh.types.BMVert)]: v.co.z+=0.08
    bm.to_mesh(me); bm.free()
    c.location=(0,0,0.86); c.parent=root
    c.data.materials.append(toon('calyx',srgb('2c2f78'),srgb('17184a'))); outline(c,0.03)
    # leaf
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3,location=(0.28,0,1.12))
    lf=bpy.context.object; lf.scale=(1.1,0.35,0.45); lf.rotation_euler=(0,math.radians(-30),0); smooth(lf); lf.parent=root
    lf.data.materials.append(toon('leaf',srgb('5cc46a'),srgb('2e7d43'),srgb('b6f0a0'))); outline(lf,0.03)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035,depth=0.3,location=(0.06,0,1.05))
    st=bpy.context.object; st.rotation_euler=(0,math.radians(20),0); st.parent=root; st.data.materials.append(flat('stem',srgb('3b2a1a')))
    # eyes
    hurt=pose=='hurt'
    for sx in (-1,1):
        x=0.33*sx
        if hurt:
            for a in (45,-45):
                bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-0.93,0.12))
                k=bpy.context.object; k.scale=(0.26,0.02,0.05); k.rotation_euler=(0,math.radians(a),0); k.parent=root
                k.data.materials.append(flat('dk',(0.02,0.02,0.05)))
            continue
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=0.22,location=(x,-0.83,0.13))
        e=bpy.context.object; e.scale=(0.9,0.5,1.15); smooth(e); e.parent=root
        e.data.materials.append(flat('white',(0.97,0.97,1))); outline(e,0.02)
        py=0.10 if pose=='jump' else 0.08
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12,location=(x+0.03*sx*0-0.0,-0.95,py))
        p=bpy.context.object; p.scale=(0.9,0.4,1.15); smooth(p); p.parent=root; p.data.materials.append(flat('pupil',(0.02,0.02,0.06)))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045,location=(x+0.04,-1.02,py+0.06))
        h=bpy.context.object; h.parent=root; h.data.materials.append(flat('glint',(1,1,1)))
    # cheeks
    for sx in (-1,1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11,location=(0.56*sx,-0.78,-0.12))
        ck=bpy.context.object; ck.scale=(1.2,0.3,0.7); ck.parent=root; ck.data.materials.append(flat('cheek',srgb('e86aa8')))
    # mouth
    if pose in ('jump','hurt'):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1,location=(0,-0.9,-0.25))
        mo=bpy.context.object; mo.scale=(1,0.3,1.2 if pose=='jump' else 0.6)
    else:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.11,minor_radius=0.022,location=(0,-0.9,-0.18))
        mo=bpy.context.object; mo.rotation_euler=(math.radians(90),0,0)
        import bmesh
        bm=bmesh.new(); bm.from_mesh(mo.data)
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.y>-0.01],context='VERTS'); bm.to_mesh(mo.data); bm.free()
    mo.parent=root; mo.data.materials.append(flat('mouth',(0.08,0.02,0.1)))
    root.scale=sq
    root.rotation_euler=(math.radians(-14),0,0)
    if pose=='hurt': root.rotation_euler=(math.radians(-14),math.radians(12),0)
else:
    cam.data.ortho_scale=6.4
    import bmesh
    bpy.ops.mesh.primitive_cube_add(size=1)
    p=bpy.context.object; p.scale=(5.4,0.8,0.62 if which=='plank' else 1.25)
    bpy.ops.object.transform_apply(scale=True)
    bv=p.modifiers.new('bv','BEVEL'); bv.width=0.12; bv.segments=4
    sub=p.modifiers.new('sd','SUBSURF'); sub.levels=1; sub.render_levels=1
    smooth(p)
    # wood grain material: wave texture into toon ramp
    m=bpy.data.materials.new('wood'); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links; N.clear()
    o=N.new('ShaderNodeOutputMaterial'); d=N.new('ShaderNodeBsdfDiffuse'); s2r=N.new('ShaderNodeShaderToRGB'); L.new(d.outputs[0],s2r.inputs[0])
    bw=N.new('ShaderNodeRGBToBW'); L.new(s2r.outputs[0],bw.inputs[0])
    cr=N.new('ShaderNodeValToRGB'); e=cr.color_ramp.elements
    e[0].position=0.2; e[0].color=(*srgb('5a3418'),1); e[1].position=0.34; e[1].color=(*srgb('b7773c'),1)
    L.new(bw.outputs[0],cr.inputs[0])
    tc=N.new('ShaderNodeTexCoord'); mp=N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(0.25,1,3.2)
    L.new(tc.outputs['Object'],mp.inputs[0])
    wv=N.new('ShaderNodeTexWave'); wv.wave_type='BANDS'; wv.bands_direction='Z'; wv.inputs['Scale'].default_value=1.2; wv.inputs['Distortion'].default_value=6; wv.inputs['Detail'].default_value=2
    L.new(mp.outputs[0],wv.inputs[0])
    gr=N.new('ShaderNodeValToRGB'); ge=gr.color_ramp.elements; ge[0].position=0.55; ge[0].color=(1,1,1,1); ge[1].position=0.62; ge[1].color=(0.7,0.6,0.55,1)
    L.new(wv.outputs['Fac'],gr.inputs[0])
    mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1
    L.new(cr.outputs[0],mx.inputs[6]); L.new(gr.outputs[0],mx.inputs[7])
    em=N.new('ShaderNodeEmission'); L.new(mx.outputs[2],em.inputs[0]); L.new(em.outputs[0],o.inputs[0])
    p.data.materials.append(m); outline(p,0.06)
    # nails
    for x in (-2.35,2.35):
        for z in ((0.14,-0.14) if which=='plank' else (0.36,-0.36)):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06,location=(x,-0.42,z))
            n=bpy.context.object; n.scale=(1,0.4,1); n.data.materials.append(toon('nail',srgb('9aa3b5'),srgb('4b5263'),srgb('ffffff')))
    if which=='word':
        S.render.filepath='/home/claude/test/word_plank.png'; bpy.ops.render.render(write_still=True); raise SystemExit
    # snow cap: blobby metaballs along top
    mb=bpy.data.metaballs.new('snow'); mo=bpy.data.objects.new('snow',mb); S.collection.objects.link(mo)
    mb.resolution=0.04; mb.render_resolution=0.03
    import random; random.seed(3)
    x=-2.6
    while x<2.6:
        el=mb.elements.new(); el.co=(x,random.uniform(-0.1,0.1),0.3+random.uniform(0,0.04)); el.radius=random.uniform(0.22,0.3)
        x+=random.uniform(0.25,0.4)
    mo.data.materials.append(toon('snowm',srgb('e9f2fb'),srgb('9fb6d6'),srgb('ffffff')))
    # outline for metaball: convert
    bpy.context.view_layer.objects.active=mo; mo.select_set(True)
    bpy.ops.object.convert(target='MESH')
    sm=[o for o in S.objects if o.type=='MESH' and o.name.startswith('snow')][0]
    # clip snow below plank top a bit
    bm=bmesh.new(); bm.from_mesh(sm.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<0.12 and abs(v.co.y)<0.3],context='VERTS'); bm.to_mesh(sm.data); bm.free()
    smooth(sm); outline(sm,0.045)
S.render.filepath=f'/home/claude/test/{which}_{pose}.png'
bpy.ops.render.render(write_still=True)
