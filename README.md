# Mercadinho da Vila

Simulador educativo de supermercado, com interface em HTML/CSS/JavaScript e API em Node.js. O catálogo, a newsletter, o suporte e as contas são atendidos pelo servidor; carrinho, lista de desejos e alertas de preço podem ser guardados na conta.

## Executar

Requer Node.js 18 ou superior. Não precisa instalar dependências.

```powershell
cd D:\Pastas\Dev\mercado
npm.cmd start
```

Abra [http://localhost:3000](http://localhost:3000). Para executar em desenvolvimento com reinicialização automática, use `npm.cmd run dev`. Para executar os testes, use `npm.cmd test`.

### Acesso para demonstração

O formulário de login já vem preenchido com uma conta local de demonstração:

- E-mail: `demo@mercadinhodavila.com`
- Senha: `VilaDemo2026`

O servidor cria essa conta automaticamente na primeira inicialização. No checkout, o botão **Preencher os dados de exemplo** completa o endereço e os campos de um cartão totalmente fictício; nenhuma informação de cartão é enviada ou armazenada.

Os dados de contas, inscrições e mensagens de suporte ficam em `data/store.json`. Defina `DATA_FILE` para escolher outro caminho. A senha é armazenada como hash com sal aleatório usando `scrypt`; as sessões permanecem na memória do processo.

## Funcionalidades

- Catálogo com 114 itens em hortifruti, padaria, mercearia, açougue, peixaria, pets, bebê, orgânicos, temperos, limpeza e outras seções; busca, filtros, ordenação, ofertas, cupons, detalhes, produtos similares e recomendações.
- Sacolinha com quantidades e total calculado a partir dos preços do servidor.
- Conta com cadastro, login, favoritos, sacolinha e alertas de preço persistentes.
- Comparação de produtos da mesma categoria e acompanhamento de preço.
- Newsletter e formulário de suporte com validação e armazenamento local no servidor.
- Checkout demonstrativo que exige login, gera comprovante, estima a entrega e guarda o histórico de pedidos.
- Cancelamento e opção de recomprar os itens de pedidos no histórico.

## Segurança da demonstração

O checkout não processa pagamentos nem cria pedidos reais. Guarda apenas um comprovante marcado como demonstrativo na conta. Os campos do cartão servem somente à validação visual no navegador: seus valores não são enviados à API nem armazenados. Use exclusivamente informações inventadas. Esta aplicação não deve ser usada em produção: não configura HTTPS, expiração de sessão persistente, limitação de tentativas de login nem integração com um provedor de pagamentos.
