# A tiny SMTP server for the e2e tests: accepts every email (any login) and appends it to a
# file as one JSON line {to, subject, html, text, unsubscribe, unsubscribePost}. Nothing is sent.
# Usage: python3 tests/e2e/mail-catcher.py 2525 /path/mails.jsonl
# Then start the app with SMTP_HOST=127.0.0.1 SMTP_PORT=2525 GMAIL_USER=test@example.com GMAIL_APP_PASSWORD=x
import json
import socketserver
import sys
from email import policy
from email.parser import BytesParser

PORT = int(sys.argv[1])
LOG = sys.argv[2]


def save(raw: bytes, rcpts: list[str]):
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    html = msg.get_body(preferencelist=("html",))
    text = msg.get_body(preferencelist=("plain",))
    entry = {
        "to": ", ".join(rcpts) or str(msg.get("To", "")),
        "subject": str(msg.get("Subject", "")),
        "html": html.get_content() if html else "",
        "text": text.get_content() if text else "",
        "unsubscribe": str(msg.get("List-Unsubscribe", "")),
        "unsubscribePost": str(msg.get("List-Unsubscribe-Post", "")),
    }
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


class Handler(socketserver.StreamRequestHandler):
    def send(self, line: str):
        self.wfile.write((line + "\r\n").encode())

    def handle(self):
        self.send("220 catcher ready")
        rcpts: list[str] = []
        while True:
            line = self.rfile.readline()
            if not line:
                return
            cmd = line.decode(errors="replace").strip()
            up = cmd.upper()
            if up.startswith("EHLO"):
                self.wfile.write(b"250-catcher\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n")
            elif up.startswith("HELO"):
                self.send("250 catcher")
            elif up.startswith("AUTH LOGIN"):
                parts = cmd.split()
                if len(parts) < 3:  # username comes on its own line
                    self.send("334 VXNlcm5hbWU6")
                    self.rfile.readline()
                self.send("334 UGFzc3dvcmQ6")
                self.rfile.readline()
                self.send("235 ok")
            elif up.startswith("AUTH"):
                self.send("235 ok")
            elif up.startswith("MAIL FROM"):
                rcpts = []
                self.send("250 ok")
            elif up.startswith("RCPT TO"):
                rcpts.append(cmd.split(":", 1)[1].strip().strip("<>"))
                self.send("250 ok")
            elif up == "DATA":
                self.send("354 go on")
                chunks = []
                while True:
                    l = self.rfile.readline()
                    if l in (b".\r\n", b".\n", b""):
                        break
                    chunks.append(l[1:] if l.startswith(b"..") else l)
                save(b"".join(chunks), rcpts)
                self.send("250 saved")
            elif up == "QUIT":
                self.send("221 bye")
                return
            else:  # RSET, NOOP and anything else
                self.send("250 ok")


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


Server(("127.0.0.1", PORT), Handler).serve_forever()
