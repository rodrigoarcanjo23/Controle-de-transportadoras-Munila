import {
  LayoutDashboard, ChartPie, DollarSign, Map, Users, UserSquare2, Truck,
  RefreshCcw, Calculator, FileText, ShieldAlert, Warehouse, Bell, PackageCheck, ReceiptText, Award, Package, type LucideIcon,
} from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; admin?: boolean }
export interface NavGroup { label: string; items: NavItem[] }

/** Menu agrupado por rotina de trabalho. `admin` = visível só para administradores. */
export const NAV: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { to: '/dashboard', label: 'Painel de Entregas', icon: LayoutDashboard },
      { to: '/alertas', label: 'Alertas', icon: Bell },
      { to: '/expedicao', label: 'Expedição', icon: PackageCheck },
      { to: '/logistica', label: 'Logística & SLA', icon: Map },
      { to: '/ctes', label: 'Registro de CTE', icon: FileText, admin: true },
      { to: '/devolucoes', label: 'Devoluções', icon: RefreshCcw, admin: true },
      { to: '/calculadora', label: 'Simulador de frete', icon: Calculator },
    ],
  },
  {
    label: 'Armazém',
    items: [
      { to: '/indicadores', label: 'Indicadores Diários', icon: Warehouse },
    ],
  },
  {
    label: 'Análise',
    items: [
      { to: '/analise', label: 'Painel de BI', icon: ChartPie },
      { to: '/financeiro', label: 'Gestão Financeira', icon: DollarSign },
      { to: '/faturas', label: 'Faturas de frete', icon: ReceiptText },
      { to: '/avaliacao', label: 'Avaliação mensal', icon: Award },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/clientes', label: 'Clientes & Metas', icon: UserSquare2, admin: true },
      { to: '/transportadoras', label: 'Transportadoras', icon: Truck, admin: true },
      { to: '/produtos', label: 'Produtos', icon: Package, admin: true },
    ],
  },
  {
    label: 'Administração',
    items: [
      { to: '/equipe', label: 'Equipe', icon: Users, admin: true },
      { to: '/auditoria', label: 'Auditoria', icon: ShieldAlert, admin: true },
    ],
  },
];

export const tituloDaRota = (path: string) =>
  NAV.flatMap((g) => g.items).find((i) => path.startsWith(i.to))?.label ?? 'MunilaLog';
