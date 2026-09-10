import handler from './[...path].js';

export default function batchStatusHandler(req: any, res: any) {
  req.query = req.query || {};
  req.query.path = ['batch-status'];
  return handler(req, res);
}
