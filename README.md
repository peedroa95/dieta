# Nutria

Aplicativo pessoal de alimentação em português brasileiro, com React, TypeScript e Vite. **Abre diretamente no painel, sem cadastro, login ou senha.** Permite cadastrar alimentos manualmente ou pelo número EAN/código de barras, registrar refeições e acompanhar nutrientes, água, metas e peso.

## Executar

Requer Node.js 22 ou superior e npm.

```bash
cd /workspace/dieta
npm ci --cache /workspace/.cache/npm
npm run dev
```

O servidor de desenvolvimento usa a porta 5173. `npm run build` gera `dist` para hospedagem estática com HTTPS; `npm run preview` serve a compilação para conferência local.

## Armazenamento pessoal

Sem variáveis do Supabase, o aplicativo funciona imediatamente com armazenamento persistente no navegador. Os dados da versão anterior são preservados: a chave interna `nutria-demo-v1` foi mantida por compatibilidade, embora o aplicativo não exiba mais um modo de demonstração ou tela de login. Não são adicionados dados fictícios.

Os dados locais ficam neste navegador e não são sincronizados entre dispositivos. Em **Configurações → Exportar meus registros**, você pode baixar uma cópia JSON. **Apagar dados locais** exige confirmação e remove esses registros. Limpar o armazenamento do navegador também remove os dados locais.

### Supabase opcional, sem tela de login

Se quiser armazenar os dados no PostgreSQL:

1. Crie seu projeto Supabase.
2. No SQL Editor, execute nesta ordem, uma única vez cada migração:
   - `supabase/migrations/202610200001_initial.sql`
   - `supabase/migrations/202610200002_food_barcodes.sql`
3. Se já executou a primeira migração, aplique **somente a segunda**. Ela acrescenta código de barras, fonte e indicação de nutrientes opcionais não informados, preservando os registros existentes.
4. Em **Authentication → Sign In / Providers**, habilite **Anonymous Sign-Ins**. A autenticação acontece automaticamente em segundo plano, sem formulário de login. Uma sessão existente é reutilizada para preservar o acesso aos dados já vinculados a ela. Se a criação da sessão falhar, o aplicativo informa o erro e permite tentar novamente; ele não troca silenciosamente para outro armazenamento.
5. Copie `.env.example` para `.env.local` e preencha a URL e a chave **pública publishable/anon**:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
   ```

6. Reinicie o servidor. Na hospedagem estática, configure essas variáveis durante a compilação e gere um novo `dist`.

Nunca coloque `service_role`, `sb_secret_…`, senha do banco ou outra credencial administrativa em variáveis `VITE_*`. `.env.local` é ignorado pelo Git. Não é preciso configurar e-mail, senha ou recuperação de conta.

A identidade automática é persistida no navegador pelo SDK Supabase. Limpar essa sessão ou usar outro navegador cria outra identidade, que não acessa os dados anteriores. Não há migração automática dos registros locais para o Supabase. Por isso, exporte seus registros antes de trocar o armazenamento ou limpar o navegador.

Todas as tabelas mantêm as políticas RLS por identidade. Retirar a tela de login não torna os dados do banco públicos. Nenhuma política foi alterada para permitir acesso irrestrito.

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

- **Vitest:** cálculos, datas, histórico, metas, EAN/GTIN, mapeamento nutricional e identidade automática.
- **PostgreSQL via PGlite:** migrações reais, RLS entre duas identidades, snapshots, validação de EAN e unicidade por usuário. A camada `auth` é simulada somente nos testes.
- **Playwright:** fluxos em desktop e celular, abertura sem login, preservação dos dados anteriores, consulta EAN, cadastro manual alternativo, nutrientes ausentes, duplicatas e falhas de rede. As respostas do Open Food Facts são simuladas de forma determinística nos testes; nenhum produto fictício é incluído no aplicativo real.

Os testes de navegador iniciam um servidor próprio na porta **5175**, com as variáveis Supabase vazias, para não modificar registros remotos. Eles usam o Chromium do sistema quando disponível. Em outras máquinas, execute `npx playwright install chromium` ou defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Após reinstalar `node_modules` com um Vite em execução, reinicie o processo para evitar o cache antigo de dependências (`504 Outdated Optimize Dep`).

**Validação externa pendente:** não há projeto Supabase configurado nesta instância. A consulta real ao Open Food Facts foi negada pela política de rede do ambiente (HTTP 403 do proxy). Os fluxos são verificados com respostas simuladas; a consulta real deve ser repetida após aplicar a liberação de `world.openfoodfacts.org` nas configurações do ambiente.
