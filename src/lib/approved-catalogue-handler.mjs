import { readApprovedRegistry } from './approved-catalogue.mjs';

export function createApprovedMediaCatalogueHandler({ store, logger = console }) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const result = await store.read();
      if (!result) throw new Error('Not initialized');
      return response.status(200).json(readApprovedRegistry(result.registry));
    } catch {
      logger.error('Approved media catalogue unavailable');
      return response.status(503).json({ error: 'Media catalogue unavailable' });
    }
  };
}
