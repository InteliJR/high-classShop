/**
 * Utilitários de formatação para dados do contrato
 *
 * Responsabilidades:
 * - Formatar CPF, CNPJ, CEP, RG para exibição no contrato
 * - Formatar valores monetários em BRL
 * - Converter números para extenso em português
 *
 * IMPORTANTE: Os valores são formatados ANTES de enviar ao DocuSign
 * para que apareçam corretamente no contrato gerado.
 */

/**
 * Formata CPF para exibição: ###.###.###-##
 * @param value - CPF com apenas números (11 dígitos)
 * @returns CPF formatado
 * @example formatCpf('12345678901') => '123.456.789-01'
 */
export function formatCpf(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ para exibição: ##.###.###/####-##
 * @param value - CNPJ com apenas números (14 dígitos)
 * @returns CNPJ formatado
 * @example formatCnpj('12345678000199') => '12.345.678/0001-99'
 */
export function formatCnpj(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5',
  );
}

/**
 * Formata CEP para exibição: #####-###
 * @param value - CEP com apenas números (8 dígitos)
 * @returns CEP formatado
 * @example formatCep('01234567') => '01234-567'
 */
export function formatCep(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return value;
  return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Formata RG para exibição: ##.###.###-#
 * @param value - RG com apenas números (9 dígitos)
 * @returns RG formatado
 * @example formatRg('123456789') => '12.345.678-9'
 */
export function formatRg(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 9) return value;
  // RG pode ter 7, 8 ou 9 dígitos dependendo do estado
  if (digits.length === 9) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
  }
  if (digits.length === 8) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
  }
  return digits.replace(/(\d{1})(\d{3})(\d{3})/, '$1.$2.$3');
}

/**
 * Formata valor monetário em BRL: R$ #.###.###,##
 * @param value - Valor numérico
 * @returns Valor formatado em reais
 * @example formatBRL(1234567.89) => 'R$ 1.234.567,89'
 */
export function formatBRL(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Converte número para extenso em português brasileiro
 * @param value - Valor numérico (até bilhões)
 * @returns Valor por extenso
 * @example numberToWords(1234567.89) => 'um milhão, duzentos e trinta e quatro mil, quinhentos e sessenta e sete reais e oitenta e nove centavos'
 */
export function numberToWords(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '';
  if (value === 0) return 'zero reais';

  const unidades = [
    '',
    'um',
    'dois',
    'três',
    'quatro',
    'cinco',
    'seis',
    'sete',
    'oito',
    'nove',
    'dez',
    'onze',
    'doze',
    'treze',
    'quatorze',
    'quinze',
    'dezesseis',
    'dezessete',
    'dezoito',
    'dezenove',
  ];

  const dezenas = [
    '',
    '',
    'vinte',
    'trinta',
    'quarenta',
    'cinquenta',
    'sessenta',
    'setenta',
    'oitenta',
    'noventa',
  ];

  const centenas = [
    '',
    'cento',
    'duzentos',
    'trezentos',
    'quatrocentos',
    'quinhentos',
    'seiscentos',
    'setecentos',
    'oitocentos',
    'novecentos',
  ];

  function convertGroup(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cem';

    let result = '';

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) {
      result += centenas[c];
      if (d > 0 || u > 0) result += ' e ';
    }

    if (d === 1) {
      result += unidades[10 + u];
    } else {
      if (d > 0) {
        result += dezenas[d];
        if (u > 0) result += ' e ';
      }
      if (u > 0) {
        result += unidades[u];
      }
    }

    return result;
  }

  // Separar parte inteira e decimal
  const inteiro = Math.floor(Math.abs(value));
  const centavos = Math.round((Math.abs(value) - inteiro) * 100);

  let resultado = '';

  // Bilhões
  const bilhoes = Math.floor(inteiro / 1000000000);
  if (bilhoes > 0) {
    resultado += convertGroup(bilhoes);
    resultado += bilhoes === 1 ? ' bilhão' : ' bilhões';
  }

  // Milhões
  const milhoes = Math.floor((inteiro % 1000000000) / 1000000);
  if (milhoes > 0) {
    if (resultado) resultado += ', ';
    resultado += convertGroup(milhoes);
    resultado += milhoes === 1 ? ' milhão' : ' milhões';
  }

  // Milhares
  const milhares = Math.floor((inteiro % 1000000) / 1000);
  if (milhares > 0) {
    if (resultado) resultado += ', ';
    resultado += convertGroup(milhares);
    resultado += ' mil';
  }

  // Unidades
  const unidadesRestantes = inteiro % 1000;
  if (unidadesRestantes > 0) {
    if (resultado) resultado += ' e ';
    resultado += convertGroup(unidadesRestantes);
  }

  // Reais
  if (inteiro > 0) {
    resultado += inteiro === 1 ? ' real' : ' reais';
  }

  // Centavos
  if (centavos > 0) {
    if (resultado) resultado += ' e ';
    resultado += convertGroup(centavos);
    resultado += centavos === 1 ? ' centavo' : ' centavos';
  }

  return resultado.trim();
}

/**
 * Remove formatação de string, mantendo apenas dígitos
 * @param value - String com formatação
 * @returns String apenas com números
 * @example stripFormatting('123.456.789-01') => '12345678901'
 */
export function stripFormatting(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}
