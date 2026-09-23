# TERRADAGAROA CRACKERS

Workspace visual em React + TypeScript para transformar URLs autorizadas em pontos de partida de prototipagem. A interface foi criada para a identidade Terradagaroa, com suporte a instalação como PWA e deploy estático na Vercel.

## O que existe nesta versão

- **Basic clone:** coleta a página principal e gera um ZIP real com o HTML encontrado.
- **Avançado clone:** rastreia até 18 páginas e 80 assets internos do mesmo domínio, reescreve links locais e gera um ZIP real.
- Interface responsiva, navegação por âncoras, feedback de estados e preview.
- PWA com `manifest.webmanifest`, service worker e ícone Terradagaroa.
- Zero autenticação, banco de dados, API da Manus ou variáveis de ambiente; o endpoint próprio está em `api/clone.ts`.

> Importante: o crawler é limitado ao mesmo domínio, bloqueia endereços privados, limita páginas/assets/tamanho e só inicia com confirmação de autorização. Sites com login, bloqueio anti-bot ou conteúdo renderizado exclusivamente por JavaScript podem não ser exportados integralmente. Use apenas em sites próprios ou com autorização expressa.

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
