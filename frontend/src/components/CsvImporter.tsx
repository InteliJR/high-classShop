import { useState, useRef, useCallback } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Trash2, Info, Loader2 } from "lucide-react";
import type { CsvImportResponse, CsvTemplateResponse, CsvErrorRow } from "../services/cars.service";

type ProductType = "CAR" | "BOAT" | "AIRCRAFT";

interface CsvImporterProps {
  productType: ProductType;
  onImport: (file: File) => Promise<CsvImportResponse>;
  onGetTemplate: () => Promise<CsvTemplateResponse>;
  disabled?: boolean;
  onSuccess?: () => void;
}

// Definições de colunas por tipo de produto (para validação local)
const COLUMN_DEFINITIONS: Record<ProductType, { required: string[]; optional: string[] }> = {
  CAR: {
    required: ["marca", "modelo", "valor", "estado", "ano"],
    optional: ["cor", "km", "cambio", "combustivel", "tipo_categoria", "descricao", "imagem"],
  },
  BOAT: {
    required: ["marca", "modelo", "valor", "estado", "ano"],
    optional: ["fabricante", "tamanho", "estilo", "combustivel", "motor", "ano_motor", "tipo_embarcacao", "descricao_completa", "acessorios", "imagem"],
  },
  AIRCRAFT: {
    required: ["marca", "modelo", "valor", "estado", "ano"],
    optional: ["categoria", "assentos", "tipo_aeronave", "descricao", "imagem"],
  },
};

const PRODUCT_NAMES: Record<ProductType, string> = {
  CAR: "Carros",
  BOAT: "Lanchas",
  AIRCRAFT: "Aeronaves",
};

interface LocalValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  foundColumns: string[];
}

