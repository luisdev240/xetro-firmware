# T-Embed visualization

Mechanical geometry is tessellated from the STEP files published by LILYGO:
https://github.com/Xinyuan-LilyGO/T-Embed-CC1101/tree/master/3D_files

The common CC1101 enclosure, encoder, PCB and side keys come from that CAD.
The three rear pads, two visible rear circles, LEDs and small electronic details are
illustrative adaptations based on the CC1101 Plus product photographs:
https://lilygo.cc/products/t-embed-cc1101-plus

The official Plus dimension photograph gives approximately 98 x 39 x 31 mm.
This visualization is not a manufacturing drawing or a complete electronics model.
The display uses Xetro firmware screenshots.

`geometry.json` records the SHA-256 of each source STEP file. `geometry.bin` stores
little-endian float32 positions/normals and uint32 triangle indices, with byte offsets
in the manifest.

To reproduce the geometry with Python 3.12:

```
pip install cadquery-ocp-novtk==8.0.1.1.0 numpy
python tools/build-tembed-model.py /path/to/downloaded/3D_files assets/tembed
```
