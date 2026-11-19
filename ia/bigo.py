"""Deterministic Big-O normalisation.

Spoken answers express complexity in many ways ("n log n", "order n squared",
"linearithmic", "O of V plus E").  The LLM is asked to return canonical
notation, but the rule engine never trusts that: every complexity string goes
through ``canonicalize`` before it is compared with the rubric.

Canonical forms look like ``O(1)``, ``O(log n)``, ``O(n)``, ``O(n log n)``,
``O(n^2)``, ``O(n + m)``, ``O(V + E)``, ``O(n m)``, ``O(2^n)``, ``O(n!)``.
"""
from __future__ import annotations

import re
from typing import Optional

# Ordering of common single-variable classes (used to decide whether a
# candidate's claim is worse than, equal to, or impossibly better than optimal).
RANK = {
    "O(1)": 0,
    "O(log log n)": 0.5,
    "O(log n)": 1,
    "O(sqrt n)": 2,
    "O(n)": 3,
    "O(n log log n)": 3.5,
    "O(n log n)": 4,
    "O(n log^2 n)": 4.5,
    "O(n sqrt n)": 5,
    "O(n^2)": 6,
    "O(n^2 log n)": 6.5,
    "O(n^3)": 7,
    "O(2^n)": 8,
    "O(n 2^n)": 8.5,
    "O(n!)": 9,
}

_WORD_FORMS = [
    # order matters: longer / more specific phrases first
    (r"\blog[- ]?linear\b|\blinearithmic\b|\bn\s*log\s*n\b", "n log n"),
    (r"\bquadratic\b", "n^2"),
    (r"\bcubic\b", "n^3"),
    (r"\bexponential\b", "2^n"),
    (r"\bfactorial\b", "n!"),
    (r"\blogarithmic\b", "log n"),
    (r"\blinear\b", "n"),
    (r"\bconstant\b", "1"),
]

_NUM_WORDS = {"one": "1", "two": "2", "three": "3", "four": "4"}


def _strip_wrappers(s: str) -> str:
    s = s.strip()
    s = s.replace("²", "^2").replace("³", "^3").replace("√", "sqrt ")
    s = s.replace("**", "^").replace("×", "*").replace("⋅", "*")
    s = re.sub(r"\s+", " ", s)
    low = s.lower()
    # spoken / written wrappers: "big o of", "order of", "o of", "theta of"
    low = re.sub(r"\b(big[- ]?)?(o|theta|omega)\s*of\b", " ", low)
    low = re.sub(r"\border\s+(of\s+)?", " ", low)
    low = re.sub(r"\b(time|space)\b|\bcomplexity\b|\bin the worst case\b|\bworst[- ]case\b|\baverage[- ]case\b|\bamortized\b", " ", low)
    low = re.sub(r"\b(time|times)\b", " * ", low)
    low = low.replace("into", " * ")
    low = re.sub(r"\bplus\b", " + ", low)
    low = re.sub(r"\bsquared\b", "^2", low)
    low = re.sub(r"\bcubed?\b", "^3", low)
    low = re.sub(r"\bto the power( of)?\b", "^", low)
    low = re.sub(r"\bsquare root of\b|\broot\b|\bsqrt\b", " sqrt ", low)
    low = re.sub(r"\blg\b|\bln\b|\blog2\b|\blog base 2 of\b|\blog of\b", " log ", low)
    for w, d in _NUM_WORDS.items():
        low = re.sub(rf"\b{w}\b", d, low)
    for pat, rep in _WORD_FORMS:
        low = re.sub(pat, rep, low)
    # remove a leading "o(" ... ")" wrapper (possibly several)
    while True:
        m = re.fullmatch(r"\s*(big\s*)?[oθΘ]\s*\((.*)\)\s*", low)
        if not m:
            break
        low = m.group(2)
    return low.strip()


def _tokens(expr: str) -> str:
    e = expr
    e = re.sub(r"log\s*\(\s*([a-z])\s*\)", r"log \1", e)          # log(n) -> log n
    e = re.sub(r"sqrt\s*\(\s*([a-z])\s*\)", r"sqrt \1", e)
    e = re.sub(r"\(\s*log\s*([a-z])\s*\)\s*\^\s*2", r"log^2 \1", e)
    e = re.sub(r"log\s*\^?\s*2\s*([a-z])\b", r"log^2 \1", e)
    e = re.sub(r"([a-z0-9!])\s*log", r"\1 log", e)                 # nlogn -> n logn
    e = re.sub(r"log\s*([a-z])", r"log \1", e)                     # logn -> log n
    e = re.sub(r"\s*\^\s*", "^", e)
    e = re.sub(r"\s*\*\s*|\s*\.\s*", " ", e)                       # products -> space
    e = re.sub(r"\s+", " ", e).strip()
    # adjacent variable letters: "nk" -> "n k", "mn" -> "m n"
    e = re.sub(r"\b([nmkve]{2,3})\b", lambda m: " ".join(m.group(1)), e)
    return e


