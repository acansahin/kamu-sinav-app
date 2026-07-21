"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	type ExportBundle,
	progressRepository,
} from "@/lib/repositories/progress.repository";
import {
	FONT_SCALE_LABELS,
	THEME_LABELS,
	usePreferences,
} from "@/lib/stores/preferences";
import type { FontScale, ThemeChoice } from "@/types/progress";
import { cn } from "@/lib/utils/cn";

function ChoiceGroup<T extends string>({
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
							"flex min-h-11 cursor-pointer items-center rounded-xl border-2 px-4",
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

export function SettingsPanel() {
	const {
		theme,
		fontScale,
		highContrast,
		setTheme,
		setFontScale,
		setHighContrast,
	} = usePreferences();

	const settings = useLiveQuery(
		() => progressRepository.getSettings(),
		[],
		undefined,
	);

	const fileInput = useRef<HTMLInputElement>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [confirmingClear, setConfirmingClear] = useState(false);

	async function exportData() {
		const bundle = await progressRepository.exportAll();
		const blob = new Blob([JSON.stringify(bundle, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `kamu-sinav-yedek-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
		setMessage("Verilerin indirildi.");
	}

	async function importData(file: File) {
		try {
			const bundle = JSON.parse(await file.text()) as ExportBundle;
			if (bundle.version !== 1) {
				setMessage("Bu yedek dosyası bu sürümle uyumlu değil.");
				return;
			}
			await progressRepository.importAll(bundle);
			setMessage("Yedek geri yüklendi.");
		} catch {
			setMessage("Dosya okunamadı. Geçerli bir yedek dosyası seçin.");
		}
	}

	return (
		<div className="space-y-4">
			<Card className="space-y-6">
				<h2 className="text-lg font-bold">Görünüm</h2>

				<ChoiceGroup<FontScale>
					legend="Yazı boyutu"
					hint="Tüm arayüz birlikte ölçeklenir."
					value={fontScale}
					options={(
						Object.keys(FONT_SCALE_LABELS) as FontScale[]
					).map((value) => ({ value, label: FONT_SCALE_LABELS[value] }))}
					onChange={setFontScale}
				/>

				<ChoiceGroup<ThemeChoice>
					legend="Tema"
					value={theme}
					options={(Object.keys(THEME_LABELS) as ThemeChoice[]).map((value) => ({
						value,
						label: THEME_LABELS[value],
					}))}
					onChange={setTheme}
				/>

				<label className="flex min-h-11 cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						checked={highContrast}
						onChange={(e) => setHighContrast(e.target.checked)}
						className="size-5 accent-[var(--brand)]"
					/>
					<span>
						<span className="block font-semibold">Yüksek kontrast</span>
						<span className="block text-sm text-fg-muted">
							Metin ve kenarlıkların kontrastını artırır.
						</span>
					</span>
				</label>
			</Card>

			<Card>
				<h2 className="mb-4 text-lg font-bold">Çalışma</h2>
				<label className="block">
					<span className="font-semibold">Günlük hedef (soru)</span>
					<input
						type="number"
						min={5}
						max={200}
						step={5}
						value={settings?.dailyGoalQuestions ?? 20}
						onChange={(e) =>
							void progressRepository.saveSettings({
								dailyGoalQuestions: Number(e.target.value),
							})
						}
						className="mt-2 block min-h-11 w-32 rounded-lg border-2 border-line bg-surface-raised px-3 text-base"
					/>
				</label>
			</Card>

			<Card>
				<h2 className="mb-1 text-lg font-bold">Verilerin</h2>
				<p className="mb-4 text-sm text-fg-muted">
					İlerlemen yalnızca bu cihazda, tarayıcının deposunda tutulur. İstediğin
					zaman dışa aktarabilir, başka bir cihazda geri yükleyebilirsin.
				</p>

				<div className="flex flex-wrap gap-3">
					<Button variant="secondary" onClick={() => void exportData()}>
						<Download aria-hidden size={18} />
						Dışa aktar
					</Button>

					<Button
						variant="secondary"
						onClick={() => fileInput.current?.click()}
					>
						<Upload aria-hidden size={18} />
						İçe aktar
					</Button>
					<input
						ref={fileInput}
						type="file"
						accept="application/json"
						className="sr-only"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void importData(file);
							e.target.value = "";
						}}
					/>
				</div>

				<hr className="my-5 border-line" />

				{confirmingClear ? (
					<div className="rounded-xl border border-wrong bg-wrong-soft p-4">
						<p className="font-semibold text-wrong">
							Tüm ilerlemen kalıcı olarak silinecek. Emin misin?
						</p>
						<p className="mt-1 text-sm text-fg-muted">
							Bu işlem geri alınamaz. Önce dışa aktarmanı öneririz.
						</p>
						<div className="mt-4 flex gap-3">
							<Button
								variant="danger"
								onClick={async () => {
									await progressRepository.clearAll();
									setConfirmingClear(false);
									setMessage("Tüm veriler silindi.");
								}}
							>
								Evet, sil
							</Button>
							<Button
								variant="secondary"
								onClick={() => setConfirmingClear(false)}
							>
								Vazgeç
							</Button>
						</div>
					</div>
				) : (
					<Button variant="danger" onClick={() => setConfirmingClear(true)}>
						<Trash2 aria-hidden size={18} />
						Tüm verileri sil
					</Button>
				)}

				{message && (
					<p role="status" className="mt-4 text-sm font-medium text-fg">
						{message}
					</p>
				)}
			</Card>
		</div>
	);
}
