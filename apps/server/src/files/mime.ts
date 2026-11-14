/** The formats the editors open, plus a few the file list should recognise. */
const MIME_BY_EXTENSION: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  doc: "application/msword",
  rtf: "application/rtf",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** The type of a file whose extension says nothing we know. */
export const UNKNOWN_MIME = "application/octet-stream";

/** By extension, not by the browser's guess: the browser sends what the OS thinks, which varies. */
export const mimeOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return UNKNOWN_MIME;
  return MIME_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? UNKNOWN_MIME;
};

/** The extension a file of this type usually has ("application/pdf; x=y" → ".pdf"), if known. */
export const extensionOf = (contentType: string | null): string | undefined => {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  const found = Object.entries(MIME_BY_EXTENSION).find(([, known]) => known === mime);
  return found && `.${found[0]}`;
};
