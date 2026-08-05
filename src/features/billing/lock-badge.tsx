import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Liste satırlarındaki kilit göstergesi.
 *
 * İkon TEK BAŞINA kullanılmaz: erişilebilirlik sözleşmesi gereği renk ve şekil
 * anlamı taşıyamaz, durum metinle de söylenir (PROJECT_PLAN.md §13.2).
 */
export function LockBadge() {
	return (
		<Badge tone="brand" className="shrink-0">
			<Lock aria-hidden size={14} />
			Tam erişim
		</Badge>
	);
}
