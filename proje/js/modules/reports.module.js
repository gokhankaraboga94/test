import firebaseService from '../services/firebase.service.js';
import databaseService from '../services/database.service.js';
import { DB_PATHS, LIST_NAMES } from '../config/constants.js';
import toast from '../utils/toast.js';

class ReportsModule {
  constructor() {
    this.currentReportData = null;
  }

  async generateReport() {
    const startDateInput = document.getElementById('reportStartDate').value;
    const endDateInput = document.getElementById('reportEndDate').value;
    const listSelect = document.getElementById('reportList').value;
    
    if (!startDateInput || !endDateInput) {
      alert('Lütfen başlangıç ve bitiş tarihlerini seçin!');
      return;
    }
    
    // Özel raporlar
    if (listSelect === 'teslimEdilenler') {
      await this.generateDeliveryReport(startDateInput, endDateInput);
      return;
    }
    
    if (listSelect === 'serviceReturn') {
      await this.generateServiceReturnReport(startDateInput, endDateInput);
      return;
    }
    
    if (listSelect === 'dailyReceived') {
      await this.generateDailyReceivedReport(startDateInput, endDateInput);
      return;
    }
    
    // Normal rapor
    await this.generateStandardReport(startDateInput, endDateInput, listSelect);
  }

  async generateStandardReport(startDateInput, endDateInput, listSelect) {
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
    endDate.setHours(23, 59, 59, 999);
    
    if (startDate > endDate) {
      alert('Başlangıç tarihi bitiş tarihinden büyük olamaz!');
      return;
    }
    
    const startOfPeriod = startDate.getTime();
    const endOfPeriod = endDate.getTime();
    
    try {
      const reportResults = document.getElementById('reportResults');
      reportResults.innerHTML = this.getLoadingHTML();
      reportResults.classList.add('active');
      
      const listsToCheck = listSelect ? [listSelect] : Object.keys(databaseService.userCodes);
      let totalActions = 0;
      let userStats = {};
      let detailsData = [];
      
      for (const listName of listsToCheck) {
        const historyData = await firebaseService.getData(`${DB_PATHS.history}`);
        
        if (!historyData) continue;
        
        for (const [barcode, barcodeHistory] of Object.entries(historyData)) {
          const historyArray = Object.values(barcodeHistory);
          
          // PhoneCheck geçmişi
          let phoneCheckInfo = null;
          const phoneCheckEntry = historyArray.find(entry => entry.to === 'phonecheck');
          if (phoneCheckEntry) {
            phoneCheckInfo = {
              user: phoneCheckEntry.user,
              timestamp: phoneCheckEntry.timestamp,
              action: 'Giriş'
            };
          }
          
          // Tarih aralığında giriş
          const entryToList = historyArray.find(entry => 
            entry.to === listName && 
            entry.timestampRaw >= startOfPeriod && 
            entry.timestampRaw <= endOfPeriod
          );
          
          if (!entryToList) continue;
          
          totalActions++;
          
          const user = entryToList.user || 'Bilinmeyen';
          userStats[user] = (userStats[user] || 0) + 1;
          
          // Barkodun şu anki durumunu belirle
          const isCurrentlyInList = databaseService.userCodes[listName] && 
                                    databaseService.userCodes[listName].has(barcode);
          
          let currentStatus = '';
          let statusColor = '';
          
          if (isCurrentlyInList) {
            currentStatus = '✅ Aktif (Halen Bu Listede)';
            statusColor = '#2ecc71';
          } else {
            let foundInOtherList = false;
            for (const [otherListName, codeSet] of Object.entries(databaseService.userCodes)) {
              if (codeSet.has(barcode)) {
                currentStatus = `⏭️ Taşındı: ${LIST_NAMES[otherListName] || otherListName}`;
                statusColor = '#95a5a6';
                foundInOtherList = true;
                break;
              }
            }
            
            if (!foundInOtherList) {
              currentStatus = '❌ Sistemde Yok (Silinmiş/Teslim Edilmiş)';
              statusColor = '#e74c3c';
            }
          }
          
          const fromName = LIST_NAMES[entryToList.from] || entryToList.from;
          const toName = LIST_NAMES[entryToList.to] || entryToList.to;
          
          detailsData.push({
            barcode: barcode,
            fromName: fromName,
            toName: toName,
            user: user,
            timestamp: entryToList.timestamp,
            entryDate: entryToList.timestampRaw,
            currentStatus: currentStatus,
            statusColor: statusColor,
            isActive: isCurrentlyInList,
            phoneCheckInfo: phoneCheckInfo,
            rawData: entryToList
          });
        }
      }
      
      if (totalActions === 0) {
        reportResults.innerHTML = `
          <div class="no-results">
            📭 Seçilen tarih ve liste için kayıt bulunamadı.
          </div>
        `;
        return;
      }

      // Sıralama
      detailsData.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.entryDate - a.entryDate;
      });

