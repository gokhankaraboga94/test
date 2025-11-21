import firebaseService from '../services/firebase.service.js';
import { DB_PATHS } from '../config/constants.js';
import toast from '../utils/toast.js';

class WarehouseModule {
  constructor() {
    this.orders = {};
  }

  async initialize() {
    if (window.currentUserRole !== 'warehouse') return;
    
    await this.loadOrders();
    this.setupRealtimeListener();
  }

  async loadOrders() {
    try {
      const orders = await firebaseService.getData(DB_PATHS.partOrders);
      const ordersContainer = document.getElementById('warehouseOrders');
      
      if (!orders) {
        ordersContainer.innerHTML = '<div class="no-warehouse-orders">Henüz parça siparişi bulunmuyor.</div>';
        this.updateStats(0, 0);
        return;
      }
      
      this.orders = orders;
      const ordersArray = Object.entries(orders).sort(([_, a], [__, b]) => b.timestamp - a.timestamp);
      
      const pendingOrders = ordersArray.filter(([_, order]) => order.status === 'pending');
      const readyOrders = ordersArray.filter(([_, order]) => order.status === 'ready');
      
      ordersContainer.innerHTML = '';
      
      // Bekleyen siparişler
      if (pendingOrders.length > 0) {
        const pendingHeader = document.createElement('div');
        pendingHeader.style.cssText = `
          grid-column: 1 / -1;
          padding: 15px 20px;
          background: rgba(243, 156, 18, 0.2);
          border-radius: 10px;
          margin-bottom: 15px;
        `;
        pendingHeader.innerHTML = '<h3 style="margin: 0; font-size: 20px;">⏳ Bekleyen İstekler</h3>';
        ordersContainer.appendChild(pendingHeader);
      }
      
      pendingOrders.forEach(([barcode, order]) => {
        const card = this.createOrderCard(barcode, order, true);
        ordersContainer.appendChild(card);
      });
      
      // Hazır siparişler
      if (readyOrders.length > 0) {
        const readyHeader = document.createElement('div');
        readyHeader.style.cssText = `
          grid-column: 1 / -1;
          padding: 15px 20px;
          background: rgba(46, 204, 113, 0.2);
          border-radius: 10px;
          margin: ${pendingOrders.length > 0 ? '25px 0 15px 0' : '0 0 15px 0'};
        `;
        readyHeader.innerHTML = '<h3 style="margin: 0; font-size: 20px;">✅ Hazır Siparişler</h3>';
        ordersContainer.appendChild(readyHeader);
      }
      
      readyOrders.forEach(([barcode, order]) => {
        const card = this.createOrderCard(barcode, order, false);
        ordersContainer.appendChild(card);
      });
      
      if (pendingOrders.length === 0 && readyOrders.length === 0) {
        ordersContainer.innerHTML = '<div class="no-warehouse-orders">Henüz parça siparişi bulunmuyor.</div>';
      }
      
      this.updateStats(pendingOrders.length, readyOrders.length);
      
    } catch (error) {
      console.error('Load warehouse orders error:', error);
      toast.error('Siparişler yüklenirken hata oluştu!');
    }
  }

