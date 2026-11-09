/**
 * CADIZ ALERTA — monitor AEMET CAP bulletins and send Firebase push alerts.
 * Store AEMET_API_KEY and FIREBASE_SERVICE_ACCOUNT_JSON in Script Properties.
 * Run installTrigger() once to schedule checks every five minutes.
 */

function installTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "monitorAemetCadiz") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("monitorAemetCadiz").timeBased().everyMinutes(5).create();
  Logger.log("Cádiz Alerta installed: checks every five minutes.");
}

function monitorAemetCadiz() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log("A previous check is still running; skipping this execution.");
    return;
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const aemetKey = props.getProperty("AEMET_API_KEY");
    const serviceJson = props.getProperty("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!aemetKey || !serviceJson) {
      throw new Error("Missing AEMET_API_KEY or FIREBASE_SERVICE_ACCOUNT_JSON in Script Properties.");
    }

    const service = JSON.parse(serviceJson);
    const oauthToken = getGoogleAccessToken_(service);
    const response = UrlFetchApp.fetch(
      "https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/61",
      { method: "get", headers: { api_key: aemetKey }, muteHttpExceptions: true }
    );
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      throw new Error("AEMET API returned HTTP " + response.getResponseCode() + ": " + response.getContentText());
    }

    const envelope = JSON.parse(response.getContentText());
    if (!envelope.datos) {
      Logger.log("AEMET returned no CAP data: " + (envelope.descripcion || "no description"));
      return;
    }

    const capResponse = UrlFetchApp.fetch(envelope.datos, { muteHttpExceptions: true });
    if (capResponse.getResponseCode() < 200 || capResponse.getResponseCode() >= 300) {
      throw new Error("AEMET CAP download returned HTTP " + capResponse.getResponseCode());
    }

    const xml = capResponse.getContentText();
    const alerts = xml.match(/<alert(?:\s[^>]*)?>[\s\S]*?<\/alert>/gi) || [];
    let sentCount = 0;

    alerts.forEach(function (alert) {
      const identifier = xmlTag_(alert, "identifier");
      const status = xmlTag_(alert, "status").toLowerCase();
      const messageType = xmlTag_(alert, "msgType").toLowerCase();
      const infoMatch = alert.match(/<info(?:\s[^>]*)?>[\s\S]*?<\/info>/i);
      const info = infoMatch ? infoMatch[0] : alert;
      const area = xmlTag_(info, "areaDesc");

      if (!identifier || status !== "actual" || messageType === "cancel") return;
      if (!/(c[aá]diz|gaditan|estrecho|campo de gibraltar)/i.test(area)) return;

      const sentKey = "SENT_" + Utilities.base64EncodeWebSafe(identifier).replace(/=+$/g, "");
      if (props.getProperty(sentKey)) {
        Logger.log("Already sent: " + identifier);
        return;
      }

      const eventName = xmlTag_(info, "event") || "Aviso meteorológico";
      const headline = xmlTag_(info, "headline") || eventName;
      const description = xmlTag_(info, "description") || "Consulta el aviso oficial de AEMET.";
      const severity = xmlTag_(info, "severity");
      const expires = xmlTag_(info, "expires");

      const message = {
        message: {
          topic: "cadiz-alertas",
          notification: {
            title: ("AEMET · " + headline).substring(0, 100),
            body: (area + " · " + description).substring(0, 500)
          },
          data: {
            source: "AEMET",
            identifier: identifier,
            event: eventName,
            severity: severity,
            expires: expires
          },
          android: {
            notification: {
              channel_id: "cadiz_alertas",
              tag: identifier
            }
          }
        }
      };

      const fcmResponse = UrlFetchApp.fetch(
        "https://fcm.googleapis.com/v1/projects/" + service.project_id + "/messages:send",
        {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + oauthToken },
          payload: JSON.stringify(message),
          muteHttpExceptions: true
        }
      );
      if (fcmResponse.getResponseCode() < 200 || fcmResponse.getResponseCode() >= 300) {
        throw new Error("FCM send failed HTTP " + fcmResponse.getResponseCode() + ": " + fcmResponse.getContentText());
      }

      props.setProperty(sentKey, new Date().toISOString());
      sentCount++;
      Logger.log("Sent AEMET alert: " + identifier + " / " + eventName + " / " + area);
    });

    Logger.log("AEMET check completed. CAP bulletins: " + alerts.length + "; new alerts sent: " + sentCount);
  } finally {
    lock.releaseLock();
  }
}

function getGoogleAccessToken_(service) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: service.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: service.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsignedJwt = base64UrlJson_(header) + "." + base64UrlJson_(claims);
  const signature = Utilities.computeRsaSha256Signature(unsignedJwt, service.private_key);
  const assertion = unsignedJwt + "." + Utilities.base64EncodeWebSafe(signature).replace(/=+$/g, "");

  const tokenResponse = UrlFetchApp.fetch(claims.aud, {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertion
    },
    muteHttpExceptions: true
  });

  if (tokenResponse.getResponseCode() < 200 || tokenResponse.getResponseCode() >= 300) {
    throw new Error("Google OAuth failed HTTP " + tokenResponse.getResponseCode() + ": " + tokenResponse.getContentText());
  }
  const tokenData = JSON.parse(tokenResponse.getContentText());
  if (!tokenData.access_token) throw new Error("Google OAuth response did not include an access token.");
  return tokenData.access_token;
}

function base64UrlJson_(value) {
  return Utilities.base64EncodeWebSafe(JSON.stringify(value)).replace(/=+$/g, "");
}

function xmlTag_(source, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp("<" + escaped + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + escaped + ">", "i"));
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
