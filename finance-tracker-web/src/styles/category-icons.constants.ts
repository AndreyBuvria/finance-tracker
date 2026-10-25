/**
 * The fixed set of 40 category icons (FEATURES.md F5): names of rounded Material Symbols,
 * rendered with `<mat-icon>` (the app's default font set is `material-symbols-rounded`).
 */
export const CATEGORY_ICONS = [
  // Food and drink
  'shopping_cart',
  'restaurant',
  'local_cafe',
  'local_bar',
  'bakery_dining',
  // Transport
  'directions_bus',
  'directions_car',
  'local_taxi',
  'train',
  'local_gas_station',
  'flight',
  // Home and bills
  'home',
  'bolt',
  'water_drop',
  'wifi',
  'smartphone',
  'build',
  // Health and care
  'medical_services',
  'medication',
  'fitness_center',
  'spa',
  // Shopping
  'shopping_bag',
  'checkroom',
  'devices',
  'card_giftcard',
  // Leisure
  'movie',
  'sports_esports',
  'music_note',
  'subscriptions',
  'beach_access',
  'celebration',
  // Family, learning, pets
  'school',
  'menu_book',
  'child_care',
  'pets',
  'volunteer_activism',
  // Money
  'payments',
  'work',
  'savings',
  // Fallback
  'category',
] as const;

/** The neutral icon a new category starts with (the one "Other" uses). */
export const DEFAULT_CATEGORY_ICON = 'category' satisfies (typeof CATEGORY_ICONS)[number];
