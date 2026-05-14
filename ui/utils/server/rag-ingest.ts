import path from 'path';

export interface RagLoadedDocument {
  pageContent?: string;
  metadata?: {
    source?: string;
    loc?: {
      pageNumber?: number;
    };
    pdf?: {
      info?: {
        Title?: string;
      };
    };
  };
}

export interface RagDocumentMetadata {
  [key: string]: string | number | boolean;
  title: string;
  page: number;
  source: string;
  chunk: number;
  contentLength: number;
}

export interface PreparedRagDocuments {
  ids: string[];
  metadatas: RagDocumentMetadata[];
  documentContents: string[];
}

export type IdFactory = () => string;

export function getPdfTitle(document: RagLoadedDocument): string | undefined {
  const title = document.metadata?.pdf?.info?.Title?.trim();
  return title ? title : undefined;
}

export function getSourceName(document: RagLoadedDocument): string {
  const source = document.metadata?.source?.trim();

  if (!source) {
    return 'uploaded-document';
  }

  return path.basename(source) || 'uploaded-document';
}

export function buildDocumentMetadata(
  document: RagLoadedDocument,
  chunk: number,
): RagDocumentMetadata {
  const content = document.pageContent ?? '';

  return {
    title: getPdfTitle(document) ?? getSourceName(document),
    page: document.metadata?.loc?.pageNumber ?? 0,
    source: document.metadata?.source ?? 'uploaded-document',
    chunk,
    contentLength: content.length,
  };
}

export function prepareDocumentsForChroma(
  docs: RagLoadedDocument[],
  idFactory: IdFactory,
): PreparedRagDocuments {
  const ids: string[] = [];
  const metadatas: RagDocumentMetadata[] = [];
  const documentContents: string[] = [];

  for (const document of docs) {
    const pageContent = document.pageContent?.trim();

    if (!pageContent) {
      continue;
    }

    const chunk = documentContents.length;

    ids.push(idFactory());
    metadatas.push(buildDocumentMetadata({ ...document, pageContent }, chunk));
    documentContents.push(pageContent);
  }

  return { ids, metadatas, documentContents };
}
