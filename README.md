# TERRADAGAROA CRACKERS

Workspace em React + TypeScript para exportar sites autorizados em ZIP, com login por ID Discord, painel administrativo e vínculo de dispositivo.

## Recursos

- Login normal usando ID Discord previamente cadastrado.
- Login admin na mesma tela usando `devterradagaroa` + chave administrativa.
- Painel para criar IDs permanentes ou com expiração.
- Reset e exclusão de acessos.
- Primeiro dispositivo vinculado por cookie HTTP-only e hash no arquivo JSON.
- Basic clone e Avançado clone com páginas, assets, HTML, scripts, sitemaps e subdomínios autorizados.
- PWA, sem banco, sem API da Manus e sem autenticação externa.

## Configuração admin

Defina na Vercel:

```text
ADMIN_SECRET=uma-chave-forte
SESSION_SECRET=outro-segredo-forte
GITHUB_TOKEN=token_com_permissao_de_leitura_e_escrita_no_repositorio
GITHUB_REPO=diogodmrlk-crypto/terradagaroa-crackers
```

Se nenhuma variável for definida, o modo de demonstração usa `devterradagaroa-admin` como chave admin. Não use esse fallback em produção.

## Armazenamento JSON

Os acessos ficam em `data/access.json`. Localmente, o arquivo é atualizado normalmente. Na Vercel, quando `GITHUB_TOKEN` está configurado, o endpoint lê e grava o JSON pela GitHub Contents API, cria um commit automático e o próximo login sempre encontra o ID recém-criado. Sem `GITHUB_TOKEN`, a aplicação usa apenas o arquivo local/memória da função e os cadastros não são confiáveis após reinicializações.

## Rodar e publicar

```bash
npm install
npm run dev
npm run check
npm run build
npm run lint
```

Na Vercel, use o preset **Vite**, comando `npm run build`, diretório `dist` e configure as duas variáveis de ambiente acima. O endpoint de autenticação está em `api/auth.ts`; o crawler está em `api/clone.ts`.

Use somente conteúdo, IDs e propriedades para os quais você tenha autorização.
