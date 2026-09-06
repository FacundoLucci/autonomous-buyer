export const sourceMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  csv: "text/csv",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const sourceAccept = ".pdf,.png,.jpg,.jpeg,.csv,.txt,.xlsx,.docx";
export function fileMime(name: string) {
  return sourceMimeTypes[name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}
