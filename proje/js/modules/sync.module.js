import firebaseService from '../services/firebase.service.js';
import databaseService from '../services/database.service.js';
import toast from '../utils/toast.js';
import { DB_PATHS } from '../config/constants.js';

class SyncModule {
  constructor() {
    this.conflictCheckInterval = null;
  }

  async openModal() {
    document.getElementById('syncModal').classList.add('active');
    await this.analyzeConflicts();
  }

  closeModal() {
    const modal = document.getElementById('syncModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  async analyzeConflicts() {
    const syncResults = document.getElementById('syncResults');
    const fixAllBtn = document.getElementById('fixAllBtn');
    
    if (!syncResults) return;
    
    try {
      const conflicts = [];
      
      // Tüm barkodları kontrol et
      const allBarcodes = new Set();
      Object.values(databaseService.userCodes).forEach(set => {
        if (set && set.forEach) {
          set.forEach(barcode => allBarcodes.add(barcode));
        }
      });
      
      // Her barkod için çakışmaları bul
      for (const barcode of allBarcodes) {
        const lists = [];
        Object.entries(databaseService.userCodes).forEach(([listName, codeSet]) => {
          if (codeSet && codeSet.has && codeSet.has(barcode)) {
            lists.push(listName);
          }
        });
        
        if (lists.length > 1) {
          conflicts.push({
            barcode: barcode,
            lists: lists,
            priority: this.getListPriority(lists)
          });
        }
      }
      
      if (conflicts.length === 0) {
        syncResults.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #2ecc71;">
            <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
            <h3>Harika! Hiç çakışma bulunamadı.</h3>
            <p>Tüm barkodlar doğru listelerde.</p>
          </div>
        `;
        if (fixAllBtn) fixAllBtn.disabled = true;
        return;
      }
      
      // Çakışmaları grupla
      const phonecheckOnarimConflicts = conflicts.filter(c => 
        c.lists.includes('phonecheck') && c.lists.includes('onarim')
      );
      
      const onarimTeslimConflicts = conflicts.filter(c => 
        c.lists.includes('onarim') && c.lists.includes('teslimEdilenler')
      );
      
      const otherConflicts = conflicts.filter(c => 
        !(c.lists.includes('phonecheck') && c.lists.includes('onarim')) &&
        !(c.lists.includes('onarim') && c.lists.includes('teslimEdilenler'))
      );
      
      let resultsHTML = this.buildConflictSummary(
        conflicts.length,
        phonecheckOnarimConflicts.length,
        onarimTeslimConflicts.length
      );
      
      if (phonecheckOnarimConflicts.length > 0) {
        resultsHTML += this.buildConflictSection(
          '📱 PhoneCheck ↔ 🔧 Onarım Çakışmaları',
          'PhoneCheck\'teki kayıt silinecek, Onarım Tamamlandı\'daki tutulacak',
          phonecheckOnarimConflicts,
          'PhoneCheck → Onarım'
        );
      }
      
      if (onarimTeslimConflicts.length > 0) {
        resultsHTML += this.buildConflictSection(
          '🔧 Onarım ↔ ✅ Teslim Çakışmaları',
          'Onarım Tamamlandı\'daki kayıt silinecek, Teslim Edilenler\'deki tutulacak',
          onarimTeslimConflicts,
          'Onarım → Teslim'
        );
      }
      
      if (otherConflicts.length > 0) {
        resultsHTML += this.buildConflictSection(
          '⚠️ Diğer Çakışmalar',
          null,
          otherConflicts
        );
      }
      
      syncResults.innerHTML = resultsHTML;
      if (fixAllBtn) fixAllBtn.disabled = false;
      
    } catch (error) {
      console.error('Conflict analysis error:', error);
      if (syncResults) {
        syncResults.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #e74c3c;">
            <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
            <h3>Çakışmalar analiz edilirken hata oluştu</h3>
            <p>${error.message}</p>
          </div>
        `;
      }
      if (fixAllBtn) fixAllBtn.disabled = true;
    }
  }

  buildConflictSummary(total, phonecheck, onarim) {
    return `
      <div style="margin-bottom: 20px;">
        <h3>📊 Çakışma Özeti</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="background: rgba(52, 152, 219, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #3498db;">${total}</div>
            <div style="font-size: 12px;">Toplam Çakışma</div>
          </div>
          <div style="background: rgba(243, 156, 18, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #f39c12;">${phonecheck}</div>
            <div style="font-size: 12px;">PhoneCheck ↔ Onarım</div>
          </div>
          <div style="background: rgba(231, 76, 60, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">${onarim}</div>
            <div style="font-size: 12px;">Onarım ↔ Teslim</div>
          </div>
        </div>
      </div>
    `;
  }

  buildConflictSection(title, rule, conflicts, label = null) {
    let html = `<div style="margin-bottom: 20px;"><h4>${title}</h4>`;
    
    if (rule) {
      html += `
        <div style="background: rgba(243, 156, 18, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
          <strong>Kural:</strong> ${rule}
        </div>
      `;
    }
    
    html += '<div style="max-height: 200px; overflow-y: auto;">';
    
    conflicts.forEach(conflict => {
      const displayLabel = label || conflict.lists.join(' ↔ ');
      html += `
        <div style="padding: 8px; margin-bottom: 5px; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
          <span>${conflict.barcode}</span>
          <span style="font-size: 12px; color: #f39c12;">${displayLabel}</span>
        </div>
      `;
    });
    
    html += '</div></div>';
    return html;
  }

  getListPriority(lists) {
    if (lists.includes('teslimEdilenler')) return 'teslimEdilenler';
    if (lists.includes('onarim')) return 'onarim';
    if (lists.includes('phonecheck')) return 'phonecheck';
    return lists[0];
  }

  async fixAllConflicts() {
    const fixAllBtn = document.getElementById('fixAllBtn');
    const syncResults = document.getElementById('syncResults');
    
    if (!fixAllBtn || !syncResults) return;
    
    fixAllBtn.disabled = true;
    fixAllBtn.innerHTML = '🔄 Düzeltiliyor...';
    
    try {
      const allBarcodes = new Set();
      Object.values(databaseService.userCodes).forEach(set => {
        if (set && set.forEach) {
          set.forEach(barcode => allBarcodes.add(barcode));
        }
      });
      
      let fixedCount = 0;
      
      for (const barcode of allBarcodes) {
        const lists = [];
        Object.entries(databaseService.userCodes).forEach(([listName, codeSet]) => {
          if (codeSet && codeSet.has && codeSet.has(barcode)) {
            lists.push(listName);
          }
        });
        
        if (lists.length > 1) {
          await this.fixConflict(barcode, lists);
          fixedCount++;
        }
      }
      
      syncResults.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #2ecc71;">
          <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
          <h3>Senkronizasyon Tamamlandı!</h3>
          <p><strong>${fixedCount}</strong> çakışma başarıyla düzeltildi.</p>
          <p>Sayfayı yenilemek için <strong>3 saniye</strong> sonra yönlendirileceksiniz...</p>
        </div>
      `;
      
      toast.success(`✅ ${fixedCount} çakışma başarıyla düzeltildi!`);
      this.hideConflictNotification();
      
      setTimeout(() => {
        location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Fix conflicts error:', error);
      syncResults.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #e74c3c;">
          <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
          <h3>Çakışmalar düzeltilirken hata oluştu</h3>
          <p>${error.message}</p>
        </div>
      `;
      fixAllBtn.disabled = false;
      fixAllBtn.innerHTML = '🔄 Tüm Çakışmaları Düzelt';
    }
  }

  async fixConflict(barcode, lists) {
    // Kural 1: PhoneCheck + Onarım → PhoneCheck'ten sil
    if (lists.includes('phonecheck') && lists.includes('onarim')) {
      await this.removeFromList(barcode, 'phonecheck');
      return;
    }
    
    // Kural 2: Onarım + Teslim → Onarım'dan sil
    if (lists.includes('onarim') && lists.includes('teslimEdilenler')) {
      await this.removeFromList(barcode, 'onarim');
      return;
    }
    
    // Kural 3: Diğer çakışmalar → Önceliğe göre
    const listToKeep = this.getListPriority(lists);
    for (const listName of lists) {
      if (listName !== listToKeep) {
        await this.removeFromList(barcode, listName);
      }
    }
  }

  async removeFromList(barcode, listName) {
    if (!databaseService.userCodes[listName] || !databaseService.userCodes[listName].has(barcode)) {
      return;
    }
    
    try {
      await databaseService.removeBarcode(listName, barcode);
      await databaseService.saveBarcodeHistory(
        barcode,
        listName,
        'SENKRONİZASYON_SİLİNDİ',
        `${window.currentUserName} (Manuel Senkronizasyon: ${listName} listesinden kaldırıldı)`
      );
      
      console.log(`✅ Manuel Senkronizasyon: ${barcode} - ${listName} listesinden kaldırıldı`);
      
    } catch (error) {
      console.error(`❌ ${barcode} - ${listName} listesinden kaldırılırken hata:`, error);
      throw error;
    }
  }

  async getConflictCount() {
    const allBarcodes = new Set();
    Object.values(databaseService.userCodes).forEach(set => {
      if (set && set.forEach) {
        set.forEach(barcode => allBarcodes.add(barcode));
      }
    });
    
    let conflictCount = 0;
    
    for (const barcode of allBarcodes) {
      const lists = [];
      Object.entries(databaseService.userCodes).forEach(([listName, codeSet]) => {
        if (codeSet && codeSet.has && codeSet.has(barcode)) {
          lists.push(listName);
        }
      });
      
      if (lists.length > 1) {
        conflictCount++;
      }
    }
    
    return conflictCount;
  }

  showConflictNotification(count) {
    const notification = document.getElementById('conflictNotification');
    const countElement = document.getElementById('conflictCount');
    
    if (notification && countElement) {
      countElement.textContent = count;
      notification.style.display = 'block';
    }
  }

  hideConflictNotification() {
    const notification = document.getElementById('conflictNotification');
    if (notification) {
      notification.style.display = 'none';
    }
  }

  async checkAndNotifyConflicts() {
    if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'semi-admin') {
      this.hideConflictNotification();
      return;
    }
    
    try {
      const conflicts = await this.getConflictCount();
      
      if (conflicts > 0) {
        this.showConflictNotification(conflicts);
      } else {
        this.hideConflictNotification();
      }
    } catch (error) {
      console.error('Conflict check error:', error);
    }
  }

  startMonitoring() {
    setTimeout(() => {
      this.checkAndNotifyConflicts();
    }, 3000);
    
    this.conflictCheckInterval = setInterval(() => {
      this.checkAndNotifyConflicts();
    }, 60000);
  }

  stopMonitoring() {
    if (this.conflictCheckInterval) {
      clearInterval(this.conflictCheckInterval);
      this.conflictCheckInterval = null;
    }
    this.hideConflictNotification();
  }
}

export const syncModule = new SyncModule();
export default syncModule;