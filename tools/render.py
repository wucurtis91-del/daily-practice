"""Render PDF pages to PNG.

usage: python3 -I render.py <pdf> <outdir> [pages|all] [scale] [prefix]
  pages: "all" or a comma list such as "1,2,5" (1-based)
  scale: 1.0 = 72 dpi; 1.4 is a good default for reading a page
"""
import os
import sys

import pypdfium2 as pdfium


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__.strip())
    src, outdir = sys.argv[1], sys.argv[2]
    pages = sys.argv[3] if len(sys.argv) > 3 else "all"
    scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.4
    prefix = sys.argv[5] if len(sys.argv) > 5 else os.path.splitext(os.path.basename(src))[0].replace(" ", "_")
    os.makedirs(outdir, exist_ok=True)
    pdf = pdfium.PdfDocument(src)
    sel = range(len(pdf)) if pages == "all" else [int(x) - 1 for x in pages.split(",")]
    for i in sel:
        img = pdf[i].render(scale=scale).to_pil()
        path = os.path.join(outdir, f"{prefix}_p{i + 1}.png")
        img.save(path)
        print(path)


if __name__ == "__main__":
    main()
