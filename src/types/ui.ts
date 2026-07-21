/**
 * Sunucu bileşenlerinden istemci bileşenlerine geçirilen sadeleştirilmiş
 * içerik referansları.
 *
 * Tam `CompiledSubject` ağacını istemciye göndermek gereksiz yük olurdu;
 * istemcinin ihtiyacı olan tek şey konuyu adlandırmak ve ona bağlantı kurmak.
 */
export interface TopicRef {
	topicId: string;
	subjectId: string;
	subjectName: string;
	topicSlug: string;
	topicName: string;
	questionCount: number;
	hasSummary: boolean;
}
