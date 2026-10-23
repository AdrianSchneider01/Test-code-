// Minimal SMTP client over Workers TCP sockets: STARTTLS + AUTH LOGIN, one message.
// Used to send the daily report through the Google Workspace SMTP relay
// (smtp-relay.gmail.com:587, rule "Require SMTP Authentication", app password).

import { connect } from "cloudflare:sockets";

const enc = new TextEncoder();
const dec = new TextDecoder();

// Reads SMTP replies from a socket; handles multi-line ("250-...") replies.
function replyReader(socket) {
  const reader = socket.readable.getReader();
  let buf = "";
  return {
    async read() {
      for (;;) {
        const lines = buf.split("\r\n");
        // A complete reply ends with a line "NNN text" (space after the code)
        for (let i = 0; i < lines.length - 1; i++) {
          if (/^\d{3} /.test(lines[i]) || /^\d{3}$/.test(lines[i])) {
            const text = lines.slice(0, i + 1).join("\n");
            buf = lines.slice(i + 1).join("\r\n");
            return { code: Number(lines[i].slice(0, 3)), text };
          }
        }
        const { value, done } = await reader.read();
        if (done) throw new Error(`SMTP connection closed; partial reply: ${buf.slice(0, 200)}`);
        buf += dec.decode(value, { stream: true });
      }
    },
    release() { reader.releaseLock(); },
  };
}

function b64(s) {
  return btoa(String.fromCharCode(...enc.encode(s)));
}

// Base64 body wrapped at 76 characters, so no SMTP line exceeds the 998-octet limit
function b64Lines(s) {
  const bytes = enc.encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).match(/.{1,76}/g).join("\r\n");
}

// RFC 2047 encoded-word for non-ASCII subjects
function header(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}

/**
 * Send one HTML message.
 * @param {{host:string, port:number, user:string, password:string, helo:string}} cfg
 * @param {{from:string, to:string[], subject:string, html:string}} msg
 */
export async function sendMail(cfg, msg) {
  const plain = connect({ hostname: cfg.host, port: cfg.port }, { secureTransport: "starttls" });
  let r = replyReader(plain);
  let w = plain.writable.getWriter();
  const transcript = [];

  const expect = async (codes, label) => {
    const rep = await r.read();
    transcript.push(`${label} -> ${rep.code}`);
    if (!codes.includes(rep.code)) throw new Error(`SMTP ${label} failed: ${rep.text.slice(0, 300)}`);
    return rep;
  };
  const cmd = async (line, codes, label = line.split(" ")[0]) => {
    await w.write(enc.encode(line + "\r\n"));
    return expect(codes, label);
  };

  await expect([220], "greeting");
  await cmd(`EHLO ${cfg.helo}`, [250]);
  await cmd("STARTTLS", [220]);

  // Upgrade: the plain socket's reader/writer stop working, so take new ones
  r.release();
  w.releaseLock();
  const tls = plain.startTls();
  r = replyReader(tls);
  w = tls.writable.getWriter();

  try {
    await cmd(`EHLO ${cfg.helo}`, [250]);
    await cmd("AUTH LOGIN", [334]);
    await cmd(b64(cfg.user), [334], "user");
    await cmd(b64(cfg.password), [235], "password");
    await cmd(`MAIL FROM:<${msg.from}>`, [250], "MAIL FROM");
    for (const to of msg.to) await cmd(`RCPT TO:<${to}>`, [250, 251], "RCPT TO");
    await cmd("DATA", [354]);

    const body = [
      `From: ${msg.from}`,
      `To: ${msg.to.join(", ")}`,
      `Subject: ${header(msg.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@${cfg.helo}>`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64Lines(msg.html),
    ].join("\r\n");
    await w.write(enc.encode(body + "\r\n.\r\n"));   // base64 body never starts a line with "."
    await expect([250], "message");
    await cmd("QUIT", [221]);
  } finally {
    try { await w.close(); } catch {}
    try { tls.close(); } catch {}
  }
  return transcript;
}
