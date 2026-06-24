import type { ProductSearchProvider, ProductSearchQuery, ProductSearchResult } from "@/lib/product-search/types";
import type { PartCategory } from "@/types/parts";

type MockRetailerProduct = Omit<ProductSearchResult, "source" | "confidence" | "priceStatus" | "lastUpdated"> & {
  keywords: string[];
};

const lastUpdated = "2026-06-01T12:00:00.000Z";

function dealUrl(retailer: string, name: string) {
  return `https://example.com/${retailer}/search?q=${encodeURIComponent(name)}`;
}

const mockProducts: MockRetailerProduct[] = [
  {
    id: "mock-retailer-cpu-7800x3d",
    category: "cpu",
    brand: "AMD",
    model: "Ryzen 7 7800X3D",
    displayName: "AMD Ryzen 7 7800X3D 8-Core Desktop Processor",
    retailer: "amazon",
    price: 359.99,
    stockStatus: "in_stock",
    productUrl: dealUrl("amazon", "AMD Ryzen 7 7800X3D"),
    affiliateUrl: dealUrl("amazon", "AMD Ryzen 7 7800X3D affiliate"),
    keywords: ["amd", "ryzen", "7800x3d", "am5", "gaming", "cpu"],
    specs: {
      socket: "AM5",
      cores: 8,
      threads: 16,
      boostGHz: 5.0,
      tdpW: 120,
      integratedGraphics: true,
      gamingScore: 96,
      productivityScore: 78,
    },
    compatibilityTags: ["amd", "am5", "ddr5", "gaming", "mock-retailer"],
    recommendationReason: "Mock retailer preview for a high-value AM5 gaming CPU.",
  },
  {
    id: "mock-retailer-cpu-14700k",
    category: "cpu",
    brand: "Intel",
    model: "Core i7-14700K",
    displayName: "Intel Core i7-14700K Unlocked Desktop Processor",
    retailer: "bestbuy",
    price: 399.99,
    stockStatus: "low_stock",
    productUrl: dealUrl("bestbuy", "Intel Core i7-14700K"),
    affiliateUrl: dealUrl("bestbuy", "Intel Core i7-14700K affiliate"),
    keywords: ["intel", "core", "i7", "14700k", "lga1700", "creator", "cpu"],
    specs: {
      socket: "LGA1700",
      cores: 20,
      threads: 28,
      boostGHz: 5.6,
      tdpW: 253,
      integratedGraphics: true,
      gamingScore: 88,
      productivityScore: 90,
    },
    compatibilityTags: ["intel", "lga1700", "ddr5", "mock-retailer"],
    recommendationReason: "Mock retailer preview for mixed gaming and creator workloads.",
  },
  {
    id: "mock-retailer-gpu-4070-super",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 4070 Super 12GB",
    displayName: "NVIDIA GeForce RTX 4070 Super 12GB Graphics Card",
    retailer: "newegg",
    price: 589.99,
    stockStatus: "in_stock",
    productUrl: dealUrl("newegg", "RTX 4070 Super 12GB"),
    affiliateUrl: dealUrl("newegg", "RTX 4070 Super 12GB affiliate"),
    keywords: ["nvidia", "rtx", "4070", "super", "12gb", "1440p", "gpu"],
    specs: {
      vramGb: 12,
      chipset: "RTX 4070 Super",
      lengthMm: 267,
      powerDrawW: 220,
      recommendedPsuW: 650,
      performanceTier: "1440p efficient",
      gaming1440pScore: 82,
      gaming4kScore: 62,
      color: "Black",
    },
    compatibilityTags: ["nvidia", "12gb-vram", "gaming", "mock-retailer"],
    recommendationReason: "Mock retailer preview for efficient 1440p gaming.",
  },
  {
    id: "mock-retailer-gpu-7900-xt",
    category: "gpu",
    brand: "AMD",
    model: "Radeon RX 7900 XT 20GB",
    displayName: "AMD Radeon RX 7900 XT 20GB Graphics Card",
    retailer: "microcenter",
    price: 679.99,
    stockStatus: "unknown",
    productUrl: dealUrl("microcenter", "Radeon RX 7900 XT 20GB"),
    affiliateUrl: dealUrl("microcenter", "Radeon RX 7900 XT 20GB affiliate"),
    keywords: ["amd", "radeon", "rx", "7900", "xt", "20gb", "gpu", "4k"],
    specs: {
      vramGb: 20,
      chipset: "RX 7900 XT",
      lengthMm: 313,
      powerDrawW: 315,
      recommendedPsuW: 750,
      performanceTier: "1440p ultra / 4K strong",
      gaming1440pScore: 92,
      gaming4kScore: 82,
      color: "Black",
    },
    compatibilityTags: ["amd", "20gb-vram", "gaming", "value", "mock-retailer"],
    recommendationReason: "Mock retailer preview for buyers who prefer AMD graphics.",
  },
  {
    id: "mock-retailer-mobo-b650",
    category: "motherboard",
    brand: "MSI",
    model: "MAG B650 Tomahawk WiFi",
    displayName: "MSI MAG B650 Tomahawk WiFi AM5 Motherboard",
    retailer: "bhphoto",
    price: 209.99,
    stockStatus: "in_stock",
    productUrl: dealUrl("bhphoto", "MSI MAG B650 Tomahawk WiFi"),
    affiliateUrl: dealUrl("bhphoto", "MSI MAG B650 Tomahawk WiFi affiliate"),
    keywords: ["msi", "b650", "tomahawk", "am5", "ddr5", "motherboard"],
    specs: {
      socket: "AM5",
      ramType: "DDR5",
      formFactor: "ATX",
      chipset: "B650",
      maxRamGb: 192,
      pcieGen: 4,
      wifi: true,
      memorySupport: "DDR5 up to 192GB",
    },
    compatibilityTags: ["amd", "am5", "ddr5", "atx", "mock-retailer"],
    recommendationReason: "Mock retailer preview for an AM5 value motherboard.",
  },
  {
    id: "mock-retailer-ram-64-ddr5",
    category: "ram",
    brand: "Kingston",
    model: "FURY Beast 64GB DDR5-6000",
    displayName: "Kingston FURY Beast 64GB DDR5-6000 Memory Kit",
    retailer: "amazon",
    price: 184.99,
    stockStatus: "in_stock",
    productUrl: dealUrl("amazon", "Kingston FURY Beast 64GB DDR5-6000"),
    affiliateUrl: dealUrl("amazon", "Kingston FURY Beast 64GB DDR5-6000 affiliate"),
    keywords: ["kingston", "fury", "64gb", "ddr5", "6000", "ram", "memory"],
    specs: {
      capacityGb: 64,
      speedMt: 6000,
      ramType: "DDR5",
      sticks: 2,
      latency: "CL36",
      color: "Black",
    },
    compatibilityTags: ["ddr5", "64gb", "mock-retailer"],
    recommendationReason: "Mock retailer preview for a capacity-first DDR5 kit.",
  },
  {
    id: "mock-retailer-ssd-sn850x",
    category: "ssd",
    brand: "WD Black",
    model: "SN850X 2TB",
    displayName: "WD Black SN850X 2TB NVMe SSD",
    retailer: "bestbuy",
    price: 154.99,
    stockStatus: "in_stock",
    productUrl: dealUrl("bestbuy", "WD Black SN850X 2TB"),
    affiliateUrl: dealUrl("bestbuy", "WD Black SN850X 2TB affiliate"),
    keywords: ["wd", "black", "sn850x", "2tb", "nvme", "ssd", "storage"],
    specs: {
      capacityTb: 2,
      interface: "PCIe 4.0 x4",
      readMb: 7300,
      writeMb: 6600,
      formFactor: "M.2 2280",
    },
    compatibilityTags: ["nvme", "fast-storage", "mock-retailer"],
    recommendationReason: "Mock retailer preview for fast game and creator storage.",
  },
  {
    id: "mock-retailer-psu-850",
    category: "psu",
    brand: "be quiet!",
    model: "Pure Power 12 M 850W",
    displayName: "be quiet! Pure Power 12 M 850W Gold PSU",
    retailer: "newegg",
    price: 114.99,
    stockStatus: "low_stock",
    productUrl: dealUrl("newegg", "be quiet Pure Power 12 M 850W"),
    affiliateUrl: dealUrl("newegg", "be quiet Pure Power 12 M 850W affiliate"),
    keywords: ["be quiet", "850w", "gold", "atx 3.0", "psu", "power"],
    specs: {
      wattageW: 850,
      efficiency: "80+ Gold",
      modular: true,
      atxVersion: "ATX 3.0",
      nativeGpuConnector: true,
    },
    compatibilityTags: ["atx", "850w", "gold", "mock-retailer"],
    recommendationReason: "Mock retailer preview for a quiet 850W PSU.",
  },
  {
    id: "mock-retailer-case-4000d",
    category: "case",
    brand: "Corsair",
    model: "4000D Airflow",
    displayName: "Corsair 4000D Airflow ATX Mid-Tower Case",
    retailer: "amazon",
    price: 99.99,
    stockStatus: "in_stock",
    productUrl: dealUrl("amazon", "Corsair 4000D Airflow"),
    affiliateUrl: dealUrl("amazon", "Corsair 4000D Airflow affiliate"),
    keywords: ["corsair", "4000d", "airflow", "atx", "case"],
    specs: {
      formFactorSupport: "ATX,mATX,Mini-ITX",
      gpuClearanceMm: 360,
      coolerClearanceMm: 170,
      radiatorSupportMm: 360,
      style: "Airflow",
      color: "Black",
    },
    compatibilityTags: ["atx", "airflow", "mock-retailer"],
    recommendationReason: "Mock retailer preview for a mainstream airflow case.",
  },
  {
    id: "mock-retailer-cooler-lfiii",
    category: "cooler",
    brand: "ARCTIC",
    model: "Liquid Freezer III 280",
    displayName: "ARCTIC Liquid Freezer III 280mm AIO Cooler",
    retailer: "microcenter",
    price: 104.99,
    stockStatus: "unknown",
    productUrl: dealUrl("microcenter", "ARCTIC Liquid Freezer III 280"),
    affiliateUrl: dealUrl("microcenter", "ARCTIC Liquid Freezer III 280 affiliate"),
    keywords: ["arctic", "liquid freezer", "280", "aio", "cooler"],
    specs: {
      coolerType: "aio",
      radiatorMm: 280,
      tdpSupportW: 280,
      noiseLevel: "low",
      socketSupport: "LGA1700,AM5",
    },
    compatibilityTags: ["aio", "280mm", "mock-retailer"],
    recommendationReason: "Mock retailer preview for a compact liquid cooler.",
  },
];

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreProduct(product: MockRetailerProduct, query: string, category?: PartCategory) {
  if (category && product.category !== category) {
    return 0;
  }

  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return category ? 0.72 : 0;
  }

  const haystack = [
    product.brand,
    product.model,
    product.displayName,
    product.retailer,
    ...product.keywords,
    ...(product.compatibilityTags ?? []),
    ...Object.entries(product.specs ?? {}).flatMap(([key, value]) => [key, String(value)]),
  ]
    .join(" ")
    .toLowerCase();
  const matches = tokens.filter((token) => haystack.includes(token)).length;

  if (matches === 0) {
    return 0;
  }

  return Math.min(0.95, 0.46 + matches / tokens.length * 0.36 + (category ? 0.08 : 0));
}

export const mockRetailerProductSearchProvider: ProductSearchProvider = {
  id: "mock-retailer",
  label: "Mock retailer preview",
  async search(query: ProductSearchQuery) {
    return mockProducts
      .map((product) => ({ product, confidence: scoreProduct(product, query.query, query.category) }))
      .filter(({ confidence }) => confidence > 0)
      .sort((left, right) => right.confidence - left.confidence || (left.product.price ?? 0) - (right.product.price ?? 0))
      .slice(0, 8)
      .map(({ product, confidence }) => ({
        ...product,
        source: "mock_retailer",
        priceStatus: "known_mock",
        lastUpdated,
        confidence,
      }));
  },
};
