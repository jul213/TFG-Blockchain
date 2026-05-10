import csv
import os
import datetime

# Configuration
DB_COMMAND = "docker exec tfg_db psql -U julio_admin -d erp_universitario -c \"COPY (SELECT * FROM audit_events ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;\""
REPORT_FILE = "TFG_Forensic_Report_{}.csv"

def generate_report():
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = REPORT_FILE.format(timestamp)
    
    print(f"[*] Generating Forensic Evidence Report...")
    os.system(f"{DB_COMMAND} > {filename}")
    
    if os.path.exists(filename):
        print(f"[+] Report generated successfully: {filename}")
        print(f"[*] Total events captured: {sum(1 for line in open(filename)) - 1}")
    else:
        print(f"[-] Failed to generate report.")

if __name__ == "__main__":
    generate_report()
