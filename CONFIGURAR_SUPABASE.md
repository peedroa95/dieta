# Ativar acesso direto por e-mail no Nutria

O aplicativo usa somente o e-mail informado, sem senha, código ou mensagem de confirmação. O mesmo endereço abre o mesmo espaço no celular e no computador. Outro endereço abre um espaço separado.

**Este modo não verifica identidade. Qualquer pessoa que souber um e-mail poderá abrir, alterar e excluir os registros associados a ele.** A sessão anônima é apenas a conexão técnica com o Supabase; não prova que a pessoa é dona do e-mail. Não há autenticação privada por endereço.

## 1. Criar ou atualizar as tabelas

No seu projeto Supabase, abra **SQL Editor → New query**.

- **Projeto novo, sem tabelas Nutria:** copie todo o conteúdo de [`supabase/primeira_instalacao.sql`](supabase/primeira_instalacao.sql) e clique em **Run**. O arquivo reúne as quatro migrações em uma única transação.
- **Projeto que já executou as três migrações anteriores:** execute somente [`supabase/migrations/202610210002_email_spaces.sql`](supabase/migrations/202610210002_email_spaces.sql). Essa atualização preserva os registros existentes.
- **Projeto parcialmente instalado:** execute apenas as migrações pendentes, na ordem abaixo. Não apague as tabelas nem reaplique migrações já executadas.

1. `202610200001_initial.sql`
2. `202610200002_food_barcodes.sql`
3. `202610210001_account_transfers.sql`
4. `202610210002_email_spaces.sql`

Os arquivos estão no GitHub. Abra o arquivo, clique em **Raw** e copie o conteúdo inteiro. A chave pública não permite aplicar essas alterações pelo aplicativo; execute-as no SQL Editor.

A quarta migração cria `email_spaces` (e-mail e proprietário dos registros) e `email_space_sessions` (sessões dos aparelhos vinculadas ao espaço). Essas tabelas não podem ser listadas diretamente pelo cliente. As funções permitem escolher um espaço informando o endereço, sem comprovar sua posse. A RLS limita cada sessão ao espaço escolhido; não impede alguém de escolher um endereço conhecido.

## 2. Habilitar sessões anônimas

Em **Authentication → Sign In / Providers → Anonymous Sign-Ins**, habilite **Allow anonymous sign-ins** e salve. O nome da opção pode variar conforme a versão do painel.

Não é necessário desativar a confirmação do provedor Email. O novo fluxo não usa `signInWithOtp`, não cadastra o endereço no provedor Email e não envia mensagens. O e-mail é salvo em `public.email_spaces`.

Cada aparelho mantém uma sessão técnica persistente. Ao digitar o mesmo e-mail em outro aparelho, a função do banco vincula a nova sessão ao mesmo proprietário. Sair encerra somente a sessão do aparelho atual. Não remova usuários anônimos do painel nem configure limpeza automática sem antes preservar os registros: eles podem ser proprietários dos dados e as referências existentes usam `auth.users`.

O Supabase pode aplicar limites à criação de sessões anônimas. Se configurar CAPTCHA para essas sessões, a interface também precisará integrar o provedor e enviar o token; não o ative sem esse ajuste.

## 3. Configurar a Vercel

Em **Project → Settings → Environment Variables**, importe o arquivo `.env` preparado ou crie as duas variáveis públicas:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
```

A compilação também aceita `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` como alternativa. Se as variáveis `VITE_` estiverem definidas, elas têm prioridade. `SUPABASE_SECRET_KEY` e `SUPABASE_JWKS_URL` não são utilizados no navegador. Não copie uma chave administrativa para o campo público.

Marque os ambientes em que o app deve funcionar e faça um **Redeploy**, pois as variáveis são lidas na compilação. Nenhuma configuração SMTP ou URL de confirmação é necessária para o acesso direto. Não use a chave `service_role`, `sb_secret_…` ou a senha do banco no aplicativo.

Para desenvolver, mantenha as duas variáveis em `.env.local` ou nas configurações do ambiente e reinicie o Vite. Os arquivos `.env` e `.env.local` são ignorados pelo Git. Sem Supabase configurado, o app continua no modo local e informa que os registros ficam apenas no navegador.

## 4. Acessar e trazer registros antigos

1. Abra `https://dieta-beryl-two.vercel.app/`, informe o e-mail e clique em **Entrar no meu espaço**. Não será enviado e-mail.
2. No celular, acesse o mesmo endereço e informe o mesmo e-mail. Maiúsculas e espaços nas extremidades são normalizados.
3. Outra pessoa pode informar outro e-mail para usar um diário separado, observando a limitação de privacidade descrita acima.
4. Para registros locais, abra **Configurações → Trazer meus registros → Transferir dados locais**, confira o e-mail de destino e confirme. Não há transferência automática.
5. Para dados de outro navegador/endereço, exporte um JSON na versão anterior e use **Importar arquivo JSON** no espaço de destino.

Os dados de contas antigas por link são preservados: ao informar o e-mail, o banco reutiliza o identificador anterior de `auth.users`. Uma sessão antiga já conectada também continua funcionando. Registros anônimos antigos ainda sem endereço podem ser vinculados ao e-mail na mesma sessão. A cópia local não é apagada.

A transferência é uma transação: ou todos os registros válidos são processados, ou nenhum é gravado. Repetir o mesmo lote não duplica os registros. Snapshots nutricionais são preservados; alimentos por EAN, metas, pesos e perfil já existentes na nuvem são mantidos.

Os registros são atualizados ao abrir o app, ao voltar para a janela e a cada 30 segundos enquanto ela estiver visível. Também existe **Atualizar dados** em Configurações. Não é necessário habilitar Realtime.

## 5. Conferir

- Cadastre um alimento no computador e entre com o mesmo e-mail no celular; o alimento deve aparecer.
- Entre com outro e-mail; o alimento do primeiro espaço não deve aparecer.
- Saia e confira que os registros deixam de aparecer na tela.
- Transfira um arquivo duas vezes; a segunda tentativa deve informar que já foi processado.

Os testes automatizados usam sessões e API Supabase simuladas no navegador, além de PostgreSQL via PGlite para validar as migrações, a separação por espaço e as transferências. A ativação real exige executar a migração, habilitar Anonymous Sign-Ins e publicar a versão atualizada.
