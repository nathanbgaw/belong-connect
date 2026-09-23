/**
 * Resource categories — the vocabulary shared by the extractor, the needs
 * board, the offers board and the chat. Kept deliberately small and plain so
 * a person in a hard week can recognise their situation in it.
 */
export const CATEGORIES = [
  "food",
  "clothing",
  "housing",
  "financial-assistance",
  "utilities-bills",
  "counseling",
  "recovery",
  "support-groups",
  "childcare",
  "youth-programs",
  "seniors",
  "foster-adoption",
  "tutoring-education",
  "esl-immigration",
  "transportation",
  "health",
  "community-meals",
  "prayer-pastoral-care",
  "benevolence",
  "job-help",
  "furniture-household",
  "baby-supplies",
  "disability-access",
  "other",
] as const;

export type ResourceCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  food: "Food pantry / groceries",
  clothing: "Clothing closet",
  housing: "Housing & shelter help",
  "financial-assistance": "Financial assistance",
  "utilities-bills": "Utility & bill help",
  counseling: "Counseling",
  recovery: "Addiction recovery",
  "support-groups": "Support groups",
  childcare: "Childcare / parents' groups",
  "youth-programs": "Youth & children's programs",
  seniors: "Seniors",
  "foster-adoption": "Foster & adoption ministry",
  "tutoring-education": "Tutoring & education",
  "esl-immigration": "ESL & immigrant support",
  transportation: "Transportation",
  health: "Health clinic / medical",
  "community-meals": "Community meals",
  "prayer-pastoral-care": "Prayer & pastoral care",
  benevolence: "Benevolence fund",
  "job-help": "Job help",
  "furniture-household": "Furniture & household",
  "baby-supplies": "Baby supplies & diapers",
  "disability-access": "Disability & accessibility",
  other: "Other",
};

export function labelFor(category: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}
