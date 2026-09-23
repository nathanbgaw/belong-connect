import type { ResourceCategory } from "./categories";

export type Confidence = "stated" | "inferred";

/** One thing a church offers that a person outside the congregation could use. */
export interface ExtractedResource {
  title: string;
  category: ResourceCategory;
  description: string;
  audience: string | null;
  schedule: string | null;
  howToAccess: string | null;
  contact: string | null;
  sourceUrl: string | null;
  confidence: Confidence;
}

/** What the extractor produces from a crawled site. */
export interface ChurchProfile {
  name: string;
  website: string;
  denomination: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  serviceTimes: string | null;
  summary: string;
  ministries: string[];
  resources: ExtractedResource[];
  tags: ResourceCategory[];
  pagesRead: string[];
}

export type ChurchStatus = "pending" | "scanned" | "failed" | "unreadable";

export interface ChurchRow {
  id: string;
  slug: string;
  host: string | null;
  name: string;
  website: string | null;
  denomination: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  service_times: string | null;
  summary: string | null;
  tags: string[];
  profile: ChurchProfile | null;
  pages_read: string[];
  source: "scan" | "osm" | "church";
  status: ChurchStatus;
  error: string | null;
  scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceRow {
  id: string;
  church_id: string;
  title: string;
  category: string;
  description: string | null;
  audience: string | null;
  schedule: string | null;
  how_to_access: string | null;
  contact: string | null;
  source_url: string | null;
  confidence: Confidence;
}

export interface NeedRow {
  id: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  category: string;
  description: string;
  contact_ok: boolean;
  contact: string | null;
  status: string;
  created_at: string;
}

export interface OfferRow {
  id: string;
  church_name: string;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

/** A church near a point — from OpenStreetMap, our database, or both. */
export interface NearbyChurch {
  key: string; // host if known, else osm id
  name: string;
  website: string | null;
  host: string | null;
  lat: number;
  lng: number;
  distanceMiles: number;
  address: string | null;
  phone: string | null;
  denomination: string | null;
  /** Present when we have already read this church's website. */
  scanned: ChurchRow | null;
}

export interface ScanStatusEvent {
  type: "status";
  text: string;
}
