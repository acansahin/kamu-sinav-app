import { facebookYayincisi } from "./facebook";
import { instagramYayincisi } from "./instagram";
import type { Yayinci } from "./types";
import { xYayincisi } from "./x";

/**
 * Yayıncı kaydı. Sıra bilinçli: X en hızlı yanıt veren ve en az adımlı olan;
 * Instagram en yavaş (container yoklaması) ve en kırılgan olduğu için en
 * sonda. Bir platformun hatası diğerlerini durdurmaz (`run.ts`).
 */
export const YAYINCILAR: Yayinci[] = [
	xYayincisi,
	facebookYayincisi,
	instagramYayincisi,
];

export type { Yayinci } from "./types";
