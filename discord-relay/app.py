import os
from datetime import datetime, timezone

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "").strip()


def _color_for_status(status: str) -> int:
    return 0x57F287 if status == "resolved" else 0xED4245


def _build_embed(alert: dict) -> dict:
    labels = alert.get("labels", {})
    annotations = alert.get("annotations", {})
    status = alert.get("status", "firing")
    severity = labels.get("severity", "unknown").upper()
    name = labels.get("alertname", "TFG Alert")
    service = labels.get("service", labels.get("job", "n/a"))
    mitre = labels.get("mitre_tactic", "n/a")
    summary = annotations.get("summary", "Alert triggered")
    description = annotations.get("description", "No description provided")
    runbook = annotations.get("runbook_url", "")
    dashboard = annotations.get("dashboard_url", "")
    loki = annotations.get("loki_url", "")
    blast_radius = annotations.get("blast_radius", service)
    started_at = alert.get("startsAt", "")
    ended_at = alert.get("endsAt", "")

    fields = [
        {"name": "Severity", "value": severity, "inline": True},
        {"name": "Status", "value": status.upper(), "inline": True},
        {"name": "Service", "value": service, "inline": True},
        {"name": "MITRE", "value": mitre, "inline": True},
        {"name": "Blast radius", "value": blast_radius[:1024], "inline": False},
        {"name": "Summary", "value": summary[:1024], "inline": False},
        {"name": "Description", "value": description[:1024], "inline": False},
    ]

    if runbook:
        fields.append({"name": "Runbook", "value": runbook[:1024], "inline": False})
    if dashboard:
        fields.append({"name": "Dashboard", "value": dashboard[:1024], "inline": False})
    if loki:
        fields.append({"name": "Loki", "value": loki[:1024], "inline": False})
    if started_at:
        fields.append({"name": "Started", "value": started_at, "inline": False})
    if ended_at and status == "resolved":
        fields.append({"name": "Ended", "value": ended_at, "inline": False})

    return {
        "title": f"{name}",
        "color": _color_for_status(status),
        "fields": fields[:25],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "TFG SOC Alertmanager Relay"},
    }


@app.post("/alert")
def alert():
    if not DISCORD_WEBHOOK_URL:
        return jsonify({"ok": False, "error": "DISCORD_WEBHOOK_URL not configured"}), 500

    payload = request.get_json(silent=True) or {}
    alerts = payload.get("alerts", [])
    if not alerts:
        return jsonify({"ok": True, "message": "No alerts"}), 200

    embeds = [_build_embed(a) for a in alerts[:10]]
    discord_payload = {
        "username": "TFG-SOC",
        "content": f"Received {len(alerts)} alert(s) from Alertmanager",
        "embeds": embeds,
    }

    resp = requests.post(DISCORD_WEBHOOK_URL, json=discord_payload, timeout=10)
    if resp.status_code >= 300:
        return jsonify({"ok": False, "status_code": resp.status_code, "body": resp.text[:500]}), 502

    return jsonify({"ok": True}), 200


@app.get("/health")
def health():
    return jsonify({"status": "ok", "configured": bool(DISCORD_WEBHOOK_URL)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