_ALLOWED_TOKEN = re.compile(r"^(?:[a-z](?:\^(?:\d+|[a-z]))?|\d+(?:\^[a-z])?|log(?:\^2)?|sqrt|[a-z]!|\+)$")


def _canon_product(term: str) -> str:
    """Canonicalise a product term like 'm n' or 'n log n'."""
    term = term.strip()
    if term in ("", "1"):
        return "1"
    parts = term.split(" ")
    # re-attach 'log x', 'log^2 x' and 'sqrt x' factors
    factors, i = [], 0
    while i < len(parts):
        p = parts[i]
        if p in ("log", "log^2", "sqrt") and i + 1 < len(parts):
            factors.append(f"{p} {parts[i+1]}")
            i += 2
        else:
            factors.append(p)
            i += 1
    # n n -> n^2
    plain = [f for f in factors if re.fullmatch(r"[a-z]", f)]
    others = [f for f in factors if not re.fullmatch(r"[a-z]", f)]
    counts: dict[str, int] = {}
    for f in plain:
        counts[f] = counts.get(f, 0) + 1
    merged = [v if c == 1 else f"{v}^{c}" for v, c in counts.items()]
    others = [o for o in others if o != "1"]

    def key(f: str):
        # polynomial factors first (n before m), then sqrt, then log
        if f.startswith("log"):
            return (2, f)
        if f.startswith("sqrt"):
            return (1, f)
        if f.startswith("2^"):
            return (0.5, f)
        var = f[0]
        return (0, {"n": "0"}.get(var, var) + f)

    out = sorted(merged + others, key=key)
    return " ".join(out) if out else "1"


def canonicalize(raw: Optional[str]) -> Optional[str]:
    """Return canonical ``O(...)`` string, or ``None`` if not recognisable."""
    if raw is None:
        return None
    out = _canonicalize(raw)
    if out is None:
        # fall back to the first explicit O(...) inside a longer phrase
        m = re.search(r"\b[oO]\s*\(([^()]*(\([^()]*\))?[^()]*)\)", str(raw))
        if m and m.group(0).strip() != str(raw).strip():
            out = _canonicalize(m.group(0))
    return out


def _canonicalize(raw) -> Optional[str]:
    s = str(raw).strip()
    if not s or s.lower() in {"null", "none", "n/a", "unknown", "not stated", "not mentioned"}:
        return None
    expr = _strip_wrappers(s)
    # graph variables keep upper case
    graph = bool(re.search(r"\bv\b", expr) and re.search(r"\be\b", expr))
    expr = _tokens(expr)
    if not expr or not re.search(r"[a-z0-9!]", expr):
        return None
    if not re.fullmatch(r"[a-z0-9!^+ ]+", expr):
        return None
    if not all(_ALLOWED_TOKEN.match(t) for t in expr.replace("+", " + ").split()):
        return None
    terms = [t.strip() for t in expr.split("+") if t.strip()]
    canon_terms = sorted({_canon_product(t) for t in terms},
                         key=lambda t: ({"n": "0"}.get(t[0], t[0]) if t else "", t))
    if len(canon_terms) > 1 and "1" in canon_terms:  # O(n + 1) -> O(n)
        canon_terms.remove("1")
    body = " + ".join(canon_terms)
    if graph:
        body = re.sub(r"\bv\b", "V", body)
        body = re.sub(r"\be\b", "E", body)
        # V + E order
        if set(canon_terms) == {"e", "v"}:
            body = "V + E"
        if set(canon_terms) == {"e log v", "v log v"} or set(canon_terms) == {"E log V", "V log V"}:
            body = "(V + E) log V"
        body = body.replace("E log v", "E log V")
    return f"O({body})"


def rank(canon: Optional[str]) -> Optional[float]:
    if canon is None:
        return None
    return RANK.get(canon)


def compare(candidate: Optional[str], optimal: list[str]) -> str:
    """Compare a candidate complexity with the rubric's optimal set.

    Returns one of: 'missing', 'optimal', 'worse', 'better_than_possible',
    'unverifiable'.
    """
    c = canonicalize(candidate)
    if c is None:
        return "missing"
    opts = [canonicalize(o) for o in optimal]
    if c in opts:
        return "optimal"
    rc = rank(c)
    ropt = [rank(o) for o in opts if rank(o) is not None]
    if rc is None or not ropt:
        return "unverifiable"
    best = min(ropt)
    if rc > best:
        return "worse"
    if rc < best:
        return "better_than_possible"
    return "optimal"
