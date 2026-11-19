"""Closed vocabulary of algorithmic paradigms and alias normalisation."""
from __future__ import annotations

import re
from typing import Optional

PARADIGMS = [
    "brute_force", "two_pointers", "sliding_window", "hashing", "sorting",
    "binary_search", "prefix_sum", "stack", "monotonic_stack", "queue", "heap",
    "greedy", "divide_and_conquer", "recursion", "backtracking", "dynamic_programming",
    "bfs", "dfs", "union_find", "topological_sort", "shortest_path", "trie",
    "bit_manipulation", "linked_list_pointers", "tree_traversal", "math", "other",
]

# alias -> canonical paradigm.  Matched on whole words, longest first.
ALIASES = {
    "brute force": "brute_force", "naive": "brute_force", "linear search": "brute_force",
    "linear scan": "brute_force", "sequential search": "brute_force", "linear_search": "brute_force", "nested loop": "brute_force",
    "nested loops": "brute_force", "check all pairs": "brute_force", "bruteforce": "brute_force",
    "two pointer": "two_pointers", "two pointers": "two_pointers", "two-pointer": "two_pointers",
    "fast and slow pointer": "linked_list_pointers", "slow and fast pointer": "linked_list_pointers",
    "floyd": "linked_list_pointers", "tortoise and hare": "linked_list_pointers",
    "sliding window": "sliding_window",
    "hash map": "hashing", "hashmap": "hashing", "hash table": "hashing", "hashtable": "hashing",
    "dictionary": "hashing", "hash set": "hashing", "hashset": "hashing", "hashing": "hashing",
    "frequency map": "hashing", "counter": "hashing", "lookup table": "hashing",
    "sort": "sorting", "sorting": "sorting", "sorted": "sorting", "merge sort": "sorting",
    "binary search": "binary_search", "bisect": "binary_search",
    "prefix sum": "prefix_sum", "prefix sums": "prefix_sum", "cumulative sum": "prefix_sum",
    "kadane": "dynamic_programming",
    "monotonic stack": "monotonic_stack", "monotone stack": "monotonic_stack",
    "stack": "stack", "queue": "queue", "deque": "queue",
    "heap": "heap", "priority queue": "heap", "min heap": "heap", "max heap": "heap",
    "greedy": "greedy",
    "divide and conquer": "divide_and_conquer",
    "backtracking": "backtracking", "backtrack": "backtracking",
    "recursion": "recursion", "recursive": "recursion", "recursively": "recursion",
    "dynamic programming": "dynamic_programming", "dp": "dynamic_programming",
    "memoization": "dynamic_programming", "memoisation": "dynamic_programming",
    "tabulation": "dynamic_programming",
    "breadth first search": "bfs", "breadth-first search": "bfs", "bfs": "bfs", "level order": "bfs",
    "depth first search": "dfs", "depth-first search": "dfs", "dfs": "dfs",
    "union find": "union_find", "disjoint set": "union_find", "dsu": "union_find",
    "topological sort": "topological_sort", "topological order": "topological_sort",
    "kahn": "topological_sort",
    "dijkstra": "shortest_path", "bellman ford": "shortest_path", "shortest path": "shortest_path",
    "trie": "trie", "prefix tree": "trie",
    "bit manipulation": "bit_manipulation", "xor": "bit_manipulation", "bitmask": "bit_manipulation",
    "inorder": "tree_traversal", "in-order": "tree_traversal", "preorder": "tree_traversal",
    "postorder": "tree_traversal", "tree traversal": "tree_traversal",
}

_ALIAS_ORDER = sorted(ALIASES, key=len, reverse=True)


def normalize(raw: Optional[str]) -> Optional[str]:
    """Map a free-text or enum paradigm label to the closed vocabulary."""
    if raw is None:
        return None
    s = str(raw).strip().lower()
    if not s or s in {"null", "none", "unknown", "n/a", "not stated"}:
        return None
    key = s.replace("-", "_").replace(" ", "_")
    if key in PARADIGMS:
        return key
    s2 = s.replace("_", " ")
    for a in _ALIAS_ORDER:
        if re.search(rf"\b{re.escape(a)}\b", s2):
            return ALIASES[a]
    return "other"


def find_mentions(text: str) -> list[str]:
    """All paradigms mentioned in text, in order of first appearance (keyword baseline)."""
    low = text.lower()
    hits = []
    for a in _ALIAS_ORDER:
        for m in re.finditer(rf"\b{re.escape(a)}\b", low):
            hits.append((m.start(), ALIASES[a]))
    hits.sort()
    seen, out = set(), []
    for _, p in hits:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out
