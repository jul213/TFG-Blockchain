#!/bin/bash
# NeuralSOC - EMERGENCY STOP
echo "[!!!] SENDING EMERGENCY STOP SIGNAL TO CIRCUIT BREAKER..."
curl -X POST http://localhost:5000/api/admin/circuit-breaker \
     -H "Content-Type: application/json" \
     -d '{"action": "pause"}'
echo ""
echo "[ALERT] NeuralSOC CIRCUIT BREAKER IS NOW ACTIVE."
