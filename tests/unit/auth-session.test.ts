// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { IAuthProvider } from "@/lib/auth/auth.provider";
import { AuthRequestError, describeAuthError } from "@/lib/auth/auth-errors";
import {
	type Identity,
	LOCAL_IDENTITY,
	currentIdentity,
	currentUserId,
	setIdentity,
} from "@/lib/auth/identity";
import {
	reconcileSession,
	signInWithCode,
	signOut,
} from "@/lib/auth/session";
import {
	type RecordAttemptInput,
	progressRepository,
} from "@/lib/repositories/progress.repository";

/**
 * Oturum akışı — dilimin veri kaybı riski buraya toplanıyor.
 *
 * Kimlik değişimi ile veri taşıma AYNI anda olmak zorunda ve sıra bağlayıcı:
 * önce `reassignOwner` (eski kimlik hâlâ aktifken), sonra `setIdentity`. Ters
 * sırada satırlar eski kimlikle damgalı kalır ve repository onları filtreleyip
 * dışarıda bırakır — kullanıcı ilerlemesini kaybetmiş görünür.
 */

const ACCOUNT: Identity = {
	kind: "account",
	userId: "u-42",
	email: "memur@ornek.gov.tr",
};

const attempt: RecordAttemptInput = {
	questionId: "q1",
	subjectId: "657-dmk",
	topicId: "657-dmk/yasaklar",
	difficulty: "orta",
	selectedIndex: 1,
	isCorrect: true,
	durationMs: 9000,
	context: "practice",
	sessionId: "s1",
};

/** Ağa çıkmayan sahte sağlayıcı; davranışı testten teste ayarlanır. */
function stubProvider(overrides: Partial<IAuthProvider> = {}): IAuthProvider {
	return {
		current: () => currentIdentity(),
		requestCode: async () => undefined,
		verifyCode: async () => ACCOUNT,
		signOut: async () => undefined,
		currentServerIdentity: async () => ACCOUNT,
		...overrides,
	};
}

beforeEach(async () => {
	setIdentity(LOCAL_IDENTITY);
	await progressRepository.clearAll();
});

describe("signInWithCode", () => {
	it("cihazdaki ilerlemeyi hesaba taşır", async () => {
		await progressRepository.recordAttempt(attempt);

		const result = await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());

		expect(result.identity).toEqual(ACCOUNT);
		expect(result.claimedLocalData).toBe(true);
		expect(currentUserId()).toBe("u-42");

		// Asıl mesele: veri hâlâ görünüyor mu?
		const stats = await progressRepository.getStatistics(1);
		expect(stats.totalAttempts).toBe(1);
	});

	it("taşınacak veri yoksa bunu bildirir", async () => {
		const result = await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());
		expect(result.claimedLocalData).toBe(false);
	});

	it("kod yanlışsa kimliğe ve veriye dokunmaz", async () => {
		await progressRepository.recordAttempt(attempt);

		const failing = stubProvider({
			verifyCode: async () => {
				throw new AuthRequestError("Kod geçersiz veya süresi dolmuş.");
			},
		});

		await expect(
			signInWithCode("memur@ornek.gov.tr", "000000", failing),
		).rejects.toBeInstanceOf(AuthRequestError);

		// Başarısız giriş sonrası kullanıcı hâlâ anonim ve verisi yerinde olmalı.
		expect(currentUserId()).toBe("local");
		expect((await progressRepository.getStatistics(1)).totalAttempts).toBe(1);
	});

	it("aynı hesaba yeniden girmek veriyi taşımaya kalkışmaz", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());
		await progressRepository.recordAttempt(attempt);

		const again = await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());

		expect(again.claimedLocalData).toBe(false);
		expect((await progressRepository.getStatistics(1)).totalAttempts).toBe(1);
	});
});

describe("signOut", () => {
	it("veriyi cihazın anonim kimliğine geri taşır", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());
		await progressRepository.recordAttempt(attempt);

		await signOut(stubProvider());

		// Veri hesapta damgalı bırakılsaydı çıkışta görünmez olurdu.
		expect(currentUserId()).toBe("local");
		expect((await progressRepository.getStatistics(1)).totalAttempts).toBe(1);
	});

	it("sunucuya ulaşılamasa da yerel oturumu kapatır", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());

		const offline = stubProvider({
			signOut: async () => {
				throw new Error("network");
			},
		});

		// Çıkış yapmak isteyen kullanıcı ağ yüzünden hesabında kilitli kalmamalı.
		await expect(signOut(offline)).rejects.toThrow();
		expect(currentUserId()).toBe("local");
	});
});

