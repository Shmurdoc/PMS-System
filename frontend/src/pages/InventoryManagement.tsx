import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, ShoppingCart, Plus, Search,
  AlertTriangle, Edit, Trash2, Download,
  CheckCircle, PackageCheck, Truck,
  DollarSign, Calculator, CreditCard, Receipt, X, Save, RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { InventoryItem } from '../store/useAppStore';
import toastHelpers from '../lib/toast';
import { exportInventoryToCsv } from '../utils/exportCsv';
import { newId } from '../utils/id';

const CATEGORIES = ['All', 'Linens', 'Toiletries', 'Kitchen', 'F&B', 'Maintenance', 'Office'];

const emptyForm: Omit<InventoryItem, 'id'> = {
  name: '',
  category: 'Linens',
  quantity: 0,
  unit: 'pieces',
  reorderLevel: 10,
  price: 0,
  supplier: '',
  sku: '',
  location: '',
  notes: '',
};

export default function InventoryManagement() {
  const {
    inventory, addInventoryItem, updateInventory, deleteInventoryItem,
    addExpense, addAuditLog, user,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'inventory' | 'pos' | 'suppliers'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showPos, setShowPos] = useState(false);
  const [showRestock, setShowRestock] = useState<string | null>(null);
  const [showPurchaseOrder, setShowPurchaseOrder] = useState<string | null>(null);

  // Forms
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>(emptyForm);
  const [restockQty, setRestockQty] = useState(0);
  const [poQuantities, setPoQuantities] = useState<Record<string, number>>({});

  // POS
  const [cart, setCart] = useState<{ item: InventoryItem; qty: number }[]>([]);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = inventory.filter(i => i.quantity <= i.reorderLevel);
  const totalValue = inventory.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  // Derived suppliers
  const suppliers = useMemo(() => {
    const supplierMap = new Map<string, { name: string; items: InventoryItem[] }>();
    for (const item of inventory) {
      if (!item.supplier) continue;
      const existing = supplierMap.get(item.supplier);
      if (existing) {
        existing.items.push(item);
      } else {
        supplierMap.set(item.supplier, { name: item.supplier, items: [item] });
      }
    }
    return Array.from(supplierMap.values());
  }, [inventory]);

  const currentUser = user?.name ?? 'System';
  const currentRole = user?.role ?? 'Staff';

  // Cart helpers
  const addToCart = (item: InventoryItem) => {
    const existing = cart.find(c => c.item.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { item, qty: 1 }]);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, c) => sum + (c.item.price * c.qty), 0);

  // Reset form
  const resetForm = () => {
    setFormData(emptyForm);
  };

  // =====================
  // HANDLERS
  // =====================

  const handleAddItem = () => {
    if (!formData.name.trim() || !formData.supplier.trim()) {
      toastHelpers.error('Validation Error', 'Name and Supplier are required');
      return;
    }
    if (formData.price <= 0) {
      toastHelpers.error('Validation Error', 'Price must be greater than zero');
      return;
    }
    const id = newId('INV');
    const newItem: InventoryItem = {
      ...formData,
      id,
      lastRestocked: new Date().toISOString().split('T')[0],
    };
    addInventoryItem(newItem);
    addAuditLog({
      id: newId('LOG'),
      action: 'create',
      entityType: 'inventory',
      entityId: id,
      entityName: newItem.name,
      userId: user?.id ?? '0',
      userName: currentUser,
      userRole: currentRole,
      details: `Added inventory item "${newItem.name}" (${newItem.quantity} ${newItem.unit})`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Item Added', `${newItem.name} has been added to inventory`);
    setShowAddItem(false);
    resetForm();
  };

  const handleEditItem = () => {
    if (!showEditItem) return;
    if (!formData.name.trim() || !formData.supplier.trim()) {
      toastHelpers.error('Validation Error', 'Name and Supplier are required');
      return;
    }
    if (formData.price <= 0) {
      toastHelpers.error('Validation Error', 'Price must be greater than zero');
      return;
    }
    updateInventory(showEditItem, formData);
    addAuditLog({
      id: newId('LOG'),
      action: 'update',
      entityType: 'inventory',
      entityId: showEditItem,
      entityName: formData.name,
      userId: user?.id ?? '0',
      userName: currentUser,
      userRole: currentRole,
      details: `Updated inventory item "${formData.name}"`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Item Updated', `${formData.name} has been updated`);
    setShowEditItem(null);
    resetForm();
  };

  const handleDeleteItem = () => {
    if (!showDeleteConfirm) return;
    const item = inventory.find(i => i.id === showDeleteConfirm);
    if (!item) return;
    deleteInventoryItem(showDeleteConfirm);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'delete',
      entityType: 'inventory',
      entityId: showDeleteConfirm,
      entityName: item.name,
      userId: user?.id ?? '0',
      userName: currentUser,
      userRole: currentRole,
      details: `Deleted inventory item "${item.name}"`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Item Deleted', `${item.name} has been removed from inventory`);
    setShowDeleteConfirm(null);
  };

  const handleRestock = () => {
    if (!showRestock) return;
    const item = inventory.find(i => i.id === showRestock);
    if (!item) return;
    if (restockQty <= 0) {
      toastHelpers.error('Invalid Quantity', 'Enter a quantity greater than zero');
      return;
    }
    const newQty = item.quantity + restockQty;
    updateInventory(showRestock, { quantity: newQty, lastRestocked: new Date().toISOString().split('T')[0] });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'inventory',
      entityId: showRestock,
      entityName: item.name,
      userId: user?.id ?? '0',
      userName: currentUser,
      userRole: currentRole,
      details: `Restocked "${item.name}" by ${restockQty} ${item.unit} (${item.quantity} → ${newQty})`,
      oldValue: String(item.quantity),
      newValue: String(newQty),
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Restocked', `${item.name} restocked by ${restockQty} ${item.unit}`);
    setShowRestock(null);
    setRestockQty(0);
  };

  const completeSale = (method: 'card' | 'cash') => {
    if (cart.length === 0) {
      toastHelpers.error('Cart Empty', 'Add items to the cart before completing a sale');
      return;
    }

    // Check stock availability
    for (const c of cart) {
      const current = inventory.find(i => i.id === c.item.id);
      if (!current || current.quantity < c.qty) {
        toastHelpers.error('Insufficient Stock', `"${c.item.name}" only has ${current?.quantity ?? 0} in stock but cart has ${c.qty}`);
        return;
      }
    }

    // Deduct quantities
    for (const c of cart) {
      const current = inventory.find(i => i.id === c.item.id);
      if (current) {
        updateInventory(c.item.id, { quantity: current.quantity - c.qty });
      }
    }

    const total = cartTotal;
    const itemNames = cart.map(c => `${c.item.name} x${c.qty}`).join(', ');

    addAuditLog({
      id: newId('LOG'),
      action: 'sale',
      entityType: 'inventory',
      entityId: newId('SALE'),
      entityName: 'POS Sale',
      userId: user?.id ?? '0',
      userName: currentUser,
      userRole: currentRole,
      details: `POS sale completed via ${method}: ${itemNames} — Total R${total.toFixed(2)}`,
      timestamp: new Date().toISOString(),
    });

    toastHelpers.success('Sale Complete', `R${total.toFixed(2)} paid by ${method}`);
    setCart([]);
    setShowPos(false);
  };

  const handleCreatePurchaseOrder = () => {
    if (!showPurchaseOrder) return;
    const supplierName = showPurchaseOrder;
    const supplierItems = inventory.filter(
      i => i.supplier === supplierName && i.quantity <= i.reorderLevel
    );
    const selectedItems = supplierItems.filter(i => (poQuantities[i.id] ?? 0) > 0);
    if (selectedItems.length === 0) {
      toastHelpers.error('No Items Selected', 'Select quantities for at least one item');
      return;
    }
    const totalCost = selectedItems.reduce((sum, i) => sum + (i.price * (poQuantities[i.id] ?? 0)), 0);
    const description = selectedItems.map(i => `${i.name} x${poQuantities[i.id]}`).join(', ');

    addExpense({
      id: newId('EXP'),
      category: 'Supplies',
      amount: totalCost,
      description: `Purchase Order — ${supplierName}: ${description}`,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      submittedBy: currentUser,
      vendor: supplierName,
      notes: `Auto-generated purchase order for low-stock items`,
    });

    addAuditLog({
      id: newId('LOG'),
      action: 'create',
      entityType: 'expense',
      entityId: newId('EXP'),
      entityName: `PO — ${supplierName}`,
      userId: user?.id ?? '0',
      userName: currentUser,
      userRole: currentRole,
      details: `Purchase order created for ${supplierName}: ${description} — R${totalCost.toFixed(2)}`,
      timestamp: new Date().toISOString(),
    });

    toastHelpers.success('Purchase Order Created', `Order for ${supplierName} — R${totalCost.toFixed(2)}`);
    setShowPurchaseOrder(null);
    setPoQuantities({});
  };

  const handleExportCsv = () => {
    const data = inventory.map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
      stock: i.quantity,
      min: i.reorderLevel,
      value: i.price * i.quantity,
    }));
    exportInventoryToCsv(data);
    toastHelpers.action.export();
  };

  const openEditModal = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      reorderLevel: item.reorderLevel,
      price: item.price,
      supplier: item.supplier,
      sku: item.sku ?? '',
      location: item.location ?? '',
      notes: item.notes ?? '',
    });
    setShowEditItem(item.id);
  };

  const openPurchaseOrder = (supplierName: string) => {
    const items = inventory.filter(i => i.supplier === supplierName && i.quantity <= i.reorderLevel);
    const defaults: Record<string, number> = {};
    for (const item of items) {
      defaults[item.id] = item.minOrderQuantity ?? (item.reorderLevel * 2 - item.quantity);
    }
    setPoQuantities(defaults);
    setShowPurchaseOrder(supplierName);
  };

  // =============================
  // FORM INPUT COMPONENT HELPER
  // =============================
  const inputClass = 'w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors';

  // =============================
  // INVENTORY FORM (shared for add/edit)
  // =============================
  const renderItemForm = (onSubmit: () => void, title: string) => (
    <>
      <div className="flex items-center justify-between p-5 border-b border-border/30">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={() => { if (showEditItem) { setShowEditItem(null); } else { setShowAddItem(false); } resetForm(); }} className="p-2 hover:bg-muted rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Name *</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} placeholder="Item name" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Category *</label>
            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className={inputClass}>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Quantity</label>
            <input type="number" min={0} value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Unit</label>
            <input type="text" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className={inputClass} placeholder="pieces, kg, liters..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Reorder Level</label>
            <input type="number" min={0} value={formData.reorderLevel} onChange={e => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Price (ZAR) *</label>
            <input type="number" min={0} step={0.01} value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Supplier *</label>
            <input type="text" required value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} className={inputClass} placeholder="Supplier name" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">SKU</label>
            <input type="text" value={formData.sku ?? ''} onChange={e => setFormData({ ...formData, sku: e.target.value })} className={inputClass} placeholder="SKU-001" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Location</label>
            <input type="text" value={formData.location ?? ''} onChange={e => setFormData({ ...formData, location: e.target.value })} className={inputClass} placeholder="Storage location" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Notes</label>
          <textarea rows={2} value={formData.notes ?? ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className={inputClass} placeholder="Additional notes..." />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => { if (showEditItem) { setShowEditItem(null); } else { setShowAddItem(false); } resetForm(); }} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
          <button onClick={onSubmit} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            {showEditItem ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory & POS</h1>
          <p className="text-muted-foreground">Manage stock, point-of-sale, and procurement</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowPos(true)}
            className="flex items-center gap-2 px-4 py-2 bg-success/15 text-success rounded-lg hover:bg-success/30 transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Open POS
          </button>
          <button
            onClick={() => { resetForm(); setShowAddItem(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/30">
        {(['inventory', 'pos', 'suppliers'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'pos' ? 'Point of Sale' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{inventory.length}</p>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
                  <PackageCheck className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{inventory.reduce((s, i) => s + i.quantity, 0)}</p>
                  <p className="text-sm text-muted-foreground">Total Units</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{lowStockItems.length}</p>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R{totalValue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                </div>
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-semibold text-warning">Low Stock Alert</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setRestockQty(0); setShowRestock(item.id); }}
                    className="px-3 py-1 bg-warning/15 text-warning rounded-full text-sm hover:bg-warning/30 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {item.name} ({item.quantity} left)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    categoryFilter === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border/30">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantity</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reorder Level</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Price</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supplier</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const isLow = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{item.category}</td>
                      <td className="py-3 px-4">
                        <span className={isLow ? 'text-warning font-medium' : ''}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{item.reorderLevel} {item.unit}</td>
                      <td className="py-3 px-4 font-medium">R{item.price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{item.supplier}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                          isLow ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'
                        }`}>
                          {isLow ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                          {isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditModal(item)} className="p-1.5 hover:bg-muted rounded transition-colors" title="Edit">
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {isLow && (
                            <button onClick={() => { setRestockQty(0); setShowRestock(item.id); }} className="p-1.5 hover:bg-success/15 rounded transition-colors" title="Restock">
                              <RefreshCw className="w-4 h-4 text-success" />
                            </button>
                          )}
                          <button onClick={() => addToCart(item)} className="p-1.5 hover:bg-muted rounded transition-colors" title="Add to Cart">
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(item.id)} className="p-1.5 hover:bg-danger/15 rounded transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4 text-danger" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredInventory.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No items found</p>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'pos' ? (
        /* POS Interface */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold mb-4">Products</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {inventory.map(item => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  disabled={item.quantity === 0}
                  className="p-4 bg-muted/30 border border-border/30 rounded-xl text-left hover:border-primary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-lg font-bold text-primary">R{item.price.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} in stock</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Cart ({cart.length})
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Cart is empty</p>
              ) : (
                cart.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.item.name}</p>
                      <p className="text-xs text-muted-foreground">R{c.item.price.toFixed(2)} x {c.qty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCart(cart.map((ct, idx) => idx === i ? { ...ct, qty: Math.max(1, ct.qty - 1) } : ct))}
                        className="w-6 h-6 bg-muted rounded flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{c.qty}</span>
                      <button
                        onClick={() => setCart(cart.map((ct, idx) => idx === i ? { ...ct, qty: ct.qty + 1 } : ct))}
                        className="w-6 h-6 bg-muted rounded flex items-center justify-center"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(i)}
                        className="w-6 h-6 bg-danger/15 rounded flex items-center justify-center hover:bg-danger/30 transition-colors"
                        title="Remove"
                      >
                        <X className="w-3 h-3 text-danger" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <div className="flex justify-between mb-4">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold">R{cartTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => completeSale('card')}
                    className="py-2.5 bg-success text-white rounded-lg hover:bg-green-600 hover:shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Card
                  </button>
                  <button
                    onClick={() => completeSale('cash')}
                    className="py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    Cash
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Suppliers (derived from inventory) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No suppliers found. Add inventory items with supplier info.</p>
            </div>
          ) : (
            suppliers.map((supplier, i) => {
              const lowItems = supplier.items.filter(it => it.quantity <= it.reorderLevel);
              const totalSupplied = supplier.items.reduce((s, it) => s + it.quantity, 0);
              return (
                <motion.div
                  key={supplier.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-xl p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{supplier.name}</h3>
                    {lowItems.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-warning/15 text-warning rounded-full">
                        {lowItems.length} low stock
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p className="flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      {supplier.items.length} item{supplier.items.length !== 1 ? 's' : ''} supplied
                    </p>
                    <p className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {totalSupplied} total units in stock
                    </p>
                    <p className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      R{supplier.items.reduce((s, it) => s + it.price * it.quantity, 0).toLocaleString()} total value
                    </p>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1.5">Items:</p>
                    <div className="flex flex-wrap gap-1">
                      {supplier.items.map(it => (
                        <span key={it.id} className={`text-xs px-2 py-0.5 rounded-full ${
                          it.quantity <= it.reorderLevel ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'
                        }`}>
                          {it.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openPurchaseOrder(supplier.name)}
                      disabled={lowItems.length === 0}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Create Order
                    </button>
                    <button
                      onClick={() => {
                        setCategoryFilter('All');
                        setSearchQuery(supplier.name);
                        setActiveTab('inventory');
                      }}
                      className="py-2 px-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      title="View items from this supplier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowAddItem(false); resetForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {renderItemForm(handleAddItem, 'Add New Item')}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Item Modal */}
      <AnimatePresence>
        {showEditItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowEditItem(null); resetForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {renderItemForm(handleEditItem, 'Edit Item')}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-danger/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-danger" />
                </div>
                <h3 className="font-bold mb-2">Delete Item</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Delete <span className="font-bold">{inventory.find(i => i.id === showDeleteConfirm)?.name}</span>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                  <button onClick={handleDeleteItem} className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-danger/90 hover:shadow-lg transition-colors">Delete</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restock Modal */}
      <AnimatePresence>
        {showRestock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowRestock(null); setRestockQty(0); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const item = inventory.find(i => i.id === showRestock);
                if (!item) return null;
                return (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Restock Item</h3>
                      <button onClick={() => { setShowRestock(null); setRestockQty(0); }} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">Current: {item.quantity} {item.unit} | Reorder Level: {item.reorderLevel}</p>
                    </div>
                    <div className="mb-4">
                      <label className="text-sm font-medium mb-2 block">Quantity to Add</label>
                      <input
                        type="number"
                        min={1}
                        value={restockQty}
                        onChange={e => setRestockQty(parseInt(e.target.value) || 0)}
                        className={inputClass}
                        placeholder="Enter quantity"
                        autoFocus
                      />
                    </div>
                    {restockQty > 0 && (
                      <p className="text-sm text-muted-foreground mb-4">
                        New quantity: <span className="font-medium text-foreground">{item.quantity + restockQty} {item.unit}</span>
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => { setShowRestock(null); setRestockQty(0); }} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                      <button onClick={handleRestock} className="flex-1 py-2.5 bg-success text-white rounded-lg hover:bg-green-600 hover:shadow-lg transition-colors flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Restock
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Order Modal */}
      <AnimatePresence>
        {showPurchaseOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowPurchaseOrder(null); setPoQuantities({}); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const supplierName = showPurchaseOrder;
                const lowItems = inventory.filter(
                  i => i.supplier === supplierName && i.quantity <= i.reorderLevel
                );
                const poTotal = lowItems.reduce((sum, i) => sum + (i.price * (poQuantities[i.id] ?? 0)), 0);

                return (
                  <>
                    <div className="flex items-center justify-between p-5 border-b border-border/30">
                      <h3 className="text-lg font-semibold">Purchase Order — {supplierName}</h3>
                      <button onClick={() => { setShowPurchaseOrder(null); setPoQuantities({}); }} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      {lowItems.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No items at or below reorder level for this supplier.</p>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">Items at or below reorder level:</p>
                          <div className="space-y-3">
                            {lowItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Stock: {item.quantity} / Reorder: {item.reorderLevel} {item.unit} | R{item.price.toFixed(2)} each
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-3">
                                  <label className="text-xs text-muted-foreground">Qty:</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={poQuantities[item.id] ?? 0}
                                    onChange={e => setPoQuantities({ ...poQuantities, [item.id]: parseInt(e.target.value) || 0 })}
                                    className="w-20 px-2 py-1.5 bg-muted border border-border/30 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="pt-3 border-t border-border/30">
                            <div className="flex justify-between text-lg font-bold mb-4">
                              <span>Order Total</span>
                              <span>R{poTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => { setShowPurchaseOrder(null); setPoQuantities({}); }} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                              <button onClick={handleCreatePurchaseOrder} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" />
                                Submit Order
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POS Modal */}
      <AnimatePresence>
        {showPos && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPos(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border/30">
                <h2 className="text-xl font-bold">Point of Sale</h2>
                <button onClick={() => setShowPos(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-border/30 max-h-[calc(90vh-80px)]">
                <div className="lg:col-span-2 p-4 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {inventory.map(item => (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        disabled={item.quantity === 0}
                        className="p-4 bg-muted/30 border border-border/30 rounded-xl text-left hover:border-primary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-lg font-bold text-primary">R{item.price.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{item.category} — {item.quantity} in stock</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-muted/20 flex flex-col">
                  <h3 className="font-semibold mb-4">Current Order</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto flex-1">
                    {cart.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">No items in order</p>
                    ) : (
                      cart.map((c, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{c.item.name} x{c.qty}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="font-medium">R{(c.item.price * c.qty).toFixed(2)}</span>
                            <button
                              onClick={() => removeFromCart(i)}
                              className="w-5 h-5 bg-danger/15 rounded flex items-center justify-center hover:bg-danger/30 transition-colors"
                            >
                              <X className="w-3 h-3 text-danger" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <div className="flex justify-between text-lg font-bold mb-4">
                      <span>Total</span>
                      <span>R{cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        onClick={() => completeSale('card')}
                        disabled={cart.length === 0}
                        className="py-2.5 bg-success text-white rounded-lg hover:bg-green-600 hover:shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CreditCard className="w-4 h-4" />
                        Card
                      </button>
                      <button
                        onClick={() => completeSale('cash')}
                        disabled={cart.length === 0}
                        className="py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Receipt className="w-4 h-4" />
                        Cash
                      </button>
                    </div>
                    <button
                      onClick={() => completeSale('card')}
                      disabled={cart.length === 0}
                      className="w-full py-3 bg-success text-white rounded-lg hover:bg-green-600 hover:shadow-lg transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Complete Sale
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
