import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Package,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { ChartDataPoint, PaymentBreakdown, TopProduct, DashboardStats } from '../../types';

export const AnalyticsView: React.FC = () => {
  const { formatMoney } = useApp();

  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentBreakdown[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadAnalytics() {
      setIsLoading(true);
      try {
        const [charts, payments, tops, dash] = await Promise.all([
          api.getChartData(dateRange, customStart, customEnd),
          api.getPaymentBreakdown(dateRange, customStart, customEnd),
          api.getTopProducts(),
          api.getDashboardStats(),
        ]);
        setChartData(charts);
        setPaymentData(payments);
        setTopProducts(tops);
        setStats(dash);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadAnalytics();
  }, [dateRange, customStart, customEnd]);

  // Calculations across charts
  const totalSales = chartData.reduce((sum, d) => sum + d.sales, 0);
  const totalProfit = chartData.reduce((sum, d) => sum + d.profit, 0);
  const totalExpenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
  const totalOrders = chartData.reduce((sum, d) => sum + d.orders, 0);

  const profitMarginPercent = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0';
  const averageOrderValue = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : '0';
  const expenseRatio = totalSales > 0 ? ((totalExpenses / totalSales) * 100).toFixed(1) : '0';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
      {/* Header & Date Range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Financial Reports & Analytics</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            P&L trends, gross margins, payment method shares, and item profitability
          </p>
        </div>

        <div className="flex items-center bg-stone-100 p-1 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setDateRange('today')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              dateRange === 'today' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDateRange('7d')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              dateRange === '7d' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setDateRange('30d')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              dateRange === '30d' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => setDateRange('custom')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              dateRange === 'custom' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {dateRange === 'custom' && (
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded"
            />
          </div>
        </div>
      )}

      {/* Financial Health Ratio Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Total Period Sales</span>
          <div className="mt-1 text-2xl font-bold font-mono text-stone-900">{formatMoney(totalSales)}</div>
          <span className="text-[11px] text-stone-400 font-medium">{totalOrders} invoices processed</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Gross Profit Margin</span>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-600">{profitMarginPercent}%</div>
          <span className="text-[11px] text-stone-400 font-medium">Net Profit: {formatMoney(totalProfit)}</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Average Order Value (AOV)</span>
          <div className="mt-1 text-2xl font-bold font-mono text-stone-900">
            {formatMoney(Number(averageOrderValue))}
          </div>
          <span className="text-[11px] text-stone-400 font-medium">Revenue per transaction</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-xs font-medium text-stone-500">Operating Expense Ratio</span>
          <div className="mt-1 text-2xl font-bold font-mono text-stone-900">{expenseRatio}%</div>
          <span className="text-[11px] text-stone-400 font-medium">Total Expenses: {formatMoney(totalExpenses)}</span>
        </div>
      </div>

      {/* Primary Chart: Sales, Profit & Expenses */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Revenue & Profit Breakdown</h3>
            <p className="text-xs text-stone-400">Comparing gross revenue with margin profitability</p>
          </div>
        </div>

        <div className="h-80 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-stone-400">
              No sales data recorded in this timeframe.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                <Bar dataKey="sales" name="Gross Sales" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Gross Margin" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two-column Layout: Payment Share & Product Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Payment Breakdown</h3>
            <p className="text-xs text-stone-400">Revenue split across Cash, Bank, and Credit</p>
          </div>

          <div className="space-y-4 pt-2">
            {paymentData.map((pm) => (
              <div key={pm.key} className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-stone-800">{pm.method}</span>
                  <span className="font-mono font-bold text-stone-900">
                    {formatMoney(pm.total)} <span className="font-normal text-stone-400">({pm.percentage}%)</span>
                  </span>
                </div>
                <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pm.percentage}%`, backgroundColor: pm.color }}
                  />
                </div>
                <div className="text-[11px] text-stone-400 text-right">{pm.count} transactions completed</div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Performance */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Most Profitable Products</h3>
            <p className="text-xs text-stone-400">Items yielding the highest net margins</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-100 text-stone-400 uppercase text-[10px]">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {topProducts.slice(0, 5).map((p) => (
                  <tr key={p.productId}>
                    <td className="py-2.5 font-semibold text-stone-900">{p.productName}</td>
                    <td className="py-2.5 text-right font-mono text-stone-600">{p.totalQuantity}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-stone-900">
                      {formatMoney(p.totalRevenue)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-emerald-600">
                      +{formatMoney(p.totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
