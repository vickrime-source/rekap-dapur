import handler from './[...path].js';

export default function notesHandler(req: any, res: any) {
  req.query = req.query || {};
  req.query.path = ['notes'];
  return handler(req, res);
}
