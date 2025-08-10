import app from '../src/app';

// Export Express app directly; Vercel Node runtime can use it as a handler.
export default app as any;
