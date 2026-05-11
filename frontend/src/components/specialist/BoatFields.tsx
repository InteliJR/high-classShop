import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface BoatFieldsProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

export default function BoatFields({ register, errors }: BoatFieldsProps) {
  return (
    <>
      {/* Fabricante */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fabricante" className="text-sm font-medium text-text-primary">
          Fabricante
        </label>
        <input
          id="fabricante"
          type="text"
          {...register("fabricante")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Azimut Yachts, Ferretti Group, Sunseeker"
        />
        {errors.fabricante && (
          <span className="text-sm text-red-500">{errors.fabricante.message as string}</span>
        )}
      </div>

      {/* Tamanho */}
      <div className="flex flex-col gap-2">
        <label htmlFor="tamanho" className="text-sm font-medium text-text-primary">
          Tamanho
        </label>
        <select
          id="tamanho"
          {...register("tamanho")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o tamanho</option>
          <option value="ate_30_pes">Até 30 pés</option>
          <option value="30_50_pes">30 a 50 pés</option>
          <option value="acima_50_pes">Acima de 50 pés</option>
        </select>
        {errors.tamanho && (
          <span className="text-sm text-red-500">{errors.tamanho.message as string}</span>
        )}
      </div>

      {/* Estilo */}
      <div className="flex flex-col gap-2">
        <label htmlFor="estilo" className="text-sm font-medium text-text-primary">
          Estilo
        </label>
        <select
          id="estilo"
          {...register("estilo")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o estilo</option>
          <option value="Esportivo">Esportivo</option>
          <option value="Clássico">Clássico</option>
          <option value="Moderno">Moderno</option>
          <option value="Luxo">Luxo</option>
          <option value="Pesca">Pesca</option>
          <option value="Cruzeiro">Cruzeiro</option>
        </select>
        {errors.estilo && (
          <span className="text-sm text-red-500">{errors.estilo.message as string}</span>
        )}
      </div>

      {/* Combustível */}
      <div className="flex flex-col gap-2">
        <label htmlFor="combustivel" className="text-sm font-medium text-text-primary">
          Combustível
        </label>
        <select
          id="combustivel"
          {...register("combustivel")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o combustível</option>
          <option value="diesel">Diesel</option>
          <option value="gasolina">Gasolina</option>
          <option value="eletrico">Elétrico</option>
          <option value="hibrido">Híbrido</option>
        </select>
        {errors.combustivel && (
          <span className="text-sm text-red-500">{errors.combustivel.message as string}</span>
        )}
      </div>

      {/* Motor */}
      <div className="flex flex-col gap-2">
        <label htmlFor="motor" className="text-sm font-medium text-text-primary">
          Motor
        </label>
        <input
          id="motor"
          type="text"
          {...register("motor")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: 2x Volvo Penta D6-400 (800hp total)"
        />
        {errors.motor && (
          <span className="text-sm text-red-500">{errors.motor.message as string}</span>
        )}
      </div>

      {/* Ano do Motor */}
      <div className="flex flex-col gap-2">
        <label htmlFor="ano_motor" className="text-sm font-medium text-text-primary">
          Ano do Motor
        </label>
        <input
          id="ano_motor"
          type="number"
          {...register("ano_motor", {
            min: { value: 1900, message: "Ano inválido" },
            max: { value: new Date().getFullYear() + 1, message: "Ano inválido" },
          })}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: 2023"
        />
        {errors.ano_motor && (
          <span className="text-sm text-red-500">{errors.ano_motor.message as string}</span>
        )}
      </div>

      {/* Tipo de Embarcação */}
      <div className="flex flex-col gap-2">
        <label htmlFor="tipo_embarcacao" className="text-sm font-medium text-text-primary">
          Tipo de Embarcação
        </label>
        <select
          id="tipo_embarcacao"
          {...register("tipo_embarcacao")}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o tipo</option>
          <option value="iate">Iate</option>
          <option value="lancha">Lancha</option>
          <option value="catamara">Catamarã</option>
          <option value="veleiro">Veleiro</option>
          <option value="jet_boat">Jet Boat</option>
          <option value="outro">Outro</option>
        </select>
        {errors.tipo_embarcacao && (
          <span className="text-sm text-red-500">{errors.tipo_embarcacao.message as string}</span>
        )}
      </div>

      {/* Descrição Completa */}
      <div className="flex flex-col gap-2 col-span-2">
        <label htmlFor="descricao_completa" className="text-sm font-medium text-text-primary">
          Descrição Completa
        </label>
        <textarea
          id="descricao_completa"
          {...register("descricao_completa")}
          rows={4}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Iate de luxo com 3 cabines, flybridge espaçoso, casco em fibra de vidro reforçada. Equipado com sistema de navegação GPS, radar, piloto automático. Acabamento em madeira nobre..."
        />
        {errors.descricao_completa && (
          <span className="text-sm text-red-500">{errors.descricao_completa.message as string}</span>
        )}
      </div>

      {/* Acessórios */}
      <div className="flex flex-col gap-2 col-span-2">
        <label htmlFor="acessorios" className="text-sm font-medium text-text-primary">
          Acessórios
        </label>
        <textarea
          id="acessorios"
          {...register("acessorios")}
          rows={3}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Ar-condicionado, gerador, dessalinizador, tender com motor, jet ski, equipamento de mergulho, sistema de som Bose, TV 55 polegadas..."
        />
        {errors.acessorios && (
          <span className="text-sm text-red-500">{errors.acessorios.message as string}</span>
        )}
      </div>
    </>
  );
}

