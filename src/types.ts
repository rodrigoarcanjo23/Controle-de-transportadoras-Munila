// Tipos das entidades do banco (Supabase). Campos opcionais porque o banco
// aceita nulos na maioria das colunas.

export type ID = string;
export type Num = number | string | null | undefined;

export interface Cliente {
  id: ID;
  nome: string;
  cnpj_cpf?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
  exige_agendamento?: boolean | null;
  /** recebe os e-mails automáticos de coletado/entregue */
  recebe_avisos?: boolean | null;
}

export interface Transportadora {
  id: ID;
  nome: string;
  cnpj_cpf?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  modal_padrao?: string | null;
  telefone?: string | null;
  email?: string | null;
}

export interface Entrega {
  id: ID;
  nota_fiscal: string;
  cliente_id: ID;
  transportadora_id?: ID | null;
  cidade_destino?: string | null;
  uf_destino?: string | null;
  modal_frete?: string | null;
  data_entrada_pedido?: string | null;
  data_faturamento?: string | null;
  data_coleta?: string | null;
  valor_nf?: Num;
  valor_frete?: Num;
  valor_frete_real?: Num;
  volume?: Num;
  volume_peso?: string | null;
  peso_kg?: Num;
  tem_agendamento?: boolean | null;
  data_previsao?: string | null;
  data_entrega_agendamento?: string | null;
  observacoes?: string | null;
  status: string;
  frete_confirmado?: boolean | null;
  /** código secreto do link de rastreio para o cliente */
  rastreio_token?: string | null;
  created_at?: string;
  clientes?: Partial<Cliente> | null;
  transportadoras?: Partial<Transportadora> | null;
}

export interface MetaFrete {
  id: ID;
  cliente_id: ID;
  transportadora_id: ID;
  meta_percentual: number;
  clientes?: { nome?: string } | null;
  transportadoras?: { nome?: string } | null;
}

export interface Produto {
  id: ID;
  codigo?: string;
  nome: string;
  unidades_por_caixa: number;
  peso_caixa_kg: number;
  medidas_cm?: string | null;
  /* campos do cadastro completo (supabase/produtos.sql) */
  ean?: string | null;
  comprimento_cm?: number | null;
  largura_cm?: number | null;
  altura_cm?: number | null;
  peso_unitario_kg?: number | null;
  preco_unitario?: number | null;
  ativo?: boolean | null;
  observacao?: string | null;
}

export type NivelAcesso = 'Operador' | 'Administrador';

export interface Perfil {
  id: ID;
  nome: string;
  email: string;
  cargo: string;
  nivel_acesso: NivelAcesso | string;
}

export interface Devolucao {
  id: ID;
  data_emissao?: string | null;
  data_coleta?: string | null;
  data_previsao?: string | null;
  data_chegada?: string | null;
  cliente_id: ID;
  transportadora_cliente?: string | null;
  transportadora_id?: ID | null;
  nf_venda?: string | null;
  notas_fiscais: string;
  valor_total_nf?: Num;
  volume?: Num;
  peso_kg?: Num;
  valor_frete_reverso?: Num;
  motivo?: string | null;
  status: string;
  created_at?: string;
  clientes?: { nome?: string; cnpj_cpf?: string } | null;
  transportadoras?: { nome?: string } | null;
}

export interface Cte {
  id: ID;
  numero_documento: string;
  chave_acesso?: string | null;
  razao_social_emitente?: string | null;
  cnpj_emitente?: string | null;
  cfop?: string | null;
  valor_total_servico?: Num;
  situacao: string;
  data_emissao?: string | null;
  observacao?: string | null;
  created_at?: string;
}

export type AcaoLog = 'CRIOU' | 'EDITOU' | 'APAGOU';
export type ModuloLog = 'ENTREGAS' | 'CLIENTES' | 'EQUIPE' | 'TRANSPORTADORAS' | 'DEVOLUCOES' | 'CTES' | 'INDICADORES' | 'ALERTAS' | 'FECHAMENTO' | 'FATURAS' | 'PRODUTOS';

export interface LogAuditoria {
  id: ID;
  usuario_email: string;
  acao: AcaoLog | string;
  modulo: ModuloLog | string;
  detalhes: string;
  criado_em: string;
}
