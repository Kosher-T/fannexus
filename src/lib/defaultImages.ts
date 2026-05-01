export const FEATURED_BACKGROUNDS = [
    "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=2000&q=80", // Nebula / Space
    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=2000&q=80", // Magical sparks / night
];

export const STORY_COVERS = [
    "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80", // Books
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80", // Scifi globe
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=600&q=80", // Dark library
];

/**
 * Deterministically pick an image based on an ID string
 */
export function getSeededImage(id: string, isFeatured: boolean = false): string {
    let seed = 0;
    for (let i = 0; i < id.length; i++) {
        seed = (seed + id.charCodeAt(i)) % 1000;
    }

    if (isFeatured) {
        if (seed % 10 < 4) {
            return FEATURED_BACKGROUNDS[seed % FEATURED_BACKGROUNDS.length];
        } else {
            return `https://picsum.photos/seed/${id}-hero/2000/1000`;
        }
    } else {
        if (seed % 10 < 3) {
            return STORY_COVERS[seed % STORY_COVERS.length];
        } else {
            return `https://picsum.photos/seed/${id}/600/900`;
        }
    }
}
