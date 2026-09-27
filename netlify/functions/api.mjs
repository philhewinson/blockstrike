import { getStore } from '@netlify/blobs';
import { handle } from '../../server/core.mjs';

export default req => handle(req, getStore({ name: 'blockstrike', consistency: 'strong' }));

export const config = { path: '/api/*' };
