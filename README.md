# TERRADAGAROA CRACKERS

Workspace visual em React + TypeScript para transformar URLs autorizadas em pontos de partida de prototipagem. A interface foi criada para a identidade Terradagaroa, com suporte a instalação como PWA e deploy estático na Vercel.

## O que existe nesta versão

- **Basic clone:** fluxo de análise de uma página e download de um HTML starter local.
- **Avançado clone:** modo visual para mapear rotas, estrutura e assets de uma propriedade administrada pelo usuário.
- Interface responsiva, navegação por âncoras, feedback de estados e preview.
- PWA com `manifest.webmanifest`, service worker e ícone Terradagaroa.
- Zero autenticação, banco de dados, API da Manus ou variáveis de ambiente.

> Importante: esta versão é deliberadamente frontend-only. Um clone completo de páginas, imagens, sons e arquivos exige um backend/proxy controlado pelo proprietário do conteúdo, além de tratamento de CORS, robots.txt, limites de tráfego e direitos autorais. Use apenas em sites próprios ou com autorização expressa.

## Rodar localmente

```bash
npm install
npm run dev
```

Verificações:

```bash
npm run check
npm run build
npm run lint
```

## Publicar na Vercel

1. Importe o repositório na Vercel.
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Não é necessário configurar environment variables.

Também é possível publicar com a CLI da Vercel:

```bash
npx vercel --prod
```

Desenvolvido pela **Terra da Garoa no iOS**.
