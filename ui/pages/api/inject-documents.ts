import type { NextApiRequest, NextApiResponse } from 'next';

import { prepareDocumentsForChroma } from '@/utils/server/rag-ingest';

import { ChromaClient, TransformersEmbeddingFunction } from 'chromadb';
import { IncomingForm } from 'formidable';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).end();
    }

    const form = new IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to upload file' });
      }

      const pdfFiles = Array.isArray(files.pdf)
        ? files.pdf
        : [files.pdf].filter(Boolean);

      if (!pdfFiles.length) {
        return res.status(400).json({ error: 'Missing PDF file upload' });
      }

      const client = new ChromaClient({
        path: process.env.CHROMA_PATH || 'http://chroma-server:8000',
      });

      const loader = new PDFLoader(pdfFiles[0].filepath);

      const originalDocs = await loader.load();

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
      });

      const docs = await splitter.splitDocuments(originalDocs);

      // Process the documents and perform other logic
      const { ids, metadatas, documentContents } = prepareDocumentsForChroma(
        docs,
        uuidv4,
      );

      if (!documentContents.length) {
        return res
          .status(400)
          .json({ error: 'PDF did not contain ingestible text' });
      }

      const embedder = new TransformersEmbeddingFunction();
      const collection = await client.getOrCreateCollection({
        name: 'default-collection',
        embeddingFunction: embedder,
      });

      await collection.add({
        ids,
        metadatas,
        documents: documentContents,
      });

      res.status(200).json({
        message: 'Documents processed successfully',
        documentCount: ids.length,
      });
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred while processing the documents' });
  }
}
