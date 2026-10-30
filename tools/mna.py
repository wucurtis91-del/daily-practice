"""Exact DC circuit solver (modified nodal analysis) for checking practice questions.

usage:
  python3 -I mna.py circuit.json                 # node voltages, element currents, powers
  python3 -I mna.py circuit.json --thevenin A B  # Thevenin/Norton seen from nodes A, B

circuit.json:
  {"ground": "0",
   "elements": [
     {"name": "R1", "type": "R", "a": "1", "b": "2", "value": 4},
     {"name": "V1", "type": "V", "p": "1", "n": "0", "value": 12},     # V_p - V_n = value
     {"name": "I1", "type": "I", "from": "0", "to": "2", "value": 2},  # arrow from -> to inside the source
     {"name": "U1", "type": "OPAMP", "plus": "3", "minus": "4", "out": "5"}  # ideal, negative feedback
   ]}

Values may be numbers or strings such as "1.5" or "3/4"; arithmetic is exact (fractions).

Sign conventions (passive sign convention, absorbed power positive):
  R:      current a -> b through the resistor,  P = (Va - Vb) * I
  V:      current entering the + terminal,      P = value * I   (negative = supplying)
  I:      current = value (from -> to),         P = (V_from - V_to) * value
  OPAMP:  output current into node `out`,       P_supplied = V_out * I_out (reported separately)
Power balance over all elements, op-amp outputs included, is checked and printed.
"""
import json
import sys
from fractions import Fraction


def F(x):
    return Fraction(str(x))


def solve_linear(A, b):
    """Gauss-Jordan elimination on Fractions. Raises ValueError if singular."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = next((r for r in range(col, n) if M[r][col] != 0), None)
        if piv is None:
            raise ValueError("singular system (floating node, loop of voltage sources, or no feedback?)")
        M[col], M[piv] = M[piv], M[col]
        p = M[col][col]
        M[col] = [v / p for v in M[col]]
        for r in range(n):
            if r != col and M[r][col] != 0:
                f = M[r][col]
                M[r] = [rv - f * cv for rv, cv in zip(M[r], M[col])]
    return [M[i][n] for i in range(n)]


def analyse(circuit):
    gnd = str(circuit.get("ground", "0"))
    els = circuit["elements"]
    nodes = []

    def add(n):
        n = str(n)
        if n != gnd and n not in nodes:
            nodes.append(n)

    for e in els:
        t = e["type"].upper()
        for key in {"R": ("a", "b"), "V": ("p", "n"), "I": ("from", "to"), "OPAMP": ("plus", "minus", "out")}[t]:
            add(e[key])
    extra = [e for e in els if e["type"].upper() in ("V", "OPAMP")]
    N = len(nodes) + len(extra)
    A = [[Fraction(0)] * N for _ in range(N)]
    rhs = [Fraction(0)] * N
    idx = {n: i for i, n in enumerate(nodes)}

    def ni(n):
        n = str(n)
        return None if n == gnd else idx[n]

    k = len(nodes)
    branch = {}
    for e in els:
        t = e["type"].upper()
        if t == "R":
            g = 1 / F(e["value"])
            a, b = ni(e["a"]), ni(e["b"])
            if a is not None:
                A[a][a] += g
            if b is not None:
                A[b][b] += g
            if a is not None and b is not None:
                A[a][b] -= g
                A[b][a] -= g
        elif t == "I":
            v = F(e["value"])
            a, b = ni(e["from"]), ni(e["to"])
            if a is not None:
                rhs[a] -= v
            if b is not None:
                rhs[b] += v
        elif t == "V":
            p, n = ni(e["p"]), ni(e["n"])
            branch[e["name"]] = k
            if p is not None:
                A[p][k] += 1
                A[k][p] += 1
            if n is not None:
                A[n][k] -= 1
                A[k][n] -= 1
            rhs[k] = F(e["value"])
            k += 1
        elif t == "OPAMP":
            pl, mi, out = ni(e["plus"]), ni(e["minus"]), ni(e["out"])
            branch[e["name"]] = k
            if out is not None:
                A[out][k] -= 1  # current injected into `out`
            if pl is not None:
                A[k][pl] += 1
            if mi is not None:
                A[k][mi] -= 1
            k += 1
    x = solve_linear(A, rhs)
    V = {gnd: Fraction(0)}
    V.update({n: x[i] for n, i in idx.items()})
    res = {"node_voltages": V, "elements": []}
    total = Fraction(0)
    for e in els:
        t = e["type"].upper()
        if t == "R":
            vab = V[str(e["a"])] - V[str(e["b"])]
            i = vab / F(e["value"])
            p = vab * i
            res["elements"].append((e["name"], f"I({e['a']}->{e['b']})", i, vab, p))
        elif t == "V":
            # the MNA variable is the current leaving node p into the source, i.e. entering the + terminal
            i = x[branch[e["name"]]]
            p = F(e["value"]) * i
            res["elements"].append((e["name"], "I(into +)", i, F(e["value"]), p))
        elif t == "I":
            v = V[str(e["from"])] - V[str(e["to"])]
            p = v * F(e["value"])
            res["elements"].append((e["name"], f"I({e['from']}->{e['to']})", F(e["value"]), v, p))
        elif t == "OPAMP":
            io = x[branch[e["name"]]]
            vout = V[str(e["out"])]
            p = -vout * io  # absorbed; supplied = vout * io
            res["elements"].append((e["name"], "I(out, into node)", io, vout, p))
        total += res["elements"][-1][4]
    res["power_sum"] = total
    return res


def fmt(q):
    return f"{q}" if q.denominator == 1 else f"{q} (= {float(q):.6g})"


def report(circuit):
    r = analyse(circuit)
    print("Node voltages (wrt ground):")
    for n, v in r["node_voltages"].items():
        print(f"  V[{n}] = {fmt(v)} V")
    print("Elements: name | current (convention) | voltage | absorbed power (+absorb / -supply)")
    for name, conv, i, v, p in r["elements"]:
        print(f"  {name:6s} {conv:18s} I = {fmt(i)} A   V = {fmt(v)} V   P = {fmt(p)} W")
    print(f"Sum of absorbed powers = {fmt(r['power_sum'])} W  ({'balanced' if r['power_sum'] == 0 else 'NOT balanced'})")
    return r


def thevenin(circuit, a, b):
    oc = analyse(circuit)
    voc = oc["node_voltages"][str(a)] - oc["node_voltages"][str(b)]
    sc = json.loads(json.dumps(circuit))
    sc["elements"].append({"name": "Vsc", "type": "V", "p": a, "n": b, "value": 0})
    isc = analyse(sc)["elements"][-1][2]  # current entering + of the 0 V probe: a -> b through the short
    print(f"V_Th = V_{a}{b},oc = {fmt(voc)} V")
    print(f"I_N = I_sc ({a}->{b} through short) = {fmt(isc)} A")
    if isc != 0:
        rth = voc / isc
        print(f"R_Th = V_Th / I_sc = {fmt(rth)} ohm")
        print(f"P_max = V_Th^2 / (4 R_Th) = {fmt(voc * voc / (4 * rth))} W")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1].startswith("--") or (
            "--thevenin" in sys.argv and len(sys.argv) < sys.argv.index("--thevenin") + 3):
        sys.exit(__doc__.strip())
    circ = json.load(open(sys.argv[1]))
    if "--thevenin" in sys.argv:
        i = sys.argv.index("--thevenin")
        thevenin(circ, sys.argv[i + 1], sys.argv[i + 2])
    else:
        report(circ)
