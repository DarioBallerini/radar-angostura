import json,math
from shapely.geometry import Polygon,LineString,Point,MultiPolygon,box,mapping
from shapely.ops import unary_union,voronoi_diagram
from shapely import MultiPoint
R=json.load(open('/mnt/project-files/casa-tracker/map/decoded.json'))
C=math.cos(math.radians(40.76))
def P(lon,lat):return ((lon+71.64)*C*111320,(lat+40.76)*110574)
def U(x,y):return (round(x/(C*111320)-71.64,5),round(y/110574-40.76,5))
def poly(pts):return Polygon([P(*p) for p in pts]).buffer(0)
def line(pts):return LineString([P(*p) for p in pts])
A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
def dec(code):
  nums=[];v=sh=0
  for ch in code:
    b=A.index(ch);v|=(b&31)<<sh
    if b&32: sh+=5
    else: nums.append(~(v>>1) if v&1 else v>>1);v=sh=0
  pts=[];la=lo=0
  for i in range(0,len(nums)-1,2):
    la+=nums[i];lo+=nums[i+1];pts.append((lo*1e-5,la*1e-5))
  return pts
NH=[(x.split('|')[0],dec(x.split('|')[2])) for x in open('/mnt/project-files/casa-tracker/map/nh.txt').read().strip().split('~')]
nahuel=unary_union([poly(p) for t,p in NH if t=='O']).difference(unary_union([poly(p) for t,p in NH if t=='I']))
for r in R:
  if r['n']=='Lago Nahuel Huapi': r['geom']=nahuel
lakes=unary_union([r.get('geom') or poly(r['p']) for r in R if r['t'] in 'LW'])
roads=[line(r['p']) for r in R if r['t'] in 'rR' and len(r['p'])>1]
frame=box(*P(-71.705,-40.795),*P(-71.575,-40.725))
land=frame.difference(lakes)
urban=unary_union([l.buffer(230) for l in roads]).buffer(120).buffer(-120).intersection(land)
alias={'Norte':'Barrio Norte'}
off={alias.get(r['n'],r['n']):poly(r['p']) for r in R if r['t']=='B'}
offU=unary_union(list(off.values()))
# fix official overlaps: later ones minus earlier
seen=None
for k in list(off):
  g=off[k]
  if seen is not None:g=g.difference(seen)
  off[k]=g; seen=g if seen is None else seen.union(g)
seeds={ # nombre: (lon,lat)
 'Centro':(-71.6462,-40.7638),'El Once':(-71.64284,-40.76523),'Las Balsas':(-71.62557,-40.77495),
 'Los Volcanes':(-71.62152,-40.76426),'Cumelén':(-71.61493,-40.78419),'Puerto Manzano':(-71.59361,-40.7945),
 'La Villa (Puerto)':(-71.65079,-40.77379),'Puertos de la Villa':(-71.65952,-40.78145),
 'Villa Correntoso':(-71.67307,-40.73332),'Bandurrias':(-71.67827,-40.7279),'Arauco':(-71.6847,-40.7206),
 'Las Margaritas':(-71.65975,-40.76204),'El Mallín':(-71.6568,-40.76627),'Belvedere':(-71.6665,-40.7650),
 'Faldeo del Bayo':(-71.6075,-40.7735),'Macrolotes':(-71.6345,-40.7537),'76 Viviendas':(-71.63907,-40.75782),
 'Cahuín Hué':(-71.66175,-40.75665),'La Cabaña':(-71.65869,-40.76087),

}
dom=urban.difference(offU.buffer(1))
pts={k:Point(P(*v)) for k,v in seeds.items()}
vd=voronoi_diagram(MultiPoint(list(pts.values())),envelope=frame.buffer(3000))
approx={}
for cell in vd.geoms:
  k=next(n for n,p in pts.items() if cell.contains(p))
  g=cell.intersection(dom).intersection(pts[k].buffer(3200))
  parts=[g] if g.geom_type=='Polygon' else [x for x in getattr(g,'geoms',[]) if x.geom_type=='Polygon']
  if not parts: print('vacío',k);continue
  big=max(p.area for p in parts)
  parts=[p.buffer(-15).buffer(15) for p in parts if p.area>max(.12*big,20000) or p.contains(pts[k])]
  approx[k]=unary_union(parts).simplify(8)
def rings(g):
  gs=[g] if g.geom_type=='Polygon' else list(g.geoms)
  out=[]
  for p in gs:
    if p.is_empty or p.geom_type!='Polygon':continue
    out.append([[U(*c) for c in p.exterior.coords]]+[[U(*c) for c in i.coords] for i in p.interiors if Polygon(i).area>5000])
  return out
def lbl(g):
  c=g.representative_point() if not g.centroid.within(g) else g.centroid
  return U(c.x,c.y)
areas=[]
for k,g in off.items():areas.append({'n':k,'o':1,'p':rings(g.simplify(3)),'c':lbl(g),'a':round(g.area/1e4,1)})
for k,g in approx.items():areas.append({'n':k,'o':0,'p':rings(g),'c':lbl(g),'a':round(g.area/1e4,1)})
def lc(pts,t):
  g=LineString([P(*p) for p in pts]).simplify(t);return [U(*c) for c in g.coords]
out={'bbox':[-71.705,-40.795,-71.575,-40.725],'areas':areas,
 'lakes':[{'n':r['n'],'p':rings((r.get('geom') or poly(r['p'])).intersection(frame.buffer(1500)).simplify(8))} for r in R if r['t'] in 'LW'],
 'R':[lc(r['p'],6) for r in R if r['t']=='R'],'r':[lc(r['p'],6) for r in R if r['t']=='r'],
 'w':[lc(r['p'],10) for r in R if r['t']=='w'],
 'places':[{'n':r['n'],'c':r['p']} for r in R if r['t']=='P'],
 'src':'© OpenStreetMap contributors (ODbL)'}
s=json.dumps(out,ensure_ascii=False,separators=(',',':'))
open('/mnt/project-files/casa-tracker/data/vla-map.json','w').write(s)
print(len(s));[print(a['n'],a['o'],a['a'],'ha',len(a['p'])) for a in areas]
