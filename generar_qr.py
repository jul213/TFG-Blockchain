import subprocess
import qrcode
import time
import os

def obtener_url_web():
    print("Buscando URL del túnel de Cloudflare para la Web...")
    # Buscamos la URL en los logs del contenedor de la web
    cmd = "docker logs tfg_cloudflare_tunnel_web 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | tail -n 1"
    
    url = ""
    for _ in range(10): # Reintenta durante 20 segundos
        url = subprocess.getoutput(cmd).strip()
        if url:
            break
        time.sleep(2)
    return url

url = obtener_url_web()

if url:
    print(f"¡URL detectada!: {url}")
    # Generar el QR
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    # Guardar en la carpeta del frontend
    img.save("./frontend/qr_acceso.png")
    print("✅ Código QR generado con éxito en ./frontend/qr_acceso.png")
else:
    print("❌ Error: No se pudo capturar la URL del túnel. ¿Está el contenedor corriendo?")