describe("reconcileSession", () => {
	it("sunucudaki oturum kapanmışsa yerel oturumu da kapatır", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());
		await progressRepository.recordAttempt(attempt);

		await reconcileSession(stubProvider({ currentServerIdentity: async () => null }));

		expect(currentUserId()).toBe("local");
		// Oturum kapanabilir; veri kaybolamaz.
		expect((await progressRepository.getStatistics(1)).totalAttempts).toBe(1);
	});

	it("çevrimdışıyken kullanıcıyı oturumdan atmaz", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());

		// "Oturum yok" ile "şu an bilemiyorum" farklı şeylerdir.
		await reconcileSession(
			stubProvider({
				currentServerIdentity: async () => {
					throw new AuthRequestError("İnternet bağlantısı kurulamadı.");
				},
			}),
		);

		expect(currentUserId()).toBe("u-42");
	});

	it("anonim kullanıcı için sunucuya hiç sormaz", async () => {
		let asked = false;
		await reconcileSession(
			stubProvider({
				currentServerIdentity: async () => {
					asked = true;
					return null;
				},
			}),
		);

		expect(asked).toBe(false);
		expect(currentUserId()).toBe("local");
	});
});

describe("senkron bağlantısı", () => {
	it("giriş, KİMLİK damgalandıktan sonra eşitler", async () => {
		let userIdAtSync: string | null = null;
		const sync = async () => {
			userIdAtSync = currentUserId();
		};

		const result = await signInWithCode(
			"memur@ornek.gov.tr",
			"123456",
			stubProvider(),
			sync,
		);

		// Sıra bağlayıcı: sync çalıştığında yerel veri artık HESAP kimliğiyle
		// damgalı olmalı, yoksa gönderilecek satırlar eski kimlikte kalırdı.
		expect(userIdAtSync).toBe("u-42");
		expect(result.synced).toBe(true);
	});

	it("çevrimdışı eşitleme girişi bozmaz, dürüstçe bildirir", async () => {
		const failing = async () => {
			throw new Error("network");
		};

		const result = await signInWithCode(
			"memur@ornek.gov.tr",
			"123456",
			stubProvider(),
			failing,
		);

		// Kullanıcı girişli ve yerel verisi güvende; yalnızca eşitleme ertelendi.
		expect(currentUserId()).toBe("u-42");
		expect(result.synced).toBe(false);
	});

	it("çıkış, kimlik HÂLÂ hesapken eşitler (son gönderim)", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());

		let userIdAtSync: string | null = null;
		const sync = async () => {
			userIdAtSync = currentUserId();
		};

		await signOut(stubProvider(), sync);

		// Gönderim, veriyi anonim kimliğe geri taşımadan ÖNCE olmalı; sonra
		// olsaydı hesabın satırları sunucuya hiç ulaşmazdı.
		expect(userIdAtSync).toBe("u-42");
		expect(currentUserId()).toBe("local");
	});

	it("çevrimdışı eşitleme çıkışı engellemez", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());

		const failing = async () => {
			throw new Error("network");
		};

		await signOut(stubProvider(), failing);
		expect(currentUserId()).toBe("local");
	});

	it("oturum geçerliyken uzlaştırma başka cihazların verisini çeker", async () => {
		await signInWithCode("memur@ornek.gov.tr", "123456", stubProvider());

		let pulled = false;
		const sync = async () => {
			pulled = true;
		};

		await reconcileSession(stubProvider(), sync);
		expect(pulled).toBe(true);
	});

	it("anonim kullanıcı için uzlaştırma eşitlemeye kalkışmaz", async () => {
		let pulled = false;
		const sync = async () => {
			pulled = true;
		};

		await reconcileSession(stubProvider(), sync);
		expect(pulled).toBe(false);
	});
});

describe("describeAuthError", () => {
	it("hız sınırını ne yapılacağını söyleyerek anlatır", () => {
		expect(describeAuthError({ code: "over_email_send_rate_limit" })).toContain(
			"bekle",
		);
		expect(describeAuthError({ status: 429 })).toContain("bekle");
	});

	it("süresi geçmiş kodu yeni kod istemeye yönlendirir", () => {
		expect(describeAuthError({ code: "otp_expired" })).toContain("Yeni bir kod");
		expect(describeAuthError({ message: "Token has expired" })).toContain(
			"Yeni bir kod",
		);
	});

	it("ağ hatasında çevrimdışı çalışmaya devam edilebileceğini söyler", () => {
		expect(describeAuthError({ message: "Failed to fetch" })).toContain(
			"çalışmaya devam",
		);
	});

	it("tanımadığı hatayı da Türkçe ve eyleme dönük anlatır", () => {
		const message = describeAuthError({ code: "bilinmeyen_kod" });
		expect(message).toContain("yeniden");
		// Supabase'in İngilizce metni kullanıcıya sızmamalı.
		expect(message).not.toMatch(/[a-z]+_[a-z]+/);
	});

	it("hata yokken bile bir mesaj döner", () => {
		expect(describeAuthError(null)).toBeTruthy();
	});
});
