// ========================================
// MAIN APPLICATION ORCHESTRATOR
// ========================================

import firebaseService from './services/firebase.service.js';
import authService from './services/auth.service.js';
import databaseService from './services/database.service.js';
import { dashboardModule } from './modules/dashboard.module.js';
import { reportsModule } from './modules/reports.module.js';
import { syncModule } from './modules/sync.module.js';
import { warehouseModule } from './modules/warehouse.module.js';
import { navigationModule } from './modules/navigation.module.js';
import toast from './utils/toast.js';
import { TIMEOUTS } from './config/constants.js';



console.log("⚠️ APP.JS DOSYASI YÜKLENDİ ⚠️");

import firebaseService from './services/firebase.service.js';

class Application {
  constructor() {
    this.initialized = false;
    this.autoRefreshInterval = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing Application...');
    
    try {
      // Firebase başlat
      firebaseService.initialize();
      console.log('✅ Firebase initialized');
      
      // Auth servisini başlat
      authService.initialize();
      console.log('✅ Auth service initialized');
      
      // Event listeners
      this.attachGlobalEventListeners();
      console.log('✅ Global event listeners attached');
      
      // Auto refresh (10 dakikada bir)
      this.startAutoRefresh();
      console.log('✅ Auto refresh started');
      
      this.initialized = true;
      console.log('✅ Application initialized successfully');
      
    } catch (error) {
      console.error('❌ Application initialization error:', error);
      toast.error('Uygulama başlatılırken hata oluştu!');
    }
  }

  attachGlobalEventListeners() {
    // Rapor butonları
    const generateReportBtn = document.querySelector('.generate-report-btn');
    if (generateReportBtn) {
      generateReportBtn.onclick = () => reportsModule.generateReport();
    }
    
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
      exportExcelBtn.onclick = () => reportsModule.exportToExcel();
    }
    
    // Sync butonları
    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
      syncButton.onclick = () => syncModule.openModal();
    }
    
    const closeSyncBtn = document.querySelector('.modal-overlay #syncModal .modal-button.secondary');
    if (closeSyncBtn) {
      closeSyncBtn.onclick = () => syncModule.closeModal();
    }
    
    const fixAllBtn = document.getElementById('fixAllBtn');
    if (fixAllBtn) {
      fixAllBtn.onclick = () => syncModule.fixAllConflicts();
    }
    
    // Dashboard reset
    const resetDashboardBtn = document.getElementById('resetDashboardBtn');
    if (resetDashboardBtn) {
      resetDashboardBtn.onclick = () => dashboardModule.openResetModal();
    }
    
    // Modal close on outside click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
      }
    });
    
    // Conflict notification click
    const conflictNotification = document.getElementById('conflictNotification');
    if (conflictNotification) {
      conflictNotification.onclick = () => syncModule.openModal();
    }
    
    // Reports modal close
    const closeReportsBtn = document.querySelector('.close-reports');
    if (closeReportsBtn) {
      closeReportsBtn.onclick = () => {
        document.getElementById('reportsModal').classList.remove('active');
        reportsModule.disableExcelExport();
      };
    }
  }

  startAutoRefresh() {
    this.autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto refresh triggered');
      location.reload();
    }, TIMEOUTS.AUTO_REFRESH);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }
}

// Uygulama başlat
const app = new Application();

// DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
  });
} else {
  app.initialize();
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});


export default app;
