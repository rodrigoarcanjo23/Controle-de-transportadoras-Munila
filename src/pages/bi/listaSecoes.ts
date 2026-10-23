import { createElement, type ReactNode } from 'react';
import { CircleCheck, MapPin, Sparkles, Target, TrendingUp, Truck, type LucideIcon } from 'lucide-react';
import { Evolucao, Resumo, Servico, type CtxSecao } from './Secoes';
import { ClientesMetas, Destinos, Transportadoras } from './SecoesEtapa2';

export interface Secao { id: string; titulo: string; icone: LucideIcon; render: (x: CtxSecao) => ReactNode }

/** Ordem dos blocos = ordem da apresentação e das páginas do PDF. */
export const SECOES: Secao[] = [
  { id: 'resumo', titulo: 'Resumo do período', icone: Sparkles, render: (x) => createElement(Resumo, x) },
  { id: 'servico', titulo: 'Prazo e nível de serviço', icone: CircleCheck, render: (x) => createElement(Servico, x) },
  { id: 'evolucao', titulo: 'Evolução do faturamento e do frete', icone: TrendingUp, render: (x) => createElement(Evolucao, x) },
  { id: 'transportadoras', titulo: 'Ranking de transportadoras', icone: Truck, render: (x) => createElement(Transportadoras, x) },
  { id: 'clientes', titulo: 'Clientes e metas de frete', icone: Target, render: (x) => createElement(ClientesMetas, x) },
  { id: 'destinos', titulo: 'Destinos', icone: MapPin, render: (x) => createElement(Destinos, x) },
];
