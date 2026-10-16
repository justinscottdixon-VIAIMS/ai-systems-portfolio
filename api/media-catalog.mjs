import { list } from '@vercel/blob';
import { buildBlobFolderCatalogue, catalogueFailureDiagnostic } from '../src/lib/blob-folder-catalogue.mjs';
import { runtimeCatalogueEnabled } from '../src/lib/catalogue-release-policy.mjs';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

function json(response, statusCode, body) {
  response.setHeader('Content-Type', JSON_CONTENT_TYPE);
  return response.status(statusCode).json(body);
}

export function createMediaCatalogueHandler({ listPage, readText, logger = console }) {
  return async function mediaCatalogue(request, response) {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return json(response, 405, { error: 'Method not allowed' });
    }

    try {
      const catalogue = await buildBlobFolderCatalogue({
        listPage,
        readText,
        onDiagnostic: (details) => logger.warn('media catalogue omission', details),
      });
      response.setHeader('Cache-Control', 'public, s-maxage=15, must-revalidate');
      return json(response, 200, catalogue);
    } catch (error) {
      logger.error('media catalogue unavailable', catalogueFailureDiagnostic(error));
      response.setHeader('Cache-Control', 'no-store');
      return json(response, 503, { error: 'Media catalogue unavailable' });
    }
  };
}

const listPage = (options) => list({ ...options, token: process.env.BLOB_READ_WRITE_TOKEN });

const readText = async (url) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`sidecar fetch failed: ${response.status}`);
  const text = await response.text();
  if (text.length > 65_536) throw new Error('sidecar exceeds 64 KiB');
  return text;
};

const liveCatalogue = createMediaCatalogueHandler({ listPage, readText });
export default function mediaCatalogue(request, response) {
  if (!runtimeCatalogueEnabled(process.env.VIAIMS_RELEASE_SCOPE, process.env.VIAIMS_CATALOGUE_REFRESH)) {
    response.setHeader('Cache-Control', 'no-store');
    return json(response, 503, { error: 'Live catalogue is not enabled for this release' });
  }
  return liveCatalogue(request, response);
}
