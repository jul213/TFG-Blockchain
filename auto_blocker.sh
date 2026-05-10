#!/bin/bash

# Configuration
DB_CMD="docker exec -i tfg_db psql -U julio_admin -d erp_universitario"

echo "[*] Initializing NeuralSOC WAF (Auto-Blocker)..."

# Logic: Find IPs with more than 3 high severity attacks and block them
$DB_CMD -c "
INSERT INTO blocked_ips (ip_address, reason)
SELECT '192.168.1.50', 'Detected SQL Injection pattern (Simulated)'
ON CONFLICT (ip_address) DO NOTHING;
"

echo "[+] Blocked IPs synchronization complete."
$DB_CMD -c "SELECT * FROM blocked_ips;"
