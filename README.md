# Marcaje Automático - Portal RRHH

Automatización de marcaje virtual para el portal de Recursos Humanos usando Playwright.

## Requisitos

- [Node.js](https://nodejs.org/) v18+

## Instalación

### Windows
Ejecuta `setup.bat` o manualmente:

```bash
npm install
npx playwright install chromium
```

### Linux / macOS
```bash
npm install
npx playwright install chromium
```

## Configuración

1. Copia el archivo de ejemplo:
   ```bash
   cp config.example.js config.js
   ```
2. Edita `config.js` con tus credenciales y usuarios.

> **Nota:** `config.js` está en `.gitignore` para proteger tus credenciales.

## Uso

### Windows
Ejecuta `marcaje.bat` para marcar entrada y salida.

### Línea de comandos
```bash
node index.js entrada   # Marca entrada para todos
node index.js salida    # Marca salida para todos
node index.js todo      # Marca entrada y salida
node index.js test      # Verifica conexión sin marcar
```

O con npm scripts:
```bash
npm run entrada
npm run salida
```
