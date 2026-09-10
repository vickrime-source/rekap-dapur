import handler from './[...path].js';

export default function pesananHandler(req: any, res: any) {
  req.query = req.query || {};
  req.query.path = ['pesanan'];
  return handler(req, res);
}
