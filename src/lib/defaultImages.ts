export const FEATURED_BACKGROUNDS = [
    "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=2000&q=80", // Nebula / Space
    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=2000&q=80", // Magical sparks / night
    "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=2000&q=80", // Rain on glass / moody
    "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=2000&q=80", // Abstract dark texture
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=2000&q=80"  // Abstract fluid dark
];

export const STORY_COVERS = [
    "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80", // Books
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80", // Scifi globe
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80", // Desk / Writing
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80", // Starry sky mountain
    "https://images.unsplash.com/photo-1604871000636-074FA5117945?auto=format&fit=crop&w=600&q=80", // Abstract art
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=600&q=80", // Dark library
    "https://images.unsplash.com/photo-1542241647-9cbbada2f409?auto=format&fit=crop&w=600&q=80", // Dark forest
    "https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?auto=format&fit=crop&w=600&q=80", // Neon lights abstract
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
        return FEATURED_BACKGROUNDS[seed % FEATURED_BACKGROUNDS.length];
    } else {
        return STORY_COVERS[seed % STORY_COVERS.length];
    }
}
