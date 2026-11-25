import { startBackend } from '../helpers/backend.js';
export default async function setup() {
  const backend = await startBackend({ port: 8787 });
  return () => backend.mf.dispose();
}
