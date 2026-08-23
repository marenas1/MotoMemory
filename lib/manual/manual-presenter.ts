import type {
  ManualDocumentRecord,
  ManualIdentity,
} from "@/lib/manual/manual-types";

export function toManualIdentity(manual: ManualDocumentRecord): ManualIdentity {
  return {
    id: manual.id,
    fileName: manual.fileName,
    sha256: manual.sha256,
    pageCount: manual.pageCount,
  };
}
