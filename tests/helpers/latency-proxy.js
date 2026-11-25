import http from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
export async function latencyProxy(target, roundTripMs) {
  const upstream = new URL(target),
    timers = new Set(),
    sockets = new Set(),
    wss = new WebSocketServer({ noServer: true });
  const later = (fn) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, roundTripMs / 2);
    timers.add(t);
  };
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = { 'accept-encoding': 'identity' };
      for (const k of ['origin', 'authorization', 'content-type'])
        if (req.headers[k]) headers[k] = req.headers[k];
      const response = await fetch(upstream.origin + req.url, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
      });
      const body = Buffer.from(await response.arrayBuffer()),
        out = new Headers(response.headers);
      for (const k of ['content-encoding', 'content-length', 'transfer-encoding']) out.delete(k);
      out.set('content-length', body.length);
      res.writeHead(response.status, Object.fromEntries(out));
      res.end(body);
    } catch {
      res.writeHead(503);
      res.end();
    }
  });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, upstream);
    url.protocol = 'ws:';
    const protocols = (req.headers['sec-websocket-protocol'] || '').split(',').map((s) => s.trim());
    const remote = new WebSocket(url, protocols, { origin: req.headers.origin });
    sockets.add(remote);
    let local;
    const pending = [];
    remote.on('message', (data, binary) => {
      const send = () => {
        if (local?.readyState === WebSocket.OPEN) local.send(data, { binary });
      };
      if (local) later(send);
      else pending.push(send);
    });
    remote.once('open', () =>
      wss.handleUpgrade(req, socket, head, (front) => {
        local = front;
        sockets.add(front);
        for (const send of pending) later(send);
        front.on('message', (data, binary) =>
          later(() => {
            if (remote.readyState === WebSocket.OPEN) remote.send(data, { binary });
          })
        );
        front.on('close', () => {
          sockets.delete(front);
          remote.close();
        });
        front.on('error', () => remote.close());
      })
    );
    remote.on('close', () => {
      sockets.delete(remote);
      local?.close();
      if (!local) socket.destroy();
    });
    remote.on('error', () => {
      socket.destroy();
      local?.close();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: 'http://127.0.0.1:' + server.address().port,
    async close() {
      for (const t of timers) clearTimeout(t);
      for (const s of sockets) s.terminate();
      wss.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
  };
}
