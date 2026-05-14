import {
  buildDocumentMetadata,
  buildSourceHash,
  getFirstDoi,
  getPdfTitle,
  getPublicationYear,
  getSourceName,
  prepareDocumentsForChroma,
} from '@/utils/server/rag-ingest';

import { describe, expect, it } from 'vitest';

describe('RAG document ingestion helpers', () => {
  it('uses PDF title metadata when present', () => {
    const document = {
      pageContent: 'Findings text',
      metadata: {
        source: '/tmp/fallback.pdf',
        loc: { pageNumber: 3 },
        pdf: { info: { Title: '  Trial Protocol  ' } },
      },
    };

    expect(getPdfTitle(document)).toBe('Trial Protocol');
    expect(buildDocumentMetadata(document, 2)).toEqual({
      title: 'Trial Protocol',
      page: 3,
      source: '/tmp/fallback.pdf',
      chunk: 2,
      contentLength: 13,
      sourceHash: buildSourceHash(document),
      doi: '',
      publicationYear: 0,
    });
  });

  it('falls back to the source file name when PDF title metadata is missing', () => {
    const document = {
      pageContent: 'Methods text',
      metadata: {
        source: '/uploads/research-paper.pdf',
        loc: { pageNumber: 7 },
      },
    };

    expect(getPdfTitle(document)).toBeUndefined();
    expect(getSourceName(document)).toBe('research-paper.pdf');
    expect(buildDocumentMetadata(document, 0).title).toBe('research-paper.pdf');
  });

  it('handles missing metadata without throwing', () => {
    const metadata = buildDocumentMetadata({ pageContent: 'Abstract text' }, 0);

    expect(metadata).toEqual({
      title: 'uploaded-document',
      page: 0,
      source: 'uploaded-document',
      chunk: 0,
      contentLength: 13,
      sourceHash: buildSourceHash({ pageContent: 'Abstract text' }),
      doi: '',
      publicationYear: 0,
    });
  });

  it('extracts citation metadata and stable source hashes for retrieval', () => {
    const document = {
      pageContent:
        'Rivera et al. 2025 reported supporting evidence in DOI 10.1016/j.watres.2025.120001.',
      metadata: {
        source: '/uploads/flood-study.pdf',
        loc: { pageNumber: 12 },
      },
    };
    const metadata = buildDocumentMetadata(document, 4);

    expect(getFirstDoi(`${document.pageContent}.`)).toBe(
      '10.1016/j.watres.2025.120001',
    );
    expect(getPublicationYear(document.pageContent)).toBe(2025);
    expect(metadata).toMatchObject({
      title: 'flood-study.pdf',
      page: 12,
      source: '/uploads/flood-study.pdf',
      chunk: 4,
      doi: '10.1016/j.watres.2025.120001',
      publicationYear: 2025,
    });
    expect(metadata.sourceHash).toHaveLength(16);
    expect(metadata.sourceHash).toBe(buildSourceHash(document));
  });

  it('skips blank chunks and assigns dense chunk indices', () => {
    let nextId = 0;
    const prepared = prepareDocumentsForChroma(
      [
        { pageContent: '  ' },
        { pageContent: ' First chunk ', metadata: { source: 'first.pdf' } },
        { pageContent: '\n\n' },
        { pageContent: 'Second chunk', metadata: { source: 'second.pdf' } },
      ],
      () => `doc-${++nextId}`,
    );

    expect(prepared).toEqual({
      ids: ['doc-1', 'doc-2'],
      metadatas: [
        {
          title: 'first.pdf',
          page: 0,
          source: 'first.pdf',
          chunk: 0,
          contentLength: 11,
          sourceHash: buildSourceHash({
            pageContent: 'First chunk',
            metadata: { source: 'first.pdf' },
          }),
          doi: '',
          publicationYear: 0,
        },
        {
          title: 'second.pdf',
          page: 0,
          source: 'second.pdf',
          chunk: 1,
          contentLength: 12,
          sourceHash: buildSourceHash({
            pageContent: 'Second chunk',
            metadata: { source: 'second.pdf' },
          }),
          doi: '',
          publicationYear: 0,
        },
      ],
      documentContents: ['First chunk', 'Second chunk'],
    });
  });

  it('returns an empty prepared payload when every chunk is blank', () => {
    const prepared = prepareDocumentsForChroma(
      [{ pageContent: '  ' }, { pageContent: '\n\n' }],
      () => 'unused',
    );

    expect(prepared).toEqual({
      ids: [],
      metadatas: [],
      documentContents: [],
    });
  });
});
