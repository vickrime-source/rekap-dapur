import handler from './[...path].js';

export default function periodSummaryHandler(req: any, res: any) {
  req.query = req.query || {};
  req.query.path = ['period-summary'];
  return handler(req, res);
}
