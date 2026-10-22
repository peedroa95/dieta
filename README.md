# Nutria

Aplicativo de alimentação em português brasileiro, com React, TypeScript, Vite e Supabase. **Espaços por e-mail, sem senha nem envio de confirmação, com os mesmos registros no celular e no computador.** Permite cadastrar alimentos manualmente ou pelo número EAN/código de barras, registrar refeições e acompanhar nutrientes, água, metas e peso.

## Executar

Requer Node.js 22 ou superior e npm.

```bash
cd /workspace/dieta
npm ci --cache /workspace/.cache/npm
npm run dev
```

O servidor de desenvolvimento usa a porta 5173. `npm run build` gera `dist` para hospedagem estática com HTTPS; `npm run preview` serve a compilação para conferência local.

## Aplicativo Android

O mesmo sistema pode ser instalado no Android como APK, integrado ao Supabase do site. Consulte [ANDROID.md](ANDROID.md) para instalar, compilar e entender os recursos nativos. O comando `npm run android:apk` gera o arquivo instalável com a configuração pública de `.env.local`.

## Contas e sincronização

Siga o passo a passo em [CONFIGURAR_SUPABASE.md](CONFIGURAR_SUPABASE.md) para criar o projeto, executar o SQL único de primeira instalação (ou as migrações pendentes, incluindo a de acesso direto), habilitar Anonymous Sign-Ins e definir as duas variáveis públicas na Vercel.

A compilação aceita `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` ou os nomes públicos `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` fornecidos pela Vercel. Somente esses dois valores públicos são repassados ao cliente; chaves administrativas não são usadas.

Com o Supabase configurado, basta informar um e-mail e clicar em **Entrar no meu espaço**. Não há senha, OTP nem envio de mensagem. Uma sessão anônima persistente é vinculada no banco ao espaço desse endereço; o mesmo e-mail em outro aparelho resolve o mesmo proprietário. Sair encerra somente a sessão do aparelho atual. Nenhuma credencial administrativa vai para o navegador.

**Esse modo não verifica identidade: quem souber o endereço poderá ler, alterar e excluir seus registros.** A RLS separa os espaços escolhidos, mas não comprova a posse do e-mail. As tabelas de vínculo não são listáveis pelo cliente; as funções `enter_email_space` e `get_email_space` resolvem o espaço no banco.

Os dados são lidos na abertura, ao voltar para a janela e a cada 30 segundos enquanto o app estiver visível. Configurações também oferece **Atualizar dados**. Respostas antigas de atualização não substituem o resultado de uma gravação recente. Uma falha de leitura preserva a tela atual e permite tentar novamente.

### Preservar os dados que já estão no navegador

Em uma conta conectada, use **Configurações → Trazer meus registros → Transferir dados locais**, confira o e-mail e confirme. Outra opção é **Importar arquivo JSON**, para arquivos exportados pelo app em outro navegador/endereço.

A transferência usa a migração `202610210001_account_transfers.sql`: é atômica e idempotente, remapeia identificadores para a conta conectada e preserva snapshots históricos. Dados já existentes de alimentos por EAN, metas/peso por data e perfil preenchido não são sobrescritos. A cópia local permanece intacta. O mesmo lote não pode ser transferido novamente para outra conta.

Sem as variáveis do Supabase, o modo local continua acessível com um aviso de que não há sincronização. A chave interna `nutria-demo-v1` foi preservada para compatibilidade. **Exportar meus registros** baixa uma cópia JSON; **Apagar dados locais** exige confirmação. Não há dados fictícios pré-carregados.

A migração `202610210002_email_spaces.sql` preserva contas antigas por link e vincula novas sessões ao mesmo proprietário dos registros. Sessões anônimas antigas sem e-mail também podem ser vinculadas na primeira entrada. Não remova usuários anônimos sem preservar os dados: eles podem ser proprietários dos registros. A identificação do proprietário é feita por `nutria_user_id()`; os RPCs de inicialização, receitas e transferências usam essa mesma identidade, independentemente do aparelho.

## Cadastro por EAN / código de barras

1. Abra **Meus alimentos → Código de barras** (o mesmo campo também aparece em **Novo alimento** e na edição).
2. Digite ou cole o código impresso no rótulo. Leitores que digitam o código pelo teclado também podem usar esse campo; Enter inicia a consulta.
3. Clique em **Buscar produto**. O aplicativo consulta a API pública do **Open Food Facts**.
4. Confira o produto, os nutrientes e a referência do rótulo. Escolha **100 g** ou **100 ml**; o aplicativo não presume densidade nem converte ml em g.
5. Clique em **Usar dados no cadastro**, complete os campos ausentes e confira a embalagem antes de **Salvar alimento**.

O produto só é salvo no seu armazenamento após a confirmação. A consulta não adiciona o produto automaticamente ao diário. Depois de cadastrado, ele fica disponível para registrar qualquer quantidade, como os outros alimentos.

