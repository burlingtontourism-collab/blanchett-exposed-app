import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

initializeApp();
const db = getFirestore();
const aemetKey = defineSecret("AEMET_API_KEY");

function tag(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";
}

export const monitorAemetCadiz = onSchedule(
  { schedule: "every 5 minutes", timeZone: "Europe/Madrid", secrets: [aemetKey], region: "europe-west1", timeoutSeconds: 120 },
  async () => {
    const apiUrl = "https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/61";
    const response = await fetch(apiUrl, { headers: { api_key: aemetKey.value() } });
    if (!response.ok) throw new Error(`AEMET API error: ${response.status}`);
    const envelope = await response.json() as { estado?: number; datos?: string; descripcion?: string };
    if (!envelope.datos) {
      logger.info("AEMET returned no CAP data", { descripcion: envelope.descripcion });
      return;
    }
    const capResponse = await fetch(envelope.datos);
    if (!capResponse.ok) throw new Error(`AEMET CAP download error: ${capResponse.status}`);
    const xml = await capResponse.text();
    const alerts = xml.match(/<alert(?:\\s[^>]*)?>[\\s\\S]*?<\/alert>/gi) ?? [];
    for (const alert of alerts) {
      const identifier = tag(alert, "identifier");
      const status = tag(alert, "status");
      const msgType = tag(alert, "msgType");
      if (!identifier || status.toLowerCase() !== "actual" || msgType.toLowerCase() === "cancel") continue;
      const info = alert.match(/<info(?:\\s[^>]*)?>[\\s\\S]*?<\/info>/i)?.[0] ?? alert;
      const event = tag(info, "event") || "Aviso meteorológico";
      const headline = tag(info, "headline") || event;
      const description = tag(info, "description") || "Consulta el aviso oficial de AEMET.";
      const areaDesc = tag(info, "areaDesc");
      const severity = tag(info, "severity");
      const expires = tag(info, "expires");
      const doc = db.collection("sentAemetAlerts").doc(identifier);
      const existing = await doc.get();
      if (existing.exists) continue;
      await getMessaging().send({
        topic: "cadiz-alertas",
        notification: { title: `AEMET · ${headline}`, body: `${areaDesc ? areaDesc + " · " : ""}${description}`.slice(0, 500) },
        data: { source: "AEMET", identifier, event, severity, expires }
      });
      await doc.set({ identifier, event, severity, areaDesc, expires, sentAt: Timestamp.now() });
    }
    logger.info("AEMET CAP check completed", { alertsFound: alerts.length });
  }
);
