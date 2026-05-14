import { createHash } from 'crypto';
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
  sourceHash: string;
  doi: string;
  publicationYear: number;
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

export function getFirstDoi(text: string): string | undefined {
  const match = text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);

  return match?.[0].replace(/[.,;:]+$/g, '');
}

export function getPublicationYear(text: string): number | undefined {
  const match = text.match(/\b(19|20)\d{2}\b/);

  return match ? Number(match[0]) : undefined;
}

export function buildSourceHash(document: RagLoadedDocument): string {
  const source = document.metadata?.source ?? 'uploaded-document';
  const page = document.metadata?.loc?.pageNumber ?? 0;

  return createHash('sha256')
    .update(`${source}:${page}`)
    .digest('hex')
    .slice(0, 16);
}

export function buildDocumentMetadata(
  document: RagLoadedDocument,
  chunk: number,
): RagDocumentMetadata {
  const content = document.pageContent ?? '';
  const doi = getFirstDoi(content);
  const publicationYear = getPublicationYear(content);

  return {
    title: getPdfTitle(document) ?? getSourceName(document),
    page: document.metadata?.loc?.pageNumber ?? 0,
    source: document.metadata?.source ?? 'uploaded-document',
    chunk,
    contentLength: content.length,
    sourceHash: buildSourceHash(document),
    doi: doi ?? '',
    publicationYear: publicationYear ?? 0,
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
