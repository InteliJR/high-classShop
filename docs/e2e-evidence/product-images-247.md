# Evidências da issue #247 — imagens dos produtos

Validação em 25/10/2026. Anúncio: https://bmfbrokerage.com/catalog/car/fb343f46-e0e4-45d0-983a-82c940cbe4ff

## Diagnóstico confirmado

Os nove objetos atualmente referenciados respondem HTTP 200 com Content-Type image/jpeg, mas têm apenas 97 bytes. O conteúdo corresponde a URLs assinadas antigas interpretadas como base64 até o primeiro sinal de igual. O formulário de edição pode retornar uma URL quando a conversão para base64 falha; o backend anterior enviava esse texto ao decodificador base64.

Há também um problema de seleção: a primeira imagem original (ID 54) é um JPEG válido de 400×300 com conteúdo cinza. O carrossel anterior abre essa imagem, embora a foto principal seja a ID 55. A correção coloca a principal primeiro sem mudar a ordem relativa das demais.

## Comparação no navegador local

URLs temporárias de leitura acessaram os arquivos reais do S3. Nenhum objeto S3, registro do banco ou deployment foi alterado.

| Código | Referências | Resultado |
|---|---|---|
| Carrossel anterior | Atuais | 0/9 imagens decodificadas; nove miniaturas inválidas. |
| Carrossel anterior | Originais | 9/9 arquivos carregam, mas a abertura é a imagem cinza ID 54. |
| Carrossel corrigido | Atuais | Sem fotos disponíveis, sem elementos de imagem quebrados para o visitante. |
| Carrossel corrigido | Originais | 9/9 arquivos carregam; abre a principal ID 55 e navega pelos nove itens. |

Ordem validada com a correção: 55, 54, 56, 57, 58, 59, 60, 61, 62. Nenhum erro de JavaScript nos quatro cenários. As URLs assinadas e as credenciais não são versionadas.

- [Arquivos atuais no carrossel anterior](product-images-247-current.png)
- [Originais no carrossel anterior](product-images-247-originals-old-gallery.png)
- [Originais no carrossel corrigido, abrindo a principal](product-images-247-originals-fixed-gallery.png)

O tratamento de falhas também foi validado em desktop e celular: visitantes veem apenas imagens disponíveis; responsável pelo anúncio e administrador veem os slots com falha. Se nenhuma foto carregar, o visitante vê Sem fotos disponíveis.

## Recuperação ainda pendente em produção

A correção de código não repara automaticamente os nove registros do Porsche. Depois de confirmar o deploy, salvar as referências atuais e atualizar somente os registros abaixo para as chaves originais, preservando IDs, ordem e is_primary. Verificar novamente os objetos e as referências imediatamente antes da operação para detectar mudanças desde este diagnóstico. A recuperação deve ocorrer em uma transação e ter uma forma de reversão.

Prefixo comum das chaves: `cars/fb343f46-e0e4-45d0-983a-82c940cbe4ff/`.

| ID da imagem | Principal | Arquivo referenciado atualmente | Arquivo original a restaurar |
|---|---|---|---|
| 54 | Não | `1792015593303-0.jpg` | `1792014232874-0.jpg` |
| 55 | Sim | `1792015593500-1.jpg` | `1792014233071-1.jpg` |
| 56 | Não | `1792015593689-2.jpg` | `1792014233330-2.jpg` |
| 57 | Não | `1792015593864-3.jpg` | `1792014233585-3.jpg` |
| 58 | Não | `1792015594044-4.jpg` | `1792014233893-4.jpg` |
| 59 | Não | `1792015594255-5.jpg` | `1792014234175-5.jpg` |
| 60 | Não | `1792015594437-6.jpg` | `1792014234413-6.jpg` |
| 61 | Não | `1792015594611-7.jpg` | `1792014234700-7.jpg` |
| 62 | Não | `1792015594772-8.jpg` | `1792014234921-8.jpg` |

Os nove originais foram localizados no S3; a principal foi baixada e inspecionada visualmente. Nenhum arquivo precisa ser movido ou sobrescrito no S3. A imagem cinza ID 54 permanece na galeria porque é um arquivo válido; eventual remoção é uma decisão separada sobre o anúncio.

A issue deve continuar aberta até o deploy, a recuperação das referências e a conferência final do anúncio em produção. Não editar/regravar o anúncio com o backend antigo, pois isso pode repetir a corrupção.
