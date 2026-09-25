import bpy, math, random, bmesh
def srgb(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(((x+0.055)/1.055)**2.4 if x>0.04045 else x/12.92 for x in c)
def setup(res=(720,1280),samples=32,cz=8):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S=bpy.context.scene
    S.render.engine='BLENDER_EEVEE'; S.render.film_transparent=True
    S.view_settings.view_transform='Standard'; S.eevee.taa_render_samples=samples
    S.render.resolution_x,S.render.resolution_y=res
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); S.collection.objects.link(sun)
    sun.rotation_euler=(math.radians(55),math.radians(-40),math.radians(-25)); sun.data.energy=3; sun.data.use_shadow=False
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); S.collection.objects.link(cam); S.camera=cam
    cam.data.type='ORTHO'; cam.data.ortho_scale=16
    cam.rotation_euler=(math.radians(80),0,0)
    # place camera so that world z=0,y=0 maps to screen, center of frame at z=8
    cam.location=(0,-40*math.sin(math.radians(80)), cz + 40*math.cos(math.radians(80)))
    return S
_cache={}
def toon(name,col,shade,hi=None,lo=0.18,mid=0.32):
    key=(name,col,shade,hi)
    if key in _cache: return _cache[key]
    m=bpy.data.materials.new(name); nt=m.node_tree if m.node_tree else None
    m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links; N.clear()
    out=N.new('ShaderNodeOutputMaterial'); d=N.new('ShaderNodeBsdfDiffuse')
    s2r=N.new('ShaderNodeShaderToRGB'); L.new(d.outputs[0],s2r.inputs[0])
    bw=N.new('ShaderNodeRGBToBW'); L.new(s2r.outputs[0],bw.inputs[0])
    cr=N.new('ShaderNodeValToRGB'); cr.color_ramp.interpolation='EASE'; e=cr.color_ramp.elements
    e[0].position=lo; e[0].color=(*shade,1); e[1].position=mid; e[1].color=(*col,1)
    if hi: a=e.new(0.75); a.color=(*col,1); b=e.new(0.85); b.color=(*hi,1)
    L.new(bw.outputs[0],cr.inputs[0]); em=N.new('ShaderNodeEmission'); L.new(cr.outputs[0],em.inputs[0]); L.new(em.outputs[0],out.inputs[0])
    _cache[key]=m; return m
def flat(name,col,strength=1.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; N=m.node_tree.nodes; N.clear()
    o=N.new('ShaderNodeOutputMaterial'); e=N.new('ShaderNodeEmission'); e.inputs[0].default_value=(*col,1); e.inputs[1].default_value=strength
    m.node_tree.links.new(e.outputs[0],o.inputs[0]); return m
_ol={}
def outline(o,th=0.04,col=(0.06,0.04,0.12)):
    if col not in _ol:
        m=flat('outline',col); m.use_backface_culling=True; _ol[col]=m
    o.data.materials.append(_ol[col])
    sm=o.modifiers.new('ol','SOLIDIFY'); sm.thickness=th; sm.offset=1; sm.use_flip_normals=True; sm.material_offset=len(o.data.materials)-1
def smooth(o):
    for p in o.data.polygons: p.use_smooth=True
def mat(o,m): o.data.materials.append(m); return o
def last(): return bpy.context.object
def cube(loc,scale,m,rot=(0,0,0),ol=None,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot); o=last(); o.scale=scale
    bpy.ops.object.transform_apply(scale=True)
    if bevel: b=o.modifiers.new('bv','BEVEL'); b.width=bevel; b.segments=3
    mat(o,m)
    if ol: outline(o,ol)
    return o
def cone(loc,r1,r2,depth,m,verts=24,ol=None,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=loc,rotation=rot); o=last(); smooth(o); mat(o,m)
    if ol: outline(o,ol)
    return o
def sphere(loc,scale,m,ol=None,seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=seg//2,radius=1,location=loc); o=last(); o.scale=scale; smooth(o); mat(o,m)
    if ol: outline(o,ol)
    return o
def blobs(points,m,ol=None,res=0.06):
    mb=bpy.data.metaballs.new('mb'); mo=bpy.data.objects.new('mb',mb); bpy.context.scene.collection.objects.link(mo)
    mb.resolution=res; mb.render_resolution=res
    for (x,y,z,r) in points:
        e=mb.elements.new(); e.co=(x,y,z); e.radius=r
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active=mo; mo.select_set(True)
    bpy.ops.object.convert(target='MESH'); o=bpy.context.view_layer.objects.active
    smooth(o); mat(o,m)
    if ol: outline(o,ol)
    return o
# palettes
PINE=('pine','#2f6b55','#173a3a','#5fa383')
SNOW=('snow','#eef4fb','#9fb2d8','#ffffff')
TRUNK=('trunk','#6b4428','#3a2216',None)
def T(p): return toon(p[0],srgb(p[1]),srgb(p[2]),srgb(p[3]) if p[3] else None)
def pine(x,y,h,ol=0.035,snow=True,tiers=4,pal=PINE):
    rnd=random.random
    cube((x,y,h*0.08),(h*0.07,h*0.07,h*0.2),T(TRUNK),ol=ol)
    for i in range(tiers):
        f=1-i/(tiers+0.6)
        r=h*0.36*f*(0.92+0.16*rnd()); d=h*0.36*(0.85+0.3*rnd())*(0.9 if i else 1)
        bz=h*0.16+i*h*0.2
        cone((x,y,bz+d/2),r,0,d,T(pal),ol=ol,verts=20)
        if snow:
            k=0.42+0.12*rnd(); d2=d*k
            cone((x,y-0.01,bz+d-d2/2+0.01),r*k*1.08,0,d2,T(SNOW),ol=ol,verts=20)
def render(path):
    S=bpy.context.scene; S.render.filepath=path; bpy.ops.render.render(write_still=True)
