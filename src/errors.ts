const messages: Record<string, string> = {
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
