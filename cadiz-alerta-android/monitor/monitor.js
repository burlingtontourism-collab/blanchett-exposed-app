import { GoogleAuth } from "google-auth-library";

const AEMET_KEY = process.env.AEMET_API_KEY;
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const PROJECT_ID = "cadiz-alerta";
if (!AEMET_KEY || !SERVICE_ACCOUNT) throw new Error("Missing AEMET_API_KEY or FIREBASE_SERVICE_ACCOUNT secret");

const account = JSON.parse(SERVICE_ACCOUNT);
const auth = new GoogleAuth({
  credentials: account,
  scopes: [
    "https://www.googleapis.com/auth/firebase.messaging",
    "https://www.googleapis.com/auth/datastore"
  ]
});
const client = await auth.getClient();
const access = await client.getAccessToken();
if (!access.token) throw new Error("Could not obtain Google OAuth access token");
const headers = { authorization: `Bearer ${access.token}`, "content-type": "application/json" };

const api = await fetch("https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/61", {
  headers: { api_key: AEMET_KEY }
});
if (!api.ok) throw new Error(`AEMET request failed: ${api.status}`);
const envelope = await api.json();
if (!envelope.datos) {
  console.log("AEMET has no current CAP feed", envelope.descripcion ?? "");
  process.exit(0);
}
const feed = await fetch(envelope.datos);
if (!feed.ok) throw new Error(`AEMET CAP feed failed: ${feed.status}`);
const xml = await feed.text();

function textOf(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : "";
}

const alerts = xml.match(/<alert(?:\\s[^>]*)?>[\\s\\S]*?<\\/alert>/gi) ?? [];
for (const alert of alerts) {
  const identifier = textOf(alert, "identifier");
  const status = textOf(alert, "status").toLowerCase();
  const msgType = textOf(alert, "msgType").toLowerCase();
  const info = alert.match(/<info(?:\\s[^>]*)?>[\\s\\S]*?<\\/info>/i)?.[0] ?? alert;
  const area = textOf(info, "areaDesc");
  if (!identifier || status !== "actual" || msgType === "cancel" || !/(c[aá]diz|gaditan|estrecho)/i.test(area)) continue;

  const docId = Buffer.from(identifier).toString("base64url");
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/sentAemetAlerts/${docId}`;
  const prior = await fetch(docUrl, { headers });
  if (prior.ok) {
    console.log(`Already sent: ${identifier}`);
    continue;
  }
  if (prior.status !== 404) throw new Error(`Firestore lookup failed (${prior.status}): ${await prior.text()}`);

  const event = textOf(info, "event") || "Aviso meteorológico";
  const headline = textOf(info, "headline") || event;
  const description = textOf(info, "description") || "Consulta el aviso oficial de AEMET.";
  const severity = textOf(info, "severity");
  const expires = textOf(info, "expires");
  const message = {
    message: {
      topic: "cadiz-alertas",
      notification: {
        title: `AEMET · ${headline}`.slice(0, 100),
        body: `${area} · ${description}`.slice(0, 500)
      },
      data: { source: "AEMET", identifier, event, severity, expires },
      android: { notification: { channel_id: "cadiz_alertas", tag: identifier } }
    }
  };
  const sent = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
    method: "POST", headers, body: JSON.stringify(message)
  });
  if (!sent.ok) throw new Error(`FCM send failed (${sent.status}): ${await sent.text()}`);

  const saved = await fetch(docUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields: {
      identifier: { stringValue: identifier },
      event: { stringValue: event },
      severity: { stringValue: severity },
      area: { stringValue: area },
      expires: { stringValue: expires },
      sentAt: { timestampValue: new Date().toISOString() }
    }})
  });
  if (!saved.ok) throw new Error(`Firestore save failed (${saved.status}): ${await saved.text()}`);
  console.log(`Sent ${identifier} · ${event} · ${area}`);
}
console.log(`Finished: inspected ${alerts.length} CAP bulletins`);
