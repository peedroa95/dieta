const messages: Record<string, string> = {
  anonymous_provider_disabled:
    "Ative Anonymous Sign-Ins em Authentication → Sign In / Providers no Supabase para entrar sem confirmação.",
  PGRST202:
    "Execute a migração 202610210002_email_spaces.sql no SQL Editor do Supabase para ativar o acesso direto por e-mail.",
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar.",
  user_already_exists:
    "Este e-mail já possui uma conta. Entre ou recupere sua senha.",
  weak_password: "Escolha uma senha mais forte, com pelo menos 8 caracteres.",
  over_email_send_rate_limit:
    "Limite de envio de e-mails atingido. Aguarde alguns minutos.",
  over_request_rate_limit:
    "Muitas tentativas em pouco tempo. Aguarde e tente novamente.",
  signup_disabled: "O cadastro está desabilitado neste projeto.",
  email_address_invalid: "Informe um endereço de e-mail válido.",
  same_password: "Escolha uma senha diferente da anterior.",
  email_exists:
    "Este e-mail já tem uma conta. Para vincular uma sessão antiga, use outro e-mail ou entre na conta existente em outro navegador.",
  email_address_not_authorized:
    "O serviço de e-mail do Supabase ainda precisa ser configurado para enviar links a este endereço.",
  otp_expired: "Este link expirou. Solicite um novo e-mail de recuperação.",
  PGRST205:
    "O banco ainda não está configurado. Execute a migração indicada no README.",
};
export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const value = error as { code?: string; message?: string };
    if (value.code && messages[value.code]) return messages[value.code];
    if (value.message?.includes("Failed to fetch"))
      return "Não foi possível conectar. Verifique sua conexão e a configuração do Supabase.";
    if (value.message) return value.message;
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}
