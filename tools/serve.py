#!/usr/bin/env python3
"""Local dev server for Windloom that tells the browser never to cache.

The plain `python3 -m http.server` sends no Cache-Control header, so browsers may keep
using old copies of the JS modules after you edit them (a new index.html with old game.js).
Usage, from the repository root:  python3 tools/serve.py [port]   (default 8000)
"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    print(f'Windloom on http://localhost:{port} (no caching). Ctrl+C to stop.')
    http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
