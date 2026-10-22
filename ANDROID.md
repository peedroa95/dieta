# Nutria para Android

O APK usa a mesma aplicação React e o mesmo projeto Supabase do site. Não mantém uma cópia independente do banco: o mesmo e-mail abre o mesmo espaço e os registros sincronizam entre os aparelhos e a Vercel. A interface é empacotada dentro do APK, sem depender de carregar o site da Vercel para abrir.

O acesso continua **somente por e-mail, sem verificação de identidade**, conforme a escolha do proprietário. Quem souber o endereço pode abrir e alterar seus registros. As configurações de acesso direto descritas em [CONFIGURAR_SUPABASE.md](CONFIGURAR_SUPABASE.md) valem também para Android.

## Instalar

O comando de compilação gera `artifacts/nutria-debug.apk`, assinado para instalação e testes pessoais. Copie o arquivo para o celular, abra-o e permita a instalação pelo navegador/gerenciador de arquivos usado. Compatível com **Android 7.0 ou superior**, com Android System WebView atualizado.

Abra **Nutria** e informe o mesmo e-mail usado no site. Não é necessário cadastrar outra conta nem configurar o Supabase no celular.

O APK de depuração é instalável, mas não é uma publicação na Play Store nem uma compilação de produção. Para distribuir uma versão definitiva, gere uma chave de assinatura própria e mantenha-a em local seguro. Nunca a coloque no GitHub. Para atualizar uma instalação sem reinstalar, use a mesma chave e aumente o `versionCode` em `android/app/build.gradle`. Sem a chave anterior, pode ser necessário desinstalar; isso apaga a sessão e os arquivos locais do app. Registros já sincronizados no Supabase continuam disponíveis ao informar o mesmo e-mail.

## Integrações

- Alimentos, EAN, diário, receitas, metas, água, peso e relatórios usam o mesmo código e banco do site.
- Voltar fecha o formulário aberto; depois fecha o menu ou volta ao início. Na tela inicial, minimiza o app.
- Retomar o app solicita atualização dos dados; a atualização periódica e o botão manual continuam disponíveis.
- **Exportar meus registros** abre o compartilhamento nativo com um arquivo JSON. É possível salvá-lo por um aplicativo instalado que aceite arquivos, como um gerenciador ou armazenamento na nuvem.
- **Importar arquivo JSON** usa o seletor de arquivos do Android e mantém a confirmação do destino.
- A sessão persiste no armazenamento privado do app. Sair encerra apenas esse aparelho.
- O APK pede acesso à internet e não solicita câmera, contatos ou permissão geral de armazenamento. A entrada de EAN continua por digitação/leitor que funciona como teclado.

A sincronização e a busca no Open Food Facts precisam de internet. Esta versão não implementa gravações offline em fila: aguarde conexão para cadastrar ou alterar registros. Se a conexão cair, os dados já carregados permanecem na tela e a interface permite tentar novamente. Dados existentes só no navegador podem ser exportados no site e importados no app.

Alterar o site na Vercel não atualiza automaticamente a interface instalada. Mudanças no banco aparecem nos dois; novas funcionalidades da interface exigem gerar e instalar um novo APK. Não há atualização remota de código nativo configurada.

## Compilar no computador

Requisitos: Node.js 22+, Java 21, Android SDK Platform 36, Build Tools 35.0.0 e Platform Tools. O Gradle Wrapper já está no repositório, com checksum SHA-256 da distribuição oficial. Não é necessário instalar Gradle globalmente.

1. Instale as dependências com `npm ci`.
2. Configure em `.env.local` a **mesma URL e chave pública Supabase** utilizadas pela Vercel. Nunca utilize `service_role`, `sb_secret_…` ou senha do banco.
3. Instale os componentes pelo Android Studio → SDK Manager e defina `ANDROID_HOME` para a pasta do SDK.
4. Execute:

```bash
npm run android:apk
```

O comando valida a configuração pública, compila React, sincroniza os plugins e executa `assembleDebug`. Saídas: `artifacts/nutria-debug.apk` e `artifacts/nutria-debug.apk.sha256`. O processo recusa gerar um APK integrado sem a configuração Supabase, evitando um aplicativo silenciosamente limitado ao armazenamento local.

Para abrir no Android Studio:

```bash
npm run android:sync
npm run android:open
```

O identificador Android é `com.nutria.dieta`. O diretório `android` contém o projeto nativo; `capacitor.config.ts` mantém a configuração do Capacitor. Não configure `server.url` para apontar para a Vercel em produção: a interface deve ser compilada e embarcada no APK.

## Compilar neste ambiente de nuvem Linux

O instalador prepara um JDK 21 completo por pacotes oficiais Debian, com índices e downloads verificados pelo APT. Em seguida, usa o catálogo e os arquivos oficiais Android, valida o checksum do download e mantém TLS habilitado:

```bash
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run android:setup
npm run android:apk
```

O JDK fica em `/workspace/.cache/jdk-21`; o SDK, em `/workspace/.cache/android-sdk`; e o Gradle, em `/workspace/.cache/gradle`. O compilador seleciona o JDK local automaticamente. O script usa o proxy do ambiente quando presente e adiciona os certificados locais a uma cópia do truststore Java no cache, preservando as raízes originais. O cache Java/Android é redirecionado para uma pasta gravável, sem modificar `HOME`.

As licenças do SDK são aceitas pelo instalador para a compilação solicitada. A chave de depuração gerada permanece no cache privado do ambiente e não é versionada. Os APKs, o conteúdo copiado de `dist`, as configurações locais, caches e chaves são ignorados pelo Git.

## Verificação

`npm test` inclui os cálculos, banco e testes das integrações nativas de retomada, Voltar e exportação. `npm run test:e2e` verifica os fluxos da interface e a sincronização com API simulada no navegador. Compilar e verificar a assinatura do APK não substitui testar em um aparelho Android; instalação, teclado, seletor de arquivos e compartilhamento devem ser conferidos no celular.
