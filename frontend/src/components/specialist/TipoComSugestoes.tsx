import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * Campo de tipo/classificação com sugestões, mas sem trancar o especialista
 * nelas.
 *
 * Era um <select>: o que não estava na lista não existia, e produto fora das
 * classificações previstas simplesmente não entrava. Aqui vira input com
 * <datalist>, que aceita texto livre e continua oferecendo as opções de sempre.
 *
 * As opções mantêm os mesmos `value` de antes, e não o rótulo humano. Isso é
 * de propósito: o banco já tem registros gravados com esses valores
 * ('sedan', 'iate', 'VLJ'), e trocar o que a lista grava criaria duas grafias
 * para a mesma coisa. O rótulo vai como texto da opção — o navegador o mostra
 * como dica ao lado do valor.
 */
export interface OpcaoTipo {
  /** Valor gravado no banco. */
  value: string;
  /** Como explicar esse valor para quem está preenchendo. */
  label: string;
}

interface Props {
  id: string;
  label: string;
  opcoes: OpcaoTipo[];
  registro: UseFormRegisterReturn;
  erro?: string;
  placeholder?: string;
}

export default function TipoComSugestoes({
  id,
  label,
  opcoes,
  registro,
  erro,
  placeholder = "Selecione ou digite um tipo",
}: Props) {
  const listId = `${id}-sugestoes`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        list={listId}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        {...registro}
        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <datalist id={listId}>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </datalist>
      <span className="text-xs text-gray-500">
        Não achou na lista? Digite o tipo do produto.
      </span>
      {erro && <span className="text-sm text-red-500">{erro}</span>}
    </div>
  );
}