  createOrderCard(barcode, order, isPending) {
    const card = document.createElement('div');
    card.className = 'warehouse-order-card';
    card.style.borderLeftColor = isPending ? '#f39c12' : '#2ecc71';
    
    if (!isPending) {
      card.style.opacity = '0.8';
      card.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.6), rgba(118, 75, 162, 0.6))';
    }
    
    let partsHTML = '<div class="warehouse-parts-list">';
    order.parts.forEach((part, index) => {
      const partStatus = part.status || 'pending';
      partsHTML += `
        <div class="warehouse-part-item">
          <span class="warehouse-part-name">${part.name}</span>
          <div class="warehouse-part-buttons">
            <button class="warehouse-part-btn available" 
                    onclick="WarehouseModule.updatePartStatus('${barcode}', ${index}, 'available')"
                    ${partStatus === 'available' || !isPending ? 'disabled style="opacity: 0.5"' : ''}>
              ✅ Var
            </button>
            <button class="warehouse-part-btn unavailable" 
                    onclick="WarehouseModule.updatePartStatus('${barcode}', ${index}, 'unavailable')"
                    ${partStatus === 'unavailable' || !isPending ? 'disabled style="opacity: 0.5"' : ''}>
              ❌ Yok
            </button>
          </div>
        </div>
      `;
    });
    partsHTML += '</div>';
    
    card.innerHTML = `
      <div class="warehouse-order-header">
        <div class="warehouse-order-barcode">${barcode}</div>
        <div class="warehouse-order-tech">👤 ${order.technician}</div>
      </div>
      <div class="warehouse-order-model">📱 ${order.model}</div>
      ${partsHTML}
      <div class="warehouse-order-actions">
        ${isPending ? `
          <button class="warehouse-action-btn ready" onclick="WarehouseModule.markOrderReady('${barcode}')">
            ✅ Hazır
          </button>
        ` : `
          <button class="warehouse-action-btn ready" disabled style="opacity: 0.5; cursor: not-allowed;">
            ✅ Tamamlandı
          </button>
        `}
        <button class="warehouse-action-btn cancel" onclick="WarehouseModule.cancelOrder('${barcode}')">
          🗑️ İptal
        </button>
      </div>
      <div class="warehouse-order-time">📅 ${order.timestampReadable}</div>
    `;
    
    return card;
  }

  async updatePartStatus(barcode, partIndex, status) {
    try {
      await firebaseService.setData(
        `${DB_PATHS.partOrders}/${barcode}/parts/${partIndex}/status`,
        status
      );
      
      const statusText = status === 'available' ? 'Stokta var' : 'Stokta yok';
      toast.info(`Parça durumu güncellendi: ${statusText}`);
      
      await this.loadOrders();
    } catch (error) {
      console.error('Update part status error:', error);
      toast.error('Parça durumu güncellenirken hata oluştu!');
    }
  }

  async markOrderReady(barcode) {
    try {
      const order = await firebaseService.getData(`${DB_PATHS.partOrders}/${barcode}`);
      
      const allChecked = order.parts.every(part => 
        part.status === 'available' || part.status === 'unavailable'
      );
      
      if (!allChecked) {
        toast.warning('Lütfen tüm parçaları kontrol edin!');
        return;
      }
      
      await firebaseService.setData(`${DB_PATHS.partOrders}/${barcode}/status`, 'ready');
      toast.success('Sipariş hazır olarak işaretlendi!');
      
      await this.loadOrders();
    } catch (error) {
      console.error('Mark order ready error:', error);
      toast.error('Sipariş işaretlenirken hata oluştu!');
    }
  }

  async cancelOrder(barcode) {
    if (!confirm('Bu siparişi iptal etmek istediğinizden emin misiniz?')) {
      return;
    }
    
    try {
      await firebaseService.removeData(`${DB_PATHS.partOrders}/${barcode}`);
      toast.success('Sipariş iptal edildi!');
      await this.loadOrders();
    } catch (error) {
      console.error('Cancel order error:', error);
      toast.error('Sipariş iptal edilirken hata oluştu!');
    }
  }

  updateStats(pending, ready) {
    const pendingEl = document.getElementById('warehousePendingCount');
    const readyEl = document.getElementById('warehouseReadyCount');
    const totalEl = document.getElementById('warehouseTotalCount');
    
    if (pendingEl) pendingEl.textContent = pending;
    if (readyEl) readyEl.textContent = ready;
    if (totalEl) totalEl.textContent = pending + ready;
  }

  setupRealtimeListener() {
    firebaseService.onValue(DB_PATHS.partOrders, () => {
      this.loadOrders();
    });
  }
}

export const warehouseModule = new WarehouseModule();

// Global fonksiyonlar (HTML onclick için)
window.WarehouseModule = {
  updatePartStatus: (barcode, index, status) => warehouseModule.updatePartStatus(barcode, index, status),
  markOrderReady: (barcode) => warehouseModule.markOrderReady(barcode),
  cancelOrder: (barcode) => warehouseModule.cancelOrder(barcode)
};

export default warehouseModule;