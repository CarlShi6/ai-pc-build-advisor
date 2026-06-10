export type PartCategory =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "ssd"
  | "psu"
  | "case"
  | "cooler"
  | "os"
  | "fan"
  | "accessory";

export type PartAvailability = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

export interface Part {
  id: string;
  category: PartCategory;
  brand: string;
  model: string;
  displayName: string;
  price: number;
  retailer?: string;
  productUrl?: string;
  searchUrl?: string;
  availability?: PartAvailability;
  specs: Record<string, string | number | boolean>;
  compatibilityTags: string[];
  recommendationReason?: string;
}
