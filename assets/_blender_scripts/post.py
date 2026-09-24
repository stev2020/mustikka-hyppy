from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np, math, random
W,H=720,1280
def sky(h=H):
    a=np.zeros((h,W,4),np.uint8); stops=[(0,(18,16,52)),(0.45,(58,40,104)),(0.75,(128,78,138)),(1,(232,146,118))]
    for y in range(h):
        t=y/H
        for i in range(len(stops)-1):
            if stops[i][0]<=t<=stops[i+1][0]:
                f=(t-stops[i][0])/(stops[i+1][0]-stops[i][0]); c=[stops[i][1][k]+(stops[i+1][1][k]-stops[i][1][k])*f for k in range(3)]; break
        else: c=stops[-1][1]
        a[y,:,:3]=c; a[y,:,3]=255
    im=Image.fromarray(a,'RGBA'); d=ImageDraw.Draw(im); random.seed(4)
    for _ in range(110):
        x,y=random.randint(0,W),random.randint(0,int(h*0.6)); r=random.choice([1,1,1,2])
        d.ellipse([x-r,y-r,x+r,y+r],fill=(255,250,235,random.randint(110,255)))
    return im
def aurora():
    au=Image.new('RGBA',(W,H),(0,0,0,0)); ad=ImageDraw.Draw(au)
    for i in range(0,W,2):
        yy=300+70*math.sin(i/110+0.5)+22*math.sin(i/41)
        ad.line([(i,yy-180),(i,yy)],fill=(70,220,160,55),width=3)
        ad.line([(i,yy-70),(i,yy)],fill=(130,255,200,85),width=3)
        ad.line([(i,yy-250),(i,yy-150)],fill=(150,90,220,35),width=3)
    return au.filter(ImageFilter.GaussianBlur(14))
def tint(im,col,amt):
    a=np.array(im).astype(float); a[...,:3]=a[...,:3]*(1-amt)+np.array(col)*amt; return Image.fromarray(a.astype(np.uint8),'RGBA')
def glow(im,rad=22,strength=1.0):
    a=np.array(im).astype(int); m=(a[...,0]>225)&(a[...,1]>180)&((a[...,0]-a[...,2])>45)&(a[...,3]>200)
    al=Image.fromarray((m*255).astype(np.uint8),'L').filter(ImageFilter.GaussianBlur(rad))
    al=np.clip(np.array(al).astype(float)*2.4*strength,0,200).astype(np.uint8)
    g=np.zeros(a.shape,np.uint8); g[...,0]=255; g[...,1]=185; g[...,2]=90; g[...,3]=al
    return Image.fromarray(g,'RGBA')
far=tint(Image.open('far_hi.png'),(120,96,170),0.38)
mid=tint(Image.open('mid_hi.png'),(120,96,170),0.12)
near=Image.open('near_hi.png')
L={'sky':sky(),'aurora':aurora(),'far':far,'mid':mid,'midglow':glow(mid),'near':near,'nearglow':glow(near,18)}
for k,v in L.items(): v.save(f'layer_{k}.png')
c=L['sky'].copy()
for k in ['aurora','far','mid','midglow','near','nearglow']: c.alpha_composite(L[k])
c.convert('RGB').save('bg_composite.png')
