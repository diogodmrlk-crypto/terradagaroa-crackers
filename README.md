# TERRADAGAROA CRACKERS

Workspace em React + TypeScript para exportar sites autorizados em ZIP, com login por ID Discord, painel administrativo e vínculo de dispositivo.

## Recursos

- Login normal usando ID Discord previamente cadastrado.
- Login admin na mesma tela usando `devterradagaroa` + chave administrativa.
- Painel para criar IDs permanentes ou com expiração.
- Reset e exclusão de acessos.
- Primeiro dispositivo vinculado por cookie HTTP-only e hash persistido no Supabase.
- Basic clone e Avançado clone com páginas, assets, HTML, scripts, sitemaps e subdomínios autorizados.
- PWA, sem API da Manus e sem autenticação externa.

## Configuração admin

Defina na Vercel:

```text
ADMIN_SECRET=uma-chave-forte
SESSION_SECRET=outro-segredo-forte
SUPABASE_URL=https://zrjfzxqkpjhsisbjvpbx.supabase.co
```

Se nenhuma variável for definida, o modo de demonstração usa `devterradagaroa-admin` como chave admin. Não use esse fallback em produção.

## Armazenamento Supabase

Os acessos ficam em `public.terradagaroa_accesses` no projeto Supabase `zrjfzxqkpjhsisbjvpbx`. A tabela foi criada com RLS ativado. A Edge Function `terradagaroa-auth` consulta e altera a tabela dentro do Supabase; a Vercel não precisa de `service_role` nem `sb_secret`.

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
