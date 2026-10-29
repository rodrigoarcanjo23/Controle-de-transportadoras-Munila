// Listas e mapeamentos usados em todo o sistema. Centralizados aqui para que
// um novo status/modal/UF seja adicionado em um só lugar.

export type Tone =
  | 'green' | 'red' | 'amber' | 'orange' | 'blue' | 'purple'
  | 'pink' | 'indigo' | 'teal' | 'yellow' | 'slate' | 'brand';

export const STATUS_ENTREGA = [
  'Pendente', 'Pendente agendamento', 'Aguardando coleta', 'Solicitado Agendamento',
  'Agendado', 'Em Transporte', 'Entregue', 'Atrasado', 'Problema', 'Reagendado',
  'Em devolução', 'Devolvido', 'Devolução', 'Frete Conferido',
] as const;

export const STATUS_DEVOLUCAO = [
  'Pendente', 'Lançada', 'Emitida', 'Solic. Coleta', 'Coletada',
  'Coletada pelo representante.', 'Aguardando Chegada', 'Chegou no Galpão', 'Entregue', 'Recusa',
] as const;

export const SITUACOES_CTE = ['ABERTO', 'FECHADO', 'OUTROS'] as const;

/** Grupos usados pelo BI ao clicar em "Resumo de Operação". */
export const GRUPO_EM_ANDAMENTO = [
  'Pendente', 'Pendente agendamento', 'Aguardando coleta', 'Solicitado Agendamento',
  'Agendado', 'Em Transporte', 'Frete Conferido',
];
export const GRUPO_CRITICO = ['Atrasado', 'Problema', 'Em devolução'];

const STATUS_TONE: Record<string, Tone> = {
  'Entregue': 'green',
  'Atrasado': 'red',
  'Em Transporte': 'blue',
  'Agendado': 'purple',
  'Devolução': 'pink',
  'Solicitado Agendamento': 'yellow',
  'Pendente agendamento': 'pink',
  'Aguardando coleta': 'amber',
  'Pendente': 'orange',
  'Frete Conferido': 'indigo',
  'Aguardando Chegada': 'amber',
  'Chegou no Galpão': 'green',
  'Coletada': 'blue',
  'Solic. Coleta': 'yellow',
  'Recusa': 'red',
  'Coletada pelo representante.': 'purple',
  'Lançada': 'teal',
  'Emitida': 'teal',
  'Problema': 'red',
  'Reagendado': 'amber',
  'Em devolução': 'orange',
  'Devolvido': 'slate',
  // CTE
  'FECHADO': 'green',
  'ABERTO': 'orange',
  'OUTROS': 'slate',
  // Auditoria
  'CRIOU': 'green',
  'EDITOU': 'yellow',
  'APAGOU': 'red',
  // Perfis
  'Administrador': 'purple',
  'Operador': 'blue',
};

export function toneOf(value?: string | null): Tone {
  return (value && STATUS_TONE[value]) || 'slate';
}

export const MODAIS = [
  { value: 'AÉREO', label: 'Aéreo' },
  { value: 'RODOVIÁRIO', label: 'Rodoviário' },
  { value: 'PAC', label: 'PAC' },
  { value: 'SEDEX', label: 'Sedex' },
];

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const REGIOES: Record<string, string[]> = {
  'Norte': ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
  'Sul': ['PR', 'RS', 'SC'],
};

export const MODULOS_LOG = [
  { value: 'ENTREGAS', label: 'Entregas' },
  { value: 'CLIENTES', label: 'Clientes' },
  { value: 'EQUIPE', label: 'Equipe' },
  { value: 'TRANSPORTADORAS', label: 'Transportadoras' },
  { value: 'DEVOLUCOES', label: 'Devoluções' },
  { value: 'CTES', label: 'Registro de CTE' },
  { value: 'INDICADORES', label: 'Indicadores Diários' },
  { value: 'ALERTAS', label: 'Alertas' },
  { value: 'FECHAMENTO', label: 'Fechamento mensal' },
  { value: 'FATURAS', label: 'Faturas de frete' },
];

/** SLA (dias desde o faturamento) usado na Visão Logística. */
export const SLA_ALERTA_DIAS = 7;
export const SLA_CRITICO_DIAS = 15;
