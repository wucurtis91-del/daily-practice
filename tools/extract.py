"""Extract the text of PDFs, one .txt per PDF with page markers.

usage: python3 -I extract.py <outdir> <pdf> [<pdf> ...]
Each output file is <outdir>/<pdf name>.txt and each page starts with
"=== page N ===" so agents can cite page numbers.
"""
import os
import sys

import pdfplumber


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__.strip())
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    for src in sys.argv[2:]:
        name = os.path.splitext(os.path.basename(src))[0]
        out = os.path.join(outdir, name + ".txt")
        try:
            with pdfplumber.open(src) as pdf:
                parts = []
                for i, page in enumerate(pdf.pages, 1):
                    parts.append(f"=== page {i} ===\n{page.extract_text() or ''}")
            with open(out, "w") as fh:
                fh.write("\n".join(parts))
            print(f"{len(parts):4d} pages  {out}")
        except Exception as exc:  # keep going; report the file that failed
            print(f"FAILED {src}: {exc}")


if __name__ == "__main__":
    main()