- São aceitos EAN-8, UPC-A (12 dígitos), EAN-13 e GTIN-14, com verificação do dígito final. Zeros à esquerda são preservados.
- O código é armazenado como texto e pode ser usado na busca da biblioteca. A mesma identidade não pode cadastrar duas vezes o mesmo código, inclusive UPC e EAN equivalentes com zeros à esquerda. A duplicação de um alimento limpa o EAN da cópia.
- Produto não encontrado, erro de rede ou limite da API não bloqueiam o cadastro manual: mantenha o código e informe os valores do rótulo.
- A fonte e o link do produto são preservados no cadastro. A interface atribui os dados ao Open Food Facts (ODbL).
- Só são importados valores numéricos não negativos informados pela fonte. Nutrientes essenciais ausentes permanecem em branco e precisam ser preenchidos antes de salvar. Nutrientes opcionais ausentes são identificados em `unknown_nutrients`; a interface não os apresenta como valores conhecidos. Internamente, esses opcionais não informados não acrescentam valor aos totais.
- Os campos `_100g` da API representam a referência normalizada de 100 g/100 ml. A unidade exige confirmação no rótulo. Dados por porção não são interpretados como dados por 100 g. Sódio é convertido de gramas na fonte para miligramas no aplicativo; energia em kJ explicitamente identificada pode ser convertida para kcal.
- Colesterol não é importado automaticamente; pode ser preenchido manualmente em mg, evitando pressupor a unidade da fonte.

A consulta precisa de acesso HTTPS a **world.openfoodfacts.org** e não exige chave de API. A disponibilidade e a completude dos produtos dependem da base externa. Não é feita leitura pela câmera nesta versão.

## Funcionalidades

- **Início:** resumo diário de calorias/macros, metas, água, peso e refeições; navegação entre datas.
- **Meus alimentos:** cadastro manual ou por EAN, edição, duplicação, exclusão com confirmação, favoritos, pesquisa sem distinção de caixa/acentos e filtro por categoria.
- **Diário:** café, almoço, lanche e jantar; outras refeições personalizadas; prévia nutricional, quantidades editáveis, troca de refeição, duplicação e exclusão.
- **Refeições salvas:** combinações com quantidades ajustáveis e recálculo a partir dos alimentos atuais.
- **Metas:** valores manuais com vigência e estimativas por Mifflin-St Jeor, mediante aceite explícito. As metas iniciais são referências editáveis, não prescrições individuais.
- **Peso e relatórios:** registros com observações, gráficos, filtros de período, comparação com metas e médias diárias. Dias sem registro contam como zero nas médias, explicado na interface.
- **Perfil/configurações:** informações pessoais, fuso horário e exportação dos registros.

## Precisão e histórico

Os cálculos em `src/domain.ts` usam `decimal.js`: `(quantidade / referência) × nutriente`. O arredondamento ocorre na apresentação. Não se convertem mililitros em gramas. Alimentos por porção aceitam gramas somente quando o peso de uma porção foi informado.

Cada registro preserva um snapshot nutricional. Alterar ou excluir o cadastro, incluindo dados importados por EAN, não modifica o consumo passado. Editar a quantidade usa o snapshot original; duplicar cria um consumo com os valores atuais. No Supabase, o gatilho calcula com `NUMERIC` e impede substituir o histórico com valores enviados pelo navegador.

Datas alimentares são `date`; o fuso do perfil define “hoje”. Timestamps de criação são `timestamptz`. Metas mantêm a vigência por data.

## Testes

```bash
npm test
npm run build
npm run test:e2e
```

- **Vitest:** cálculos, datas, histórico, metas, EAN/GTIN, mapeamento nutricional, acesso direto por e-mail e validação de arquivos de transferência.
- **PostgreSQL via PGlite:** migrações reais, RLS entre duas identidades, snapshots, EAN, unicidade e transferências atômicas/idempotentes. A camada `auth` é simulada somente nos testes.
- **Playwright:** fluxos locais em desktop/celular e fluxos de contas com API Supabase simulada: acesso somente por e-mail, mesmo espaço em dois dispositivos, espaços separados, logout, transferência, migração pendente, sessões anônimas desabilitadas e erros de conexão. Inclui os cenários de EAN, nutrientes ausentes e cadastro manual alternativo. As respostas do Open Food Facts são simuladas de forma determinística nos testes; nenhum produto fictício é incluído no aplicativo real.

Os testes de navegador iniciam servidores isolados: **5175** com Supabase vazio para os fluxos locais e **5176** com uma URL de teste interceptada para contas. Nenhum teste de navegador usa as credenciais do seu projeto nem modifica registros remotos. Eles usam o Chromium do sistema quando disponível. Em outras máquinas, execute `npx playwright install chromium` ou defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Após reinstalar `node_modules` com um Vite em execução, reinicie o processo para evitar o cache antigo de dependências (`504 Outdated Optimize Dep`).

**Validação externa:** o Supabase respondeu às consultas de configuração. A ativação do acesso direto precisa da quarta migração e de Anonymous Sign-Ins habilitado; essas mudanças são feitas no painel, conforme o guia. A consulta ao Open Food Facts depende da liberação de `world.openfoodfacts.org`; a tentativa anterior retornou HTTP 403 do proxy. Os testes de navegador dos serviços externos usam respostas simuladas.
