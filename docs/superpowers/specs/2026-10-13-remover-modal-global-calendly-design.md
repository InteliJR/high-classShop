# Remover o modal global de Calendly do fluxo de produtos

## Objetivo

Permitir que o especialista navegue e cadastre produtos sem qualquer interrupção relacionada ao Calendly. A integração continua opcional e acessível no perfil e nos fluxos de agendamento.

## Causa raiz

Os endpoints de produtos e a própria página de cadastro já não exigem Calendly. Porém, `MainLayout` ainda monta `RequireCalendlyModal` para todo especialista. Como a página de novo produto usa esse layout, o modal abre por cima do formulário e cria uma exigência prática antes que o usuário consiga interagir com o cadastro. O teste atual de `ProductFormPage` monta somente a página isolada e, por isso, não cobre essa composição.

## Solução

- Remover `RequireCalendlyModal` de `MainLayout` e apagar o componente sem consumidores.
- Manter a configuração do Calendly no perfil e os recursos de agendamento inalterados.
- Atualizar a confirmação do cadastro de especialista para declarar que o Calendly é opcional, sem associá-lo à permissão para anunciar produtos.
- Adicionar um teste de `MainLayout` com especialista sem Calendly para garantir que o layout não consulte o status OAuth nem apresente um diálogo global.
- Expandir o teste do cadastro de especialista para cobrir a mensagem exibida após o sucesso.

## Tratamento de erros

Nenhum novo tratamento é necessário. Ao remover a consulta global, falhas no endpoint de status do Calendly deixam de interferir na navegação do especialista. Erros do OAuth continuam tratados onde a conexão é iniciada explicitamente.

## Fora do escopo

- Alterar OAuth, webhooks ou sincronização do Calendly.
- Alterar agendamentos ou a página de perfil.
- Alterar autorização, validação ou persistência de produtos no backend.
