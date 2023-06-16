export function serializeSSEEvent(eventName: string, data: any): string {
	const jsonString = JSON.stringify(data);
	return `event: ${eventName}\ndata: ${jsonString}\n\n`;
}
