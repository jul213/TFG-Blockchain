#!/bin/bash
# NeuralSOC - EMERGENCY RESUME
echo "[*] SENDING RESUME SIGNAL TO CIRCUIT BREAKER..."
curl -X POST http://localhost:5000/api/admin/circuit-breaker \
     -H "Content-Type: application/json" \
     -d '{"action": "resume"}'
echo ""
echo "[INFO] NeuralSOC SYSTEM OPERATIONS RESUMED."
