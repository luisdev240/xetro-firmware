"""Tessellate LILYGO's published STEP parts for the interactive web model.
Run with cadquery-ocp-novtk and numpy, passing the downloaded 3D_files directory.
"""
import hashlib,json,sys
from pathlib import Path
import numpy as np
from OCP.STEPControl import STEPControl_Reader
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID,TopAbs_FACE,TopAbs_REVERSED
from OCP.TopoDS import TopoDS
from OCP.TopLoc import TopLoc_Location
from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh

source=Path(sys.argv[1])
out=Path(sys.argv[2]) if len(sys.argv)>2 else Path(__file__).resolve().parents[1]/'dist/assets/tembed'
out.mkdir(parents=True,exist_ok=True)
files=[('T-Embed CC1101.stp',['body','front','rear','back-pad','magnet','magnet','magnet','magnet']),
       ('0-bmq_asm.stp',['rotor','rotor-button','rotor-base']),
       ('t_embed-1_pcb_1_1_1.stp',['pcb']),('K268-01-key01.stp',['side-key']),('K268-01-key02.stp',['side-key'])]
manifest={'source':'https://github.com/Xinyuan-LilyGO/T-Embed-CC1101/tree/master/3D_files',
          'scale':7.5/98,'sources':[],'parts':[]}
chunks=[];offset=0
for filename,kinds in files:
 path=source/filename
 manifest['sources'].append({'file':filename,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 reader=STEPControl_Reader();assert reader.ReadFile(str(path))==1
 reader.TransferRoots();shape=reader.OneShape()
 BRepMesh_IncrementalMesh(shape,.075,False,.22,True)
 solids=TopExp_Explorer(shape,TopAbs_SOLID);part_index=0
 while solids.More():
  solid=solids.Current();positions=[];normals=[];indices=[]
  faces=TopExp_Explorer(solid,TopAbs_FACE)
  while faces.More():
   face=TopoDS.Face(faces.Current());loc=TopLoc_Location()
   tri=BRep_Tool.Triangulation_s(face,loc)
   if tri:
    tri.ComputeNormals();transform=loc.Transformation();base=len(positions)
    reversed_face=face.Orientation()==TopAbs_REVERSED
    for i in range(1,tri.NbNodes()+1):
     p=tri.Node(i).Transformed(transform);n=tri.Normal(i).Transformed(transform)
     sign=-1 if reversed_face else 1
     x,y,z=p.X(),p.Y(),p.Z()
     if filename=='t_embed-1_pcb_1_1_1.stp': x-=96.7;y-=75.5;z+=6.8
     positions.append([(x+1.5)*manifest['scale'],y*manifest['scale'],-z*manifest['scale']])
     normals.append([sign*n.X(),sign*n.Y(),-sign*n.Z()])
    for i in range(1,tri.NbTriangles()+1):
     t=tri.Triangle(i);a,b,c=[base+t.Value(j)-1 for j in [1,2,3]]
     indices.extend([a,b,c] if reversed_face else [a,c,b])
   faces.Next()
  positions=np.array(positions,dtype='<f4');normals=np.array(normals,dtype='<f4');indices=np.array(indices,dtype='<u4')
  part={'name':f'{filename}:{part_index}','kind':kinds[part_index], 'vertices':len(positions),'indices':len(indices),
        'bounds':[positions.min(axis=0).tolist(),positions.max(axis=0).tolist()]}
  for key,array in [('position',positions),('normal',normals),('index',indices)]:
   part[key]=offset;data=array.tobytes();chunks.append(data);offset+=len(data)
  manifest['parts'].append(part)
  print(part['kind'],len(positions),len(indices)//3,json.dumps(part['bounds']))
  part_index+=1;solids.Next()
 assert part_index==len(kinds)
(out/'geometry.bin').write_bytes(b''.join(chunks))
(out/'geometry.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
print('Output bytes',offset)

