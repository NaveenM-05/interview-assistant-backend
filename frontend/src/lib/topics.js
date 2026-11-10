export const DSA_TOPICS = [
  'Arrays',
  'Graphs',
  'Dynamic Programming',
  'Two Pointers',
  'Sliding Window',
  'Trees & BST',
  'Binary Search',
  'Hash Map',
  'Heap / Priority Queue',
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

// Backend scores are 0–1; show as whole percentages.
export const toPercent = (score) => (typeof score === 'number' ? Math.round(score * 100) : null);
