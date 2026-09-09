import React, { useEffect, useState } from 'react';
import { X, Play, Trash2, Clock, ShoppingCart } from 'lucide-react';
import { api } from '../../lib/api';
import { HeldOrder } from '../../types';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Toast';
import { format12HourTime } from '../../lib/dateUtils';

interface HeldOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreCart: (cartData: any) => void;
}

export const HeldOrdersDrawer: React.FC<HeldOrdersDrawerProps> = ({ isOpen, onClose, onRestoreCart }) => {
  const { formatMoney, refreshHeldOrdersCount } = useApp();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<HeldOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await api.getHeldOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching held orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (order: HeldOrder) => {
    try {
      await api.deleteHeldOrder(order.id);
      onRestoreCart(order.cartData);
      await refreshHeldOrdersCount();
      showToast(`Restored "${order.referenceName}" to cart`);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore order', 'error');
    }
  };

  const handleDelete = async (orderId: string, name: string) => {
    try {
      await api.deleteHeldOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      await refreshHeldOrdersCount();
      showToast(`Deleted held order "${name}"`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete order', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-stone-900 text-sm">Held Orders ({orders.length})</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-stone-500">Loading held orders...</div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-xs text-stone-500">
              <Clock className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="font-medium text-stone-700">No Orders On Hold</p>
              <p className="mt-0.5 text-[11px] text-stone-400">
                You can hold carts from the POS terminal to serve other customers.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const items = order.cartData?.items || [];
              const totalAmount = items.reduce((sum: number, it: any) => sum + (it.totalPrice || 0), 0);

              return (
                <div
                  key={order.id}
                  className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-stone-900 text-xs">{order.referenceName}</h4>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        {format12HourTime(order.createdAt)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs text-orange-600">
                      {formatMoney(totalAmount)}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] text-stone-600 border-t border-stone-200/60 pt-2 space-y-0.5">
                    {items.slice(0, 3).map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate max-w-[200px]">{it.product?.name || 'Item'}</span>
                        <span className="text-stone-400 font-mono">x{it.quantity}</span>
                      </div>
                    ))}
                    {items.length > 3 && (
                      <div className="text-[10px] text-stone-400 italic">
                        +{items.length - 3} more items...
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(order.id, order.referenceName)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Discard held order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(order)}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Restore to Cart</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
