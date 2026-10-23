import { createElement, type ReactNode } from 'react';
import { CircleCheck, MapPin, RefreshCcw, ShieldCheck, Sparkles, Target, TrendingUp, Truck, Warehouse, type LucideIcon } from 'lucide-react';
import { Evolucao, Resumo, Servico, type CtxSecao, type DadosBI } from './Secoes';
import { ClientesMetas, Destinos, Transportadoras } from './SecoesEtapa2';
import { Armazem, Devolucoes, Qualidade } from './SecoesEtapa3';

export interface Secao {
  id: string; titulo: string; icone: LucideIcon; render: (x: CtxSecao) => ReactNode;
  /** só na tela (fora da apresentação e do PDF) */
  interno?: boolean;
  /** quando falso, o bloco é pulado na apresentação e no PDF (ex.: sem dados no período) */
  temDados?: (d: DadosBI) => boolean;
}

/** Ordem dos blocos = ordem da apresentação e das páginas do PDF. */
export const SECOES: Secao[] = [
  { id: 'resumo', titulo: 'Resumo do período', icone: Sparkles, render: (x) => createElement(Resumo, x) },
  { id: 'servico', titulo: 'Prazo e nível de serviço', icone: CircleCheck, render: (x) => createElement(Servico, x) },
  { id: 'evolucao', titulo: 'Evolução do faturamento e do frete', icone: TrendingUp, render: (x) => createElement(Evolucao, x) },
  { id: 'transportadoras', titulo: 'Ranking de transportadoras', icone: Truck, render: (x) => createElement(Transportadoras, x) },
  { id: 'clientes', titulo: 'Clientes e metas de frete', icone: Target, render: (x) => createElement(ClientesMetas, x) },
  { id: 'destinos', titulo: 'Destinos', icone: MapPin, render: (x) => createElement(Destinos, x) },
  { id: 'armazem', titulo: 'Armazém', icone: Warehouse, render: (x) => createElement(Armazem, x), temDados: (d) => !!d.armazem?.totalDias },
  { id: 'devolucoes', titulo: 'Devoluções', icone: RefreshCcw, render: (x) => createElement(Devolucoes, x), temDados: (d) => d.dev.qtd > 0 },
  { id: 'qualidade', titulo: 'Qualidade dos dados', icone: ShieldCheck, render: (x) => createElement(Qualidade, x), interno: true },
];

/** Blocos que entram na apresentação e no PDF. */
export const secoesApresentaveis = (d: DadosBI) => SECOES.filter((s) => !s.interno && (!s.temDados || s.temDados(d)));
