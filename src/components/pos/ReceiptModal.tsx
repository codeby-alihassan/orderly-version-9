import React from 'react';
import { X, Printer, CheckCircle2, ShoppingBag } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SaleDetail } from '../../types';
import { format12HourDateTime } from '../../lib/dateUtils';

interface ReceiptModalProps {
  sale: SaleDetail | null;
  onClose: () => void;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose, onNewSale }) => {
  const { settings, formatMoney } = useApp();

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-stone-900 text-sm">Sale Completed Successfully</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Area */}
        <div id="thermal-receipt" className="p-6 overflow-y-auto font-mono text-xs text-stone-900 space-y-4">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-300">
            <div className="font-bold text-base tracking-tight">{settings.shop_name}</div>
            <div className="text-[11px] text-stone-500 font-sans">{settings.shop_address}</div>
            <div className="text-[11px] text-stone-500 font-sans">Tel: {settings.shop_phone}</div>
            <div className="pt-2 text-xs font-bold uppercase tracking-wider text-stone-700">
              Tax Invoice / Retail Receipt
            </div>
          </div>

          <div className="text-[11px] space-y-1 text-stone-600 border-b border-dashed border-stone-300 pb-2">
            <div className="flex justify-between">
              <span>Invoice #:</span>
              <span className="font-bold text-stone-900">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span>{format12HourDateTime(sale.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{sale.cashierName}</span>
            </div>
            {sale.customerName && (
              <div className="flex justify-between font-medium text-stone-900">
                <span>Customer (Credit):</span>
                <span>{sale.customerName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold uppercase text-stone-900">{sale.paymentMethod}</span>
            </div>
          </div>

          {/* Line items table */}
          <div className="space-y-1.5 border-b border-dashed border-stone-300 pb-3">
            <div className="flex justify-between font-bold text-stone-500 text-[10px] uppercase pb-1 border-b border-stone-200">
              <span>Item Description</span>
              <span>Total</span>
            </div>
            {sale.items.map((it, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="font-medium text-stone-900">{it.productName}</div>
                <div className="flex justify-between text-stone-500 text-[11px]">
                  <span>
                    {it.quantity} x {formatMoney(it.unitPrice)}
                  </span>
                  <span className="font-semibold text-stone-900">{formatMoney(it.totalPrice)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-xs text-stone-700 border-b border-dashed border-stone-300 pb-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{formatMoney(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-{formatMoney(sale.discount)}</span>
              </div>
            )}
            {sale.tax > 0 && (
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>+{formatMoney(sale.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-stone-900 pt-1 border-t border-stone-200">
              <span>GRAND TOTAL:</span>
              <span>{formatMoney(sale.grandTotal)}</span>
            </div>
          </div>

          <div className="text-center pt-2 text-[10px] text-stone-400 font-sans space-y-0.5">
            <div>Thank you for shopping with us!</div>
            <div>Please keep this receipt for return or exchange.</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-stone-500" />
            <span>Print Receipt</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
            {onNewSale && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                Start New Sale
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
