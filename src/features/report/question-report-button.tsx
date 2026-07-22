"use client";

import { Check, Flag } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { progressRepository } from "@/lib/repositories/progress.repository";
import type { ReportReason } from "@/types/progress";

/**
 * Soru hata bildirimi.
 *
 * Rakiplerin en çok şikâyet edilen açığı, bildirilen hatalı soruların
 * düzeltilmemesi ve bildirimin akıbetinin görünmemesi (PROJECT_PLAN.md §3.2).
 * Bu yüzden bildirim MVP'de bile kaydedilir, kullanıcıya geri bildirim verilir
 * ve Ayarlar'dan dışa aktarılabilir. Faz 3'te sunucuya gönderilecek.
 *
 * Modal yerine yerinde açılan panel kullanılır: odak tuzağı gerektirmez,
 * klavyeyle doğal sırada gezilir ve küçük ekranda kaydırmayı bozmaz.
 */

const REASONS: { value: ReportReason; label: string }[] = [
	{ value: "yanlis-cevap", label: "Doğru cevap yanlış görünüyor" },
	{ value: "guncel-degil", label: "Bilgi güncel değil" },
	{ value: "belirsiz-ifade", label: "Soru veya şık belirsiz" },
	{ value: "yazim-hatasi", label: "Yazım hatası" },
	{ value: "diger", label: "Diğer" },
];

export function QuestionReportButton({ questionId }: { questionId: string }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState<ReportReason>("yanlis-cevap");
	const [note, setNote] = useState("");
	const [sent, setSent] = useState(false);
	const groupName = useId();
	const noteId = useId();

	if (sent) {
		return (
			<p
				role="status"
				className="mt-4 flex items-center gap-2 text-sm font-medium text-correct"
			>
				<Check aria-hidden size={16} />
				Bildirimin kaydedildi. Ayarlar&apos;dan bildirimlerini görebilirsin.
			</p>
		);
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="mt-4 flex min-h-11 items-center gap-1.5 text-sm font-medium text-fg-subtle underline hover:text-fg"
			>
				<Flag aria-hidden size={14} />
				Bu soruda sorun var
			</button>
		);
	}

	return (
		<div className="mt-4 rounded-xl border border-line bg-surface-sunken p-4">
			<fieldset>
				<legend className="mb-2 font-semibold">Sorun nedir?</legend>
				<div className="space-y-1.5">
					{REASONS.map((option) => (
						<label
							key={option.value}
							className="flex min-h-11 cursor-pointer items-center gap-2.5"
						>
							<input
								type="radio"
								name={groupName}
								checked={reason === option.value}
								onChange={() => setReason(option.value)}
								className="size-5 accent-[var(--brand)]"
							/>
							{option.label}
						</label>
					))}
				</div>
			</fieldset>

			<label htmlFor={noteId} className="mt-3 block font-semibold">
				Eklemek istediğin bir şey var mı?
			</label>
			<textarea
				id={noteId}
				value={note}
				onChange={(e) => setNote(e.target.value)}
				rows={3}
				className="mt-1.5 w-full rounded-lg border-2 border-line bg-surface-raised p-2.5 text-base"
				placeholder="İsteğe bağlı"
			/>

			<div className="mt-3 flex flex-wrap gap-3">
				<Button
					size="sm"
					onClick={async () => {
						await progressRepository.saveReport({
							questionId,
							reason,
							note: note.trim() || undefined,
							status: "yerel",
						});
						setSent(true);
					}}
				>
					Bildir
				</Button>
				<Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
					Vazgeç
				</Button>
			</div>
		</div>
	);
}
