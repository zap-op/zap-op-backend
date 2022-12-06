export function serializeSSEEvent(event: string, data: any) {
    const jsonString = JSON.stringify(data);
    return `event: ${event}\ndata: ${jsonString}\n\n`;
}