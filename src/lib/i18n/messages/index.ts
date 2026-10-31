import type { Lang, Messages } from "..";
import { es } from "./es";
import { pt } from "./pt";
import { vi } from "./vi";
import { zh } from "./zh";

/** Every language's phrases (English is the code itself). Server only: pages send one language down. */
export const MESSAGES: Record<Lang, Messages> = { en: {}, es, zh, vi, pt };
