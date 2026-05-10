# HTTPS local real con mkcert (localhost + IP LAN)

## 1) Instalar mkcert

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y libnss3-tools
brew install mkcert || true
mkcert -install
```

Si no usas `brew`, instala binario oficial de mkcert y ejecuta `mkcert -install`.

## 2) Obtener tu IP LAN actual

```bash
hostname -I
```

Ejemplo: `192.168.1.35`

## 3) Generar certificado SAN

Desde la raíz del proyecto:

```bash
mkdir -p nginx/certs
mkcert -cert-file nginx/certs/server.crt -key-file nginx/certs/server.key localhost 127.0.0.1 ::1 192.168.1.35
```

Sustituye `192.168.1.35` por tu IP real.

## 4) Levantar stack

```bash
docker compose up -d
```

## 5) Validación

- `https://localhost`
- `https://127.0.0.1`
- `https://<TU_IP_LAN>`

El certificado debe aparecer como confiable en navegador.
