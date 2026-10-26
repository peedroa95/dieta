# Nutria no iPhone: aplicativo nativo

O projeto iOS usa Capacitor 8, Swift Package Manager e o mesmo Supabase do site. É compatível com iPhone 15 e requer iOS 15 ou superior. Não é uma instalação de site pela tela inicial: esta opção compila um aplicativo nativo em um Mac na nuvem.

## Instalação local com computador Windows

O equivalente ao APK é um arquivo `.ipa`. O iPhone exige assinatura Apple para executá-lo. Abrir o arquivo baixado no Safari ou no app Arquivos não instala o aplicativo.

O workflow **iOS - IPA para instalação local** compila em um runner macOS do GitHub e gera `nutria-ios-unsigned.ipa`, sem certificado ou chave privada. Esse arquivo precisa ser assinado no seu computador antes de instalar no iPhone.

1. Abra o repositório no GitHub → **Actions → iOS - IPA para instalação local → Run workflow**. A criação/alteração do próprio workflow também inicia uma compilação. Um runner Mac pode consumir minutos do GitHub Actions; os limites dependem da conta e da visibilidade do repositório.
2. Aguarde o resultado passar e baixe o artefato **nutria-ios-para-assinar-no-computador**. Extraia o ZIP para obter o `.ipa`. O mesmo resultado é colocado na branch `builds/ios`, junto com o SHA-256 e o commit de origem; a branch principal permanece com o código-fonte.
3. Instale o [Sideloadly](https://sideloadly.io/) pelo site oficial em um computador Windows ou Mac e os componentes Apple que a ferramenta solicitar. Não use páginas de download de terceiros.
4. Conecte o iPhone por cabo, desbloqueie e escolha **Confiar neste computador**.
5. No Sideloadly, selecione o iPhone e o arquivo `.ipa`. Faça a autenticação da sua conta Apple **diretamente na ferramenta**, nunca no código, GitHub ou nesta conversa. O programa assina o app para uso pessoal e instala no aparelho.
6. Se o iOS pedir, habilite **Modo de Desenvolvedor** em Ajustes → Privacidade e Segurança e confie no perfil em Ajustes → Geral → VPN e Gerenciamento de Dispositivo. Os nomes podem variar conforme a versão do iOS.
7. Abra **Nutria** e informe o mesmo e-mail do site para acessar os registros do Supabase.

Com uma conta Apple gratuita, a assinatura normalmente vale **7 dias** e precisa ser renovada pelo computador. A Apple também impõe limites a apps e identificadores de desenvolvimento. A renovação não deve apagar os registros na nuvem. Não desinstale o aplicativo para renovar sem necessidade; confirme o e-mail e a sincronização antes de qualquer reinstalação.

Essa instalação não é uma publicação na App Store e não funciona apenas tocando no arquivo no iPhone. Se você tiver somente o telefone e nenhuma assinatura/distribuição Apple configurada, não existe aqui um IPA universal que possa ser instalado como APK.

## App Store ou TestFlight

Para distribuir pelo TestFlight ou pela App Store, é necessária a assinatura Apple Developer, configuração de assinatura e um registro no App Store Connect. O build sem assinatura deste workflow não pode ser enviado diretamente à loja. A publicação depende da análise e das regras da Apple; o projeto não foi publicado nem submetido.

Com conta gratuita e um Mac próprio, também é possível instalar pelo Xcode para uso pessoal. Isso não elimina o prazo de renovação da assinatura gratuita.

## Compilar com Xcode

Requisitos: macOS com Xcode compatível com Capacitor 8 (Xcode 26+ recomendado), Node.js 22+ e as duas variáveis públicas Supabase em `.env.local`.

```bash
npm ci
npm run ios:sync
npm run ios:open
```

No Xcode, selecione **App**, configure o Team e a assinatura, conecte o iPhone e execute. `npm run ios:simulator` gera apenas uma compilação para simulador, sem assinatura; ela não instala em um iPhone físico. O identificador atual é `com.nutria.dieta`; a ferramenta de assinatura poderá precisar ajustar esse identificador conforme sua conta e os limites da Apple.

## Configuração pública no GitHub

O workflow usa as repository **Variables** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, quando preenchidas. Se estiverem vazias, obtém somente esses valores públicos do bundle publicado em `https://dieta-beryl-two.vercel.app/`. Não lê dados de usuários nem usa credenciais administrativas. Dessa forma, o aplicativo usa o mesmo projeto Supabase da versão web sem exigir uma chave secreta.

Se a versão publicada estiver indisponível ou tiver configuração ambígua, a compilação para e pede as duas Variables. Nunca coloque `service_role`, `sb_secret_…`, certificados de assinatura, perfis ou senha Apple em arquivos versionados.

## Integração e limites

- Mesmos alimentos, EAN, diário, receitas, metas, água, peso e histórico do site. Dados sincronizam pelo Supabase; alterações na interface exigem uma nova compilação e instalação.
- Retomar o aplicativo solicita atualização dos registros. O acesso continua somente por e-mail, sem comprovação de identidade, conforme a configuração escolhida pelo proprietário.
- Exportar JSON usa o compartilhamento do iOS; importar usa o seletor de arquivos.
- O botão Voltar/minimizar do Android não é registrado no iOS. A interface tem seus próprios controles para fechar formulários e navegar.
- O projeto inclui ícone Nutria, tela de abertura e `PrivacyInfo.xcprivacy` com a razão de uso de timestamps exigida pelo plugin Filesystem. Uma publicação futura ainda exige preencher as informações reais de privacidade da aplicação no App Store Connect.
- A sincronização exige internet. Não há fila de alterações offline nem integração HealthKit.

A sincronização dos arquivos web e os testes JavaScript podem ser executados no Linux. A compilação Swift, a assinatura e o teste em iPhone dependem de macOS/Xcode e do aparelho. Um workflow salvo não comprova que o build remoto passou: confira o resultado e o commit de origem do artefato.
