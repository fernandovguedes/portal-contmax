

# Ano base IRPF fixo em 2025

## Alteração

**Arquivo: `src/pages/Irpf.tsx`** (linha 23)
- Confirmar que `const anoBase = 2025;` está definido (já foi corrigido anteriormente, mas preciso verificar o estado atual após o último plano aprovado que propôs mudar para 2026).

Se o valor atual for 2026 (conforme plano anterior aprovado), reverter para `const anoBase = 2025;`.

Nenhuma outra alteração necessária — o `anoBase` é usado como parâmetro central no hook `useIrpf` e propaga para todas as queries e criações de cases.

