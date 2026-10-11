// Cloudflare Access JWT check — same approach as the portfolio Worker.
let certCache = { team: null, at: 0, keys: [] };

const b64urlDecode = s => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};
const decodeJson = s => JSON.parse(new TextDecoder().decode(b64urlDecode(s)));

async function getKeys(team, force = false) {
  if (!force && certCache.team === team && Date.now() - certCache.at < 3.6e6) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error("Could not fetch Access certs");
  const { keys } = await r.json();
  certCache = { team, at: Date.now(), keys: keys || [] };
  return certCache.keys;
}

async function verifyAccessJwt(token, env) {
  const team = env.ACCESS_TEAM_DOMAIN;
  const parts = (token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [h, p, s] = parts;
  const header = decodeJson(h), payload = decodeJson(p);
  if (header.alg !== "RS256") throw new Error("Unexpected alg");
  let jwk = (await getKeys(team)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(team, true)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error("Bad signature");
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error("Wrong audience");
  if (payload.iss !== `https://${team}`) throw new Error("Wrong issuer");
  if (!payload.exp || payload.exp < now) throw new Error("Expired");
  if (payload.nbf && payload.nbf > now + 60) throw new Error("Not yet valid");
  return payload.email || null;
}

export async function authorize(request, env, url) {
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isLocal && env.DEV_BYPASS_AUTH === "true") return { ok: true, email: "local-dev" };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return { ok: false, status: 503, message: "Locked: Cloudflare Access is not configured for this Worker yet." };
  }
  try {
    const email = await verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), env);
    const allow = (env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    if (allow.length && !allow.includes((email || "").toLowerCase())) return { ok: false, status: 403, message: "Forbidden" };
    return { ok: true, email };
  } catch {
    return { ok: false, status: 403, message: "Forbidden" };
  }
}