      const listName = listSelect ? 
        document.querySelector(`#reportList option[value="${listSelect}"]`).textContent : 
        'Tüm Listeler';
      const dateRangeText = `${startDateInput} - ${endDateInput}`;

      const activeCount = detailsData.filter(item => item.isActive).length;
      const movedCount = detailsData.filter(item => !item.isActive).length;

      const summaryHTML = this.buildStandardReportSummary(
        totalActions, activeCount, movedCount, dateRangeText, listName
      );
      
      const userStatsHTML = this.buildUserStatsHTML(userStats);
      const detailsHTML = this.buildDetailsHTML(detailsData, activeCount, movedCount);
      
      reportResults.innerHTML = `
        ${summaryHTML}
        ${userStatsHTML}
        ${detailsHTML}
      `;
      
      this.setupDetailFilters(detailsData, activeCount, movedCount);
      this.enableExcelExport({ 
        details: detailsData, 
        totalActions, 
        activeCount,
        movedCount,
        userCount: Object.keys(userStats).length, 
        userStats, 
        reportDate: dateRangeText,
        selectedList: listName 
      });
      
    } catch (error) {
      console.error('Report generation error:', error);
      alert('Rapor oluşturulurken hata oluştu!');
      document.getElementById('reportResults').innerHTML = `
        <div class="no-results">
          ❌ Rapor oluşturulurken bir hata oluştu.
        </div>
      `;
    }
  }

  getLoadingHTML() {
    return `
      <div style="text-align: center; padding: 20px;">
        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
    `;
  }

  buildStandardReportSummary(totalActions, activeCount, movedCount, dateRangeText, listName) {
    return `
      <div class="report-summary">
        <div class="summary-card">
          <div class="label">Toplam Kayıt</div>
          <div class="value">${totalActions}</div>
        </div>
        <div class="summary-card" style="background: rgba(46, 204, 113, 0.2);">
          <div class="label">✅ Aktif (Halen Bu Listede)</div>
          <div class="value" style="color: #2ecc71;">${activeCount}</div>
        </div>
        <div class="summary-card" style="background: rgba(149, 165, 166, 0.2);">
          <div class="label">⏭️ Taşınmış</div>
          <div class="value" style="color: #95a5a6;">${movedCount}</div>
        </div>
        <div class="summary-card">
          <div class="label">Tarih Aralığı</div>
          <div class="value" style="font-size: 16px;">${dateRangeText}</div>
        </div>
        <div class="summary-card">
          <div class="label">Rapor Türü</div>
          <div class="value" style="font-size: 14px;">${listName}</div>
        </div>
      </div>
    `;
  }

  buildUserStatsHTML(userStats) {
    let html = '<div class="user-stats"><h4>👥 Kullanıcı İstatistikleri</h4>';
    const sortedUsers = Object.entries(userStats).sort((a, b) => b[1] - a[1]);
    
    sortedUsers.forEach(([user, count]) => {
      html += `
        <div class="user-stat-item">
          <span class="user-stat-name">👤 ${user}</span>
          <span class="user-stat-count">${count} kayıt</span>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }

  buildDetailsHTML(detailsData, activeCount, movedCount) {
    const detailFiltersHTML = `
      <div class="detail-filters">
        <input type="text" class="detail-filter-input" id="detailBarcodeFilter" placeholder="🔍 Barkod ara...">
        <input type="text" class="detail-filter-input" id="detailUserFilter" placeholder="👤 Kullanıcı ara...">
        <input type="text" class="detail-filter-input" id="detailStatusFilter" placeholder="📍 Durum ara...">
        <select class="detail-filter-input" id="detailActiveFilter">
          <option value="">Tüm Kayıtlar</option>
          <option value="active">✅ Sadece Aktif</option>
          <option value="moved">⏭️ Sadece Taşınmış</option>
        </select>
      </div>
      <div class="filter-info" id="filterInfo">
        Toplam ${detailsData.length} kayıt gösteriliyor (✅ ${activeCount} Aktif, ⏭️ ${movedCount} Taşınmış)
      </div>
      <button class="clear-filters-btn" onclick="ReportsModule.clearFilters()" style="display: none;" id="clearFiltersBtn">
        🗑️ Filtreleri Temizle
      </button>
    `;
    
    let html = '<div class="report-details"><h3>📋 Detaylı Kayıt Listesi</h3>';
    html += detailFiltersHTML;
    html += '<div class="detail-list-container" id="detailListContainer">';
    
    detailsData.forEach(item => {
      html += `
        <div class="detail-item" data-barcode="${item.barcode}" data-user="${item.user}" 
             data-status="${item.currentStatus}" 
             data-active="${item.isActive ? 'active' : 'moved'}"
             data-phonecheck="${item.phoneCheckInfo ? 'var' : 'yok'}"
             style="border-left: 4px solid ${item.statusColor};">
          <div class="barcode">${item.barcode}</div>
          <div class="info">${item.fromName} → ${item.toName}</div>
          <div class="info">👤 ${item.user} • 🕒 ${item.timestamp}</div>
          ${item.phoneCheckInfo ? `
            <div class="info" style="color: #3498db;">
              📱 PhoneCheck: ${item.phoneCheckInfo.action} - ${item.phoneCheckInfo.user} (${item.phoneCheckInfo.timestamp})
            </div>
          ` : `
            <div class="info" style="color: #95a5a6;">
              📱 PhoneCheck: Yok
            </div>
          `}
          <div class="info" style="color: ${item.statusColor}; font-weight: bold;">
            ${item.currentStatus}
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
    return html;
  }

  setupDetailFilters(detailsData, activeCount, movedCount) {
    const barcodeFilter = document.getElementById('detailBarcodeFilter');
    const userFilter = document.getElementById('detailUserFilter');
    const statusFilter = document.getElementById('detailStatusFilter');
    const activeFilter = document.getElementById('detailActiveFilter');
    const filterInfo = document.getElementById('filterInfo');
    const detailItems = document.querySelectorAll('.detail-item');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    const updateClearButton = () => {
      const hasFilters = barcodeFilter.value || userFilter.value || statusFilter.value || activeFilter.value;
      clearFiltersBtn.style.display = hasFilters ? 'block' : 'none';
    };

    const applyFilters = () => {
      const barcodeValue = barcodeFilter.value.toLowerCase();
      const userValue = userFilter.value.toLowerCase();
      const statusValue = statusFilter.value.toLowerCase();
      const activeValue = activeFilter.value;

      let visibleCount = 0;
      let visibleActive = 0;
      let visibleMoved = 0;

      detailItems.forEach(item => {
        const barcode = item.getAttribute('data-barcode').toLowerCase();
        const user = item.getAttribute('data-user').toLowerCase();
        const status = item.getAttribute('data-status').toLowerCase();
        const isActive = item.getAttribute('data-active');

        const matchesBarcode = barcode.includes(barcodeValue);
        const matchesUser = user.includes(userValue);
        const matchesStatus = status.includes(statusValue);
        const matchesActive = !activeValue || isActive === activeValue;

        if (matchesBarcode && matchesUser && matchesStatus && matchesActive) {
          item.classList.remove('hidden');
          visibleCount++;
          if (isActive === 'active') visibleActive++;
          else visibleMoved++;
        } else {
          item.classList.add('hidden');
        }
      });

      filterInfo.textContent = `${visibleCount} kayıt gösteriliyor (✅ ${visibleActive} Aktif, ⏭️ ${visibleMoved} Taşınmış) - Toplam: ${detailsData.length}`;
      updateClearButton();
    };

    [barcodeFilter, userFilter, statusFilter, activeFilter].forEach(input => {
      input.addEventListener('input', applyFilters);
    });

    updateClearButton();
  }

  clearFilters() {
    document.getElementById('detailBarcodeFilter').value = '';
    document.getElementById('detailUserFilter').value = '';
    document.getElementById('detailStatusFilter').value = '';
    document.getElementById('detailActiveFilter').value = '';
    
    const detailItems = document.querySelectorAll('.detail-item');
    detailItems.forEach(item => {
      item.classList.remove('hidden');
    });
    
    document.getElementById('clearFiltersBtn').style.display = 'none';
    toast.info('Filtreler temizlendi!');
  }

  enableExcelExport(data) {
    this.currentReportData = data;
    document.getElementById('exportExcelBtn').disabled = false;
  }

  disableExcelExport() {
    this.currentReportData = null;
    document.getElementById('exportExcelBtn').disabled = true;
  }

  exportToExcel() {
    if (!this.currentReportData) {
      alert('Önce rapor oluşturmanız gerekiyor!');
      return;
    }
    
    try {
      // Service Return, Daily Received, Delivery için özel exportlar
      if (this.currentReportData.isServiceReturnReport) {
        this.exportServiceReturnToExcel();
        return;
      }
      
      if (this.currentReportData.isDailyReceivedReport) {
        this.exportDailyReceivedToExcel();
        return;
      }
      
      if (this.currentReportData.isDeliveryReport) {
        this.exportDeliveryToExcel();
        return;
      }
      
      // Normal rapor
      this.exportStandardReportToExcel();
      
    } catch (error) {
      console.error('Excel export error:', error);
      alert('Excel dosyası oluşturulurken hata oluştu!');
    }
  }

  exportStandardReportToExcel() {
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Özet
    const summaryData = [
      ['RAPOR ÖZETİ'],
      [''],
      ['Rapor Tarihi:', this.currentReportData.reportDate || 'Bilinmiyor'],
      ['Seçilen Liste:', this.currentReportData.selectedList || 'Tümü'],
      ['Toplam İşlem:', this.currentReportData.totalActions || 0],
      ['Aktif Kayıtlar:', this.currentReportData.activeCount || 0],
      ['Taşınmış Kayıtlar:', this.currentReportData.movedCount || 0],
      [''],
      ['KULLANICI İSTATİSTİKLERİ'],
      ['Kullanıcı', 'İşlem Sayısı']
    ];
    
    if (this.currentReportData.userStats) {
      Object.entries(this.currentReportData.userStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([user, count]) => {
          summaryData.push([user, count]);
        });
    }
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Özet');
    
    // Sheet 2: Detaylı Liste
    if (this.currentReportData.details && this.currentReportData.details.length > 0) {
      const detailHeaders = ['Barkod', 'Kimden', 'Kime', 'Kullanıcı', 'Tarih', 'Güncel Durum', 'PhoneCheck'];
      const detailRows = this.currentReportData.details.map(item => [
        item.barcode,
        item.fromName,
        item.toName,
        item.user,
        item.timestamp,
        item.currentStatus,
        item.phoneCheckInfo ? 
          `${item.phoneCheckInfo.action} - ${item.phoneCheckInfo.user}` : 
          'Yok'
      ]);
      
      const detailData = [detailHeaders, ...detailRows];
      const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
      
      detailSheet['!cols'] = [
        { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 18 }, { wch: 25 }, { wch: 30 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detaylı Liste');
    }
    
    const fileName = `Rapor_${this.currentReportData.reportDate?.replace(/\s/g, '_') || 'Bilinmiyor'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success('Excel dosyası başarıyla indirildi! 📊');
  }
}

export const reportsModule = new ReportsModule();

// Global fonksiyonlar
window.ReportsModule = {
  clearFilters: () => reportsModule.clearFilters()
};

export default reportsModule;