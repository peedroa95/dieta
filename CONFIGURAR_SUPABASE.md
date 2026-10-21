# Ativar contas e sincronização no Nutria

Depois desta configuração, você entra com seu e-mail no celular e no computador e acessa os mesmos registros. Outra pessoa usa o próprio e-mail e tem dados separados. O acesso funciona com link por e-mail, sem senha.

## 1. Criar o projeto

Acesse https://supabase.com/dashboard, crie uma conta e um projeto e aguarde a inicialização. A senha do banco fica somente no Supabase; ela não vai no aplicativo.

## 2. Criar ou atualizar as tabelas

Para um projeto novo, sem tabelas do Nutria, abra **SQL Editor → New query**, cole **todo** o conteúdo de [`supabase/primeira_instalacao.sql`](supabase/primeira_instalacao.sql) e clique em **Run**. Esse arquivo reúne as três migrações em uma única transação.

Para um projeto que já tenha tabelas, use somente as migrações pendentes, nesta ordem:

1. `supabase/migrations/202610200001_initial.sql`
2. `supabase/migrations/202610200002_food_barcodes.sql`
3. `supabase/migrations/202610210001_account_transfers.sql`

Se você já executou os dois primeiros, execute **somente o terceiro**. Não apague tabelas nem reaplique os arquivos anteriores. O terceiro acrescenta a transferência do histórico local sem apagar dados.

Os arquivos estão no repositório do GitHub. Abra o arquivo, clique em **Raw** e copie o conteúdo inteiro.

## 3. Habilitar acesso por e-mail

Em **Authentication → Sign In / Providers**, mantenha o provedor **Email** habilitado e permita novos cadastros. O aplicativo usa `signInWithOtp` com criação de conta permitida e o link de acesso por e-mail. Nenhuma senha é solicitada.

Não é necessário habilitar **Anonymous Sign-Ins** para novas contas. Se existe uma sessão anônima da versão anterior, o aplicativo tenta vinculá-la ao e-mail informado para preservar seu identificador e seus registros. Nesse caso, confirme o e-mail pelo link recebido antes de trocar de navegador. Se esse e-mail já possui outra conta, não apague a sessão antiga; use outro e-mail para vinculá-la e conservar os dados.

## 4. Configurar o endereço da Vercel

Em **Authentication → URL Configuration**:

- **Site URL:** o endereço publicado do app, `https://dieta-beryl-two.vercel.app`.
- **Redirect URLs:** acrescente esse mesmo endereço com `/` no final, `https://dieta-beryl-two.vercel.app/`.

Se você usar domínio próprio ou um endereço de prévia diferente, inclua a origem correspondente. O link retorna à origem em que foi solicitado. O aplicativo usa o fluxo implícito do Supabase, permitindo abrir o link em outro dispositivo. Mantenha o modelo de e-mail **Magic Link** com o link padrão `{{ .ConfirmationURL }}`. Não substitua por um fluxo PKCE ou somente por um código numérico sem ajustar o aplicativo.

## 5. Configurar a entrega dos e-mails

O envio padrão do Supabase tem limites e pode aceitar apenas endereços autorizados da equipe do projeto. Para você e sua namorada receberem links em seus e-mails, configure um provedor SMTP em **Authentication → Email / SMTP Settings**, conforme o painel e a documentação do Supabase.

As credenciais SMTP devem ser cadastradas somente nas configurações seguras do Supabase. Não as coloque no código, no GitHub ou em variáveis `VITE_*`. O aplicativo não envia e-mails diretamente; ele solicita os links ao Supabase.

## 6. Configurar as variáveis na Vercel

No Supabase, em **Project Settings → API / API Keys**, copie a URL do projeto e a chave **publishable** (`sb_publishable_…`) ou a chave pública legada **anon**.

Na Vercel, abra **Project → Settings → Environment Variables** e crie:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
```

A integração da Vercel também pode fornecer `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: a compilação aceita esses dois nomes públicos como alternativa. Se houver variáveis `VITE_` definidas, elas têm prioridade. `SUPABASE_SECRET_KEY` e `SUPABASE_JWKS_URL` não são usados no navegador. Não copie uma chave secreta para o campo de chave pública.

Marque os ambientes em que o app deve funcionar e faça um **Redeploy**, pois o Vite lê essas variáveis durante a compilação. Não use a chave `service_role`, `sb_secret_…` nem a senha do banco. A chave pública não dá acesso aos dados de outras contas: as políticas RLS exigem a sessão do proprietário.

Para desenvolver neste ambiente, preencha as mesmas variáveis em `.env.local` ou nas configurações do ambiente e reinicie o Vite. Sem essas variáveis, o aplicativo preserva o modo local e informa que os registros ficam somente no navegador.

## 7. Entrar e trazer os registros antigos

1. Abra o app publicado, informe seu e-mail e clique em **Enviar link de acesso**.
2. Abra o link recebido. Confira também a pasta de spam.
3. No navegador em que você já cadastrava alimentos, vá a **Configurações → Trazer meus registros → Transferir dados locais**.
4. Confira o **e-mail de destino** e confirme. Não transfira os seus registros enquanto estiver na conta de outra pessoa.
5. No celular, abra o mesmo endereço e entre com o **mesmo e-mail**. Os registros da conta serão lidos da nuvem.
6. Sua namorada pode entrar com outro e-mail e começar um diário separado.

Os registros são atualizados ao abrir o app, ao voltar para a janela e a cada 30 segundos enquanto ela estiver visível. Também existe **Atualizar dados** em Configurações. Não é necessário habilitar publicação de tabelas para Realtime.

### Se os dados antigos estiverem em outro endereço

Dados do navegador pertencem à origem onde foram cadastrados. Se você usava outro endereço, abra a versão antiga nele e use **Configurações → Exportar meus registros**. Na nova versão, entre em sua conta e escolha **Importar arquivo JSON**. A cópia original não é apagada.

A transferência é uma transação: ou todos os registros válidos são processados, ou nenhum é gravado. É possível tentar novamente sem duplicar o mesmo lote. O histórico nutricional é preservado mesmo quando o cadastro atual mudou ou o alimento foi excluído. Alimentos com EAN já existente são reutilizados; metas e pesos da mesma data já presentes na nuvem não são substituídos. Um perfil preenchido na nuvem também é mantido.

### Verificação final

- Entre com o mesmo e-mail em dois navegadores: cadastre um alimento em um e confirme que ele aparece no outro após atualizar.
- Entre com outro e-mail: o alimento da primeira conta não deve aparecer.
- Saia da conta e confira que os registros deixam de aparecer.
- Transfira um arquivo duas vezes: a segunda tentativa deve informar que já foi processado, sem duplicação.

Os testes automatizados usam identidades, API de e-mail e armazenamento simulados, além do PostgreSQL via PGlite para validar RLS e transferências. A entrega de e-mails e a conexão com o seu projeto precisam ser verificadas depois da configuração acima.
