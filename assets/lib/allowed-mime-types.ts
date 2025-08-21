export const allowedMimeTypes = [
  // 📄 Documents
  "application/pdf",
  "application/msword",                     // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.oasis.opendocument.text", // .odt
  "text/plain",                              // .txt
  "application/rtf",                         // .rtf
  "text/markdown",                           // .md

  // 📊 Spreadsheets
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.oasis.opendocument.spreadsheet", // .ods
  "text/csv", // .csv

  // 🖼️ Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",

  // 📑 Presentations
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.oasis.opendocument.presentation", // .odp

  // 📦 Archives
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "application/x-7z-compressed",
] as const;
