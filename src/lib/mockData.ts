export type Platform = 'AO3' | 'FFnet' | 'Spacebattles' | 'Sufficient Velocity' | 'Wattpad';

export interface Story {
  id: string;
  title: string;
  author: string;
  fandoms: string[];
  summary: string;
  tags: string[];
  rating: string;
  words: number;
  chapters: number;
  status: 'Complete' | 'Ongoing' | 'Hiatus';
  published: string;
  updated: string;
  coverImage?: string;
  platforms: Platform[];
  platformLinks: Record<Platform, string>;
}

export const mockStories: Story[] = [
  {
    id: "1",
    title: "The Scholar's Journey",
    author: "InkWeaver",
    fandoms: ["Original Universe", "Fantasy Concepts"],
    summary: "In a world where words literally shape reality, a young scholar discovers a forgotten dialect that could unmake the very foundations of the empire. But the Emperor's Inquisition is already on her trail...",
    tags: ["Magic", "Political Intrigue", "Slow Burn", "Worldbuilding"],
    rating: "M",
    words: 124500,
    chapters: 34,
    status: 'Ongoing',
    published: '2023-01-15',
    updated: '2024-02-28',
    coverImage: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=800",
    platforms: ['AO3', 'Spacebattles'],
    platformLinks: {
      'AO3': 'https://archiveofourown.org/works/dummy1',
      'Spacebattles': 'https://forums.spacebattles.com/threads/dummy1',
      'FFnet': '',
      'Sufficient Velocity': '',
      'Wattpad': ''
    }
  },
  {
    id: "2",
    title: "Echoes of Time",
    author: "TimeLord",
    fandoms: ["Doctor Who", "Steins;Gate"],
    summary: "A temporal anomaly merges two distinct timelines. The Doctor must rely on Okabe Rintarou's unique 'Reading Steiner' ability to untangle the paradox before existence unravels.",
    tags: ["Time Travel", "Crossover", "Angst", "Fix-it"],
    rating: "T",
    words: 85200,
    chapters: 12,
    status: 'Complete',
    published: '2021-05-10',
    updated: '2021-12-01',
    platforms: ['FFnet', 'AO3'],
    platformLinks: {
      'AO3': 'https://archiveofourown.org/works/dummy2',
      'FFnet': 'https://fanfiction.net/s/dummy2',
      'Spacebattles': '',
      'Sufficient Velocity': '',
      'Wattpad': ''
    }
  },
  {
    id: "3",
    title: "Forged in Starlight",
    author: "NovaWriter",
    fandoms: ["Star Wars"],
    summary: "A rogue Jedi and a disillusioned Mandalorian bounty hunter are forced to team up to survive the Outer Rim. What starts as a tense alliance slowly becomes something more.",
    tags: ["Enemies to Lovers", "Action", "Romance"],
    rating: "E",
    words: 210000,
    chapters: 65,
    status: 'Ongoing',
    published: '2022-11-20',
    updated: '2024-03-01',
    // Intentionally omitting coverImage to test the default fallback card
    platforms: ['AO3', 'Wattpad'],
    platformLinks: {
      'AO3': 'https://archiveofourown.org/works/dummy3',
      'Wattpad': 'https://wattpad.com/story/dummy3',
      'FFnet': '',
      'Spacebattles': '',
      'Sufficient Velocity': ''
    }
  },
  {
    id: "4",
    title: "Steel & Silk",
    author: "IronHeart",
    fandoms: ["Worm", "Marvel Cinematic Universe"],
    summary: "Taylor Hebert triggers with the ability to manipulate not bugs, but raw metallic elements. Thrown into the MCU, she must navigate a world of heroes and gods.",
    tags: ["Alt-Power", "Crossover", "Street Level"],
    rating: "T",
    words: 150000,
    chapters: 40,
    status: 'Hiatus',
    published: '2020-08-14',
    updated: '2022-02-14',
    platforms: ['Spacebattles', 'Sufficient Velocity'],
    platformLinks: {
      'Spacebattles': 'https://forums.spacebattles.com/threads/dummy4',
      'Sufficient Velocity': 'https://forums.sufficientvelocity.com/threads/dummy4',
      'AO3': '',
      'FFnet': '',
      'Wattpad': ''
    }
  }
];

export function getStoryById(id: string): Story | undefined {
  return mockStories.find(s => s.id === id);
}