export function CsvImporter({ productType, onImport, onGetTemplate, disabled, onSuccess }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResponse | null>(null);
  const [localValidation, setLocalValidation] = useState<LocalValidationResult | null>(null);
  const [structureError, setStructureError] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns = COLUMN_DEFINITIONS[productType];

  // Validação local do CSV antes de enviar
  const validateCsvLocally = useCallback((content: string): LocalValidationResult => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const errors: string[] = [];
    const warnings: string[] = [];

    if (lines.length === 0) {
      return { valid: false, errors: ["CSV está vazio"], warnings: [], rowCount: 0, foundColumns: [] };
    }

    // Detectar delimitador
    const delimiter = lines[0].includes(";") ? ";" : ",";
    
    // Parse do header
    const headerLine = lines[0];
    const foundColumns = headerLine
      .split(delimiter)
      .map(col => col.trim().toLowerCase().replace(/^"|"$/g, ""));

    // Verificar colunas obrigatórias
    const missingRequired = columns.required.filter(col => !foundColumns.includes(col));
    if (missingRequired.length > 0) {
      errors.push(`Colunas obrigatórias faltando: ${missingRequired.join(", ")}`);
    }

    // Verificar colunas não reconhecidas
    const allKnown = [...columns.required, ...columns.optional];
    const unknownColumns = foundColumns.filter(col => !allKnown.includes(col) && col !== "");
    if (unknownColumns.length > 0) {
      warnings.push(`Colunas não reconhecidas (serão ignoradas): ${unknownColumns.join(", ")}`);
    }

    // Verificar se há linhas de dados
    const dataLines = lines.slice(1).filter(line => line.trim());
    if (dataLines.length === 0) {
      errors.push("CSV não contém linhas de dados (apenas cabeçalho)");
    }

    // Validar número de colunas em cada linha
    const expectedCols = foundColumns.length;
    dataLines.forEach((line, index) => {
      const cols = line.split(delimiter).length;
      if (cols !== expectedCols) {
        errors.push(`Linha ${index + 2}: número incorreto de colunas (esperado ${expectedCols}, encontrado ${cols})`);
      }
    });

    // Validar campos numéricos obrigatórios nas primeiras 5 linhas como amostra
    const sampleLines = dataLines.slice(0, 5);
    const numericFields = ["valor", "ano"];
    
    sampleLines.forEach((line, lineIndex) => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
      
      numericFields.forEach(field => {
        const colIndex = foundColumns.indexOf(field);
        if (colIndex >= 0 && values[colIndex]) {
          const value = values[colIndex];
          if (isNaN(Number(value))) {
            errors.push(`Linha ${lineIndex + 2}: campo '${field}' deve ser numérico, encontrado: "${value}"`);
          }
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rowCount: dataLines.length,
      foundColumns,
    };
  }, [columns]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Reset estados
    setImportResult(null);
    setStructureError(null);
    setLocalValidation(null);

    // Validar tipo de arquivo
    if (!selectedFile.name.endsWith(".csv")) {
      setStructureError({ message: "Apenas arquivos .csv são aceitos" });
      return;
    }

    // Ler e validar conteúdo
    const content = await selectedFile.text();
    const validation = validateCsvLocally(content);
    setLocalValidation(validation);
    
    if (validation.valid) {
      setFile(selectedFile);
    } else {
      setFile(null);
    }
  }, [validateCsvLocally]);

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setImportResult(null);
    setStructureError(null);

    try {
      const result = await onImport(file);
      setImportResult(result);
      
      // Limpar arquivo se sucesso total (mas manter resultado visível)
      if (result.errorCount === 0) {
        setFile(null);
        setLocalValidation(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // NÃO fecha automaticamente - deixa o usuário ver o resultado
      }
    } catch (error: any) {
      // Erro de estrutura do CSV retornado pelo backend
      if (error.message || error.errors) {
        setStructureError(error);
      } else {
        setStructureError({ message: "Erro ao processar o arquivo. Tente novamente." });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsLoadingTemplate(true);
    try {
      const template = await onGetTemplate();
      
      // Criar arquivo para download
      const blob = new Blob([template.template], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `template_${productType.toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar template:", error);
      alert("Erro ao baixar o template. Tente novamente.");
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setImportResult(null);
    setLocalValidation(null);
    setStructureError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag and drop handlers
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Simular evento de input
      const fakeEvent = {
        target: { files: [droppedFile] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      await handleFileSelect(fakeEvent);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Download de Template */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Importar {PRODUCT_NAMES[productType]}</h4>
            <p className="text-sm text-gray-500">Importe varios produtos de uma vez</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={isLoadingTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          {isLoadingTemplate ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Baixar Template
        </button>
      </div>

      {/* Instruções - Collapsible */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          <Info className="w-4 h-4" />
          <span>Ver estrutura do CSV</span>
          <svg className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        
        <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Colunas Obrigatorias</p>
            <div className="flex flex-wrap gap-2">
              {columns.required.map(col => (
                <span key={col} className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200">
                  {col}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Colunas Opcionais</p>
            <div className="flex flex-wrap gap-2">
              {columns.optional.map(col => (
                <span key={col} className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
                  {col}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dicas</p>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full flex-shrink-0"></span>
                Separador: virgula (,) ou ponto-e-virgula (;)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full flex-shrink-0"></span>
                Campo <strong className="text-gray-900">imagem</strong>: URL (https://...) ou base64
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full flex-shrink-0"></span>
                <strong className="text-gray-900">valor</strong>: numero inteiro sem pontos
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 mt-2 bg-gray-400 rounded-full flex-shrink-0"></span>
                <strong className="text-gray-900">ano</strong>: 4 digitos (ex: 2024)
              </li>
            </ul>
          </div>
        </div>
      </details>

      {/* Upload Area - Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          isDragging 
            ? "border-blue-500 bg-blue-50" 
            : file 
              ? "border-green-300 bg-green-50" 
              : "border-gray-300 hover:border-gray-400 bg-gray-50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          disabled={disabled || isLoading}
          className="hidden"
        />
        
        {file ? (
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-500">Arquivo selecionado</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
              <Upload className={`w-6 h-6 ${isDragging ? "text-blue-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isDragging ? "Solte o arquivo aqui" : "Arraste um arquivo CSV ou clique para selecionar"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Apenas arquivos .csv</p>
            </div>
          </div>
        )}
      </div>

      {/* Validação local */}
      {localValidation && (
        <div className={`p-4 rounded-xl border ${
          localValidation.valid 
            ? "bg-green-50 border-green-200" 
            : "bg-red-50 border-red-200"
        }`}>
          {localValidation.valid ? (
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800">
                  Estrutura valida
                </p>
                <p className="text-sm text-green-600 mt-0.5">
                  {localValidation.rowCount} linha(s) de dados prontas para importar
                </p>
                {localValidation.warnings.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 text-yellow-700 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">Avisos:</span>
                    </div>
                    <ul className="text-sm text-yellow-600 space-y-1 ml-6">
                      {localValidation.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-red-800">Problemas encontrados</p>
                <ul className="mt-2 space-y-1.5">
                  {localValidation.errors.map((error, i) => (
                    <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 mt-1.5 bg-red-400 rounded-full flex-shrink-0"></span>
                      {error}
                    </li>
                  ))}
                </ul>
                {localValidation.warnings.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 text-yellow-700 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">Avisos:</span>
                    </div>
                    <ul className="text-sm text-yellow-600 space-y-1 ml-6">
                      {localValidation.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Erro de estrutura do backend */}
      {structureError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-red-800">
                {structureError.message || "Erro na estrutura do CSV"}
              </p>
              {structureError.errors && (
                <ul className="mt-2 space-y-1">
                  {structureError.errors.map((err: string, i: number) => (
                    <li key={i} className="text-sm text-red-600">{err}</li>
                  ))}
                </ul>
              )}
              {structureError.missingRequired?.length > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  Colunas faltando: <span className="font-medium">{structureError.missingRequired.join(", ")}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || isLoading || disabled || !localValidation?.valid}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Importar CSV
            </>
          )}
        </button>

        {(file || importResult || localValidation) && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Limpar
          </button>
        )}
      </div>

      {/* Resultado da importação */}
      {importResult && (
        <div className={`p-5 rounded-xl border-2 ${
          importResult.success 
            ? "bg-green-50 border-green-300" 
            : "bg-amber-50 border-amber-300"
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-full ${importResult.success ? "bg-green-100" : "bg-amber-100"}`}>
              {importResult.success ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <h4 className={`text-lg font-semibold ${importResult.success ? "text-green-800" : "text-amber-800"}`}>
                Importacao Concluida
              </h4>
              <p className="text-gray-600 mt-1">{importResult.message}</p>
              
              {/* Stats */}
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-green-700">{importResult.insertedCount}</span> inseridos
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-red-700">{importResult.errorCount}</span> erros
                  </span>
                </div>
              </div>

              {/* Lista de erros por linha */}
              {importResult.errorRows.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-red-700 mb-2">
                    Detalhes dos erros ({importResult.errorRows.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200">
                    <table className="w-full text-sm">
                      <thead className="bg-red-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-red-800 font-medium w-20">Linha</th>
                          <th className="px-3 py-2 text-left text-red-800 font-medium">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {importResult.errorRows.map((errorRow: CsvErrorRow, index: number) => (
                          <tr key={index} className="border-t border-red-100 hover:bg-red-50">
                            <td className="px-3 py-2 font-mono text-red-600 font-medium">{errorRow.row}</td>
                            <td className="px-3 py-2 text-red-600">{errorRow.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botão de concluir quando importação foi bem-sucedida */}
              {importResult.errorCount === 0 && onSuccess && (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      resetAll();
                      onSuccess();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all shadow-md"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Concluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CsvImporter;
