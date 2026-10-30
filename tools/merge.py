"""Merge PDFs in the order given.

usage: python3 -I merge.py <out.pdf> <in1.pdf> <in2.pdf> [...]
The folder of <out.pdf> is created if it does not exist yet.
"""
import os
import sys

from pypdf import PdfWriter


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__.strip())
    out, inputs = sys.argv[1], sys.argv[2:]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    writer = PdfWriter()
    for path in inputs:
        writer.append(path)
    with open(out, "wb") as fh:
        writer.write(fh)
    print(out)


if __name__ == "__main__":
    main()
