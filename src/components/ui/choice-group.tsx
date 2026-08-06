"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Birbirini dışlayan seçenekler için pil biçiminde radyo grubu.
 *
 * Gerçek `fieldset`/`legend`/`input[type=radio]` kullanır: klavye gezinmesi,
 * grup adının duyurulması ve seçim semantiği tarayıcıdan gelir, yeniden
 * yazılmaz (AGENTS.md erişilebilirlik sözleşmesi).
 *
 * Görünür kontrol etiketin kendisidir; `input` `sr-only`dir. Bu yüzden odak
 * halkası `globals.css` içindeki `.secim-etiketi:has(:focus-visible)` kuralıyla
 * etikete taşınmıştır — **sınıf adı değişirse odak halkası sessizce kaybolur.**
 *
 * Önce `features/settings/settings-panel.tsx` içinde yerel bir bileşendi;
 * sesli okuma oynatıcısı da aynı kalıba ihtiyaç duyunca buraya taşındı.
 * Kopyalamak yerine taşımak, iki kopyanın zamanla ayrışmasını engelliyor.
 */
export function ChoiceGroup<T extends string>({
	legend,
	hint,
	value,
	options,
	onChange,
}: {
	legend: string;
	hint?: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) {
	const name = useId();

	return (
		<fieldset>
			<legend className="font-semibold">{legend}</legend>
			{hint && <p className="mb-2 text-sm text-fg-muted">{hint}</p>}
			<div className="mt-2 flex flex-wrap gap-2">
				{options.map((option) => (
					<label
						key={option.value}
						className={cn(
							"secim-etiketi flex min-h-11 cursor-pointer items-center rounded-xl border-2 px-4",
							value === option.value
								? "border-brand bg-brand-soft font-semibold"
								: "border-line bg-surface-raised",
						)}
					>
						<input
							type="radio"
							name={name}
							checked={value === option.value}
							onChange={() => onChange(option.value)}
							className="sr-only"
						/>
						{option.label}
					</label>
				))}
			</div>
		</fieldset>
	);
}
