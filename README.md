# signal-backend

Backend serverless per SIGNAL — gira su Vercel gratuitamente.

## Deploy su Vercel (5 minuti)

### 1. Crea repo GitHub
```bash
git init
git add .
git commit -m "init backend"
git remote add origin https://github.com/carlo120686/signal-backend.git
git push -u origin main
```

### 2. Deploy su Vercel
1. Vai su [vercel.com](https://vercel.com) e accedi con GitHub
2. Clicca **"Add New Project"**
3. Importa il repo `signal-backend`
4. Clicca **Deploy** — nessuna configurazione necessaria

### 3. Ottieni l'URL del backend
Dopo il deploy Vercel ti dà un URL tipo:
```
https://signal-backend-xyz.vercel.app
```

### 4. Aggiorna il frontend
Nel file `signal-app/src/services/market.js` sostituisci:
```js
const BACKEND_URL = 'https://signal-backend-xyz.vercel.app'
```
con il tuo URL Vercel reale.

## Endpoints

- `GET /api/quote?symbol=VWCE.MI` — dati singolo asset
- `GET /api/batch?symbols=VWCE.MI,CSPX.MI,GC=F` — dati multipli (max 20)

## Costo
**Gratuito** — Vercel Free tier include 100GB bandwidth e funzioni serverless illimitate per uso personale.
