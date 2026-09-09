import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Users,
  Package,
  AlertTriangle,
  XCircle,
  Receipt,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Truck,
  Plus,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { DashboardStats, ChartDataPoint, PaymentBreakdown, TopProduct } from '../../types';

export const DashboardView: React.FC = () => {
  const {
    formatMoney,
    setActiveTab,
    setIsOpenCounterModalOpen,
    setIsCloseCounterModalOpen,
    activeCash,
  } = useApp();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartRange, setChartRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [dashStats, charts, payments, tops] = await Promise.all([
        api.getDashboardStats(),
        api.getChartData(chartRange),
        api.getPaymentBreakdown(chartRange),
        api.getTopProducts(),
      ]);
      setStats(dashStats);
      setChartData(charts);
      setPaymentBreakdown(payments);
      setTopProducts(tops);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [chartRange]);

  const isCounterOpen = Boolean(activeCash?.session);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header & Quick Action Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Store Overview & Operations</h2>
          <p className="text-xs text-stone-500 mt-0.5">Real-time sales, inventory valuation, and cash health</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className="px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Truck className="w-4 h-4 text-stone-500" />
            <span>New Purchase</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isCounterOpen) {
                setIsCloseCounterModalOpen(true);
              } else {
                setIsOpenCounterModalOpen(true);
              }
            }}
            className={`px-3 py-2 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs ${
              isCounterOpen
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>{isCounterOpen ? 'Close Drawer' : 'Open Drawer'}</span>
          </button>
        </div>
      </div>

      {/* 8 Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Today's Sales</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-stone-900">
              {formatMoney(stats?.todaySales || 0)}
            </div>
            <span className="text-[11px] text-stone-400 font-medium">
              {stats?.todayOrders || 0} invoices finalized today
            </span>
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Today's Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-emerald-600">
              {formatMoney(stats?.todayProfit || 0)}
            </div>
            <span className="text-[11px] text-stone-400 font-medium">Margin after COGS</span>
          </div>
        </div>

        {/* Current Physical Cash */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Current Cash in Drawer</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-amber-700">
              {formatMoney(stats?.currentCash || 0)}
            </div>
            <span className="text-[11px] text-stone-400 font-medium">
              {isCounterOpen ? 'Active Counter Session' : 'Counter Currently Closed'}
            </span>
          </div>
        </div>

        {/* Total Credit Due */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Outstanding Credit</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-purple-700">
              {formatMoney(stats?.totalCredit || 0)}
            </div>
            <button
              onClick={() => setActiveTab('credit')}
              className="text-[11px] text-purple-600 hover:underline font-medium block"
            >
              View customer ledgers →
            </button>
          </div>
        </div>

        {/* Today's Expenses */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Today's Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-red-600">
              {formatMoney(stats?.todayExpenses || 0)}
            </div>
            <button
              onClick={() => setActiveTab('expenses')}
              className="text-[11px] text-stone-400 hover:text-stone-600 font-medium block"
            >
              Manage operational expenses →
            </button>
          </div>
        </div>

        {/* Total Products & Valuation */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Inventory Valuation</span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-stone-900">
              {formatMoney(stats?.totalStockValue || 0)}
            </div>
            <span className="text-[11px] text-stone-400 font-medium">
              Across {stats?.totalProducts || 0} active SKU catalog items
            </span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Low Stock Alert</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-amber-700">
              {stats?.lowStock || 0} <span className="text-xs font-normal text-stone-500">items</span>
            </div>
            <button
              onClick={() => setActiveTab('products')}
              className="text-[11px] text-amber-600 hover:underline font-medium block"
            >
              Reorder stock needed →
            </button>
          </div>
        </div>

        {/* Out of Stock Alerts */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Out of Stock</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-red-700">
              {stats?.outOfStock || 0} <span className="text-xs font-normal text-stone-500">items</span>
            </div>
            <button
              onClick={() => setActiveTab('purchases')}
              className="text-[11px] text-red-600 hover:underline font-medium block"
            >
              Restock immediately →
            </button>
          </div>
        </div>
      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Revenue, Profit & Expenses Trend</h3>
              <p className="text-xs text-stone-400">Financial flow across selected period</p>
            </div>

            {/* Time range selector */}
            <div className="flex items-center bg-stone-100 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setChartRange('today')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  chartRange === 'today' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setChartRange('7d')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  chartRange === '7d' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setChartRange('30d')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  chartRange === '30d' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-stone-400">
                No transaction data for this time period yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [formatMoney(val), '']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Gross Sales"
                    stroke="#f97316"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Net Profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#profitGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="none"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Payment Methods Share</h3>
            <p className="text-xs text-stone-400">Cash vs Bank Transfer vs Credit</p>

            <div className="mt-5 space-y-4">
              {paymentBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">No payment data recorded yet.</div>
              ) : (
                paymentBreakdown.map((pm) => (
                  <div key={pm.key} className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-stone-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pm.color }} />
                        {pm.method}
                      </span>
                      <span className="font-mono font-semibold text-stone-900">
                        {formatMoney(pm.total)}{' '}
                        <span className="text-stone-400 font-normal">({pm.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pm.percentage}%`, backgroundColor: pm.color }}
                      />
                    </div>
                    <div className="text-[10px] text-stone-400 text-right">{pm.count} transactions</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-stone-100 text-xs text-stone-500">
            <div className="flex justify-between">
              <span>Total Volume:</span>
              <span className="font-mono font-bold text-stone-900">
                {formatMoney(paymentBreakdown.reduce((sum, p) => sum + p.total, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Top Performing Products</h3>
            <p className="text-xs text-stone-400">Highest sales quantity and revenue contributors</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className="text-xs text-orange-600 hover:text-orange-700 font-medium"
          >
            View all catalog →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 uppercase tracking-wider text-[10px]">
                <th className="pb-2.5 font-semibold">Product Name</th>
                <th className="pb-2.5 font-semibold">SKU</th>
                <th className="pb-2.5 font-semibold text-right">Units Sold</th>
                <th className="pb-2.5 font-semibold text-right">Revenue</th>
                <th className="pb-2.5 font-semibold text-right">Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-400">
                    No sales recorded yet. Start ringing sales on the POS terminal!
                  </td>
                </tr>
              ) : (
                topProducts.map((p) => (
                  <tr key={p.productId} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 font-semibold text-stone-900">{p.productName}</td>
                    <td className="py-3 font-mono text-stone-500">{p.sku}</td>
                    <td className="py-3 text-right font-mono font-semibold text-stone-800">
                      {p.totalQuantity}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-stone-900">
                      {formatMoney(p.totalRevenue)}
                    </td>
                    <td className="py-3 text-right font-mono text-emerald-600 font-semibold">
                      +{formatMoney(p.totalProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
