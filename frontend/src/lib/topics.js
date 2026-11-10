export const DSA_TOPICS = [
  'Arrays & Hashing',
  'Strings',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Queues',
  'Binary Search',
  'Linked Lists',
  'Trees (including BSTs)',
  'Tries',
  'Heaps / Priority Queues',
  'Backtracking',
  'Graphs (BFS/DFS)',
  'Advanced Graphs (Union-Find, Dijkstra, Topological Sort)',
  '1D Dynamic Programming',
  '2D Dynamic Programming',
  'Greedy',
  'Bit Manipulation',
  'Math & Geometry',
];

export const BEHAVIORAL_TOPICS = [
  'Leadership',
  'Conflict Resolution',
  'Time Management',
  'Adaptability',
  'Cross-Team Collaboration',
  'Handling Failure',
];

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const STAR_PARTS = [
  { key: 'S', label: 'Situation' },
  { key: 'T', label: 'Task' },
  { key: 'A', label: 'Action' },
  { key: 'R', label: 'Result' },
];

export const starterCode = (topic, difficulty) =>
  `# ${topic} (${difficulty}) Solution\ndef solve():\n    # Write your optimal ${topic} implementation here\n    pass\n`;

// Backend scores are 0–1 (or 0–100 integers); show as whole percentages.
export const toPercent = (score) =>
  typeof score === 'number' ? Math.round(score > 1 ? score : score * 100) : null;
