import firebaseService from '../services/firebase.service.js';
import { getTodayDateString, getTimestamp } from '../utils/helpers.js';
import toast from '../utils/toast.js';
import { DB_PATHS } from '../config/constants.js';

class DashboardModule {
  constructor() {
    this.dailyReceivedIMEIs = new Set();
    this.dailyDeliveredCount = 0;
    this.lastCheckedDate = null;
  }

  async initialize() {
    this.lastCheckedDate = getTodayDateString();
    await this.loadStats();
    this.updateDate();
    this.startMidnightCheck();
  }

  updateDate() {
    const dateElement = document.getElementById('dashboardDate');
    if (dateElement) {
      const now = new Date();
      const turkeyTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 60 * 60 * 1000));
      
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long',
        timeZone: 'Europe/Istanbul'
      };
      dateElement.textContent = turkeyTime.toLocaleDateString('tr-TR', options);
    }
  }

  async loadStats() {
    const todayDate = getTodayDateString();
    
    try {
      const data = await firebaseService.getData(`${DB_PATHS.dashboard}/daily/${todayDate}`);
      
      if (data) {
        if (data.receivedIMEIs) {
          this.dailyReceivedIMEIs = new Set(Object.keys(data.receivedIMEIs));
        }
        this.dailyDeliveredCount = data.deliveredCount || 0;
        this.updateUI(data);
      } else {
        this.dailyReceivedIMEIs.clear();
        this.dailyDeliveredCount = 0;
        this.updateUI({});
      }
    } catch (error) {
      console.error('Dashboard loading error:', error);
    }
  }

  updateUI(data = {}) {
    document.getElementById('dashboardTeslimAlinan').textContent = this.dailyReceivedIMEIs.size;
    document.getElementById('dashboardTeslimEdilen').textContent = this.dailyDeliveredCount;
    
    document.getElementById('dashboardAtanacakCount').textContent = data.sources?.atanacak || 0;
    document.getElementById('dashboardSonKullanıcıCount').textContent = data.sources?.SonKullanıcı || 0;
    document.getElementById('dashboardSahibindenCount').textContent = data.sources?.sahiniden || 0;
    document.getElementById('dashboardMediaMarktCount').textContent = data.sources?.mediaMarkt || 0;
    document.getElementById('dashboardServiceReturnCount').textContent = data.sources?.serviceReturn || 0;
  }

  async addReceivedIMEI(imei, source) {
    if (!this.dailyReceivedIMEIs.has(imei)) {
      this.dailyReceivedIMEIs.add(imei);
      
      const todayDate = getTodayDateString();
      const updates = {};
      updates[`${DB_PATHS.dashboard}/daily/${todayDate}/receivedIMEIs/${imei}`] = {
        source: source,
        timestamp: Date.now(),
        user: window.currentUserName
      };
      
      const currentCount = await firebaseService.getData(
        `${DB_PATHS.dashboard}/daily/${todayDate}/sources/${source}`
      );
      updates[`${DB_PATHS.dashboard}/daily/${todayDate}/sources/${source}`] = (currentCount || 0) + 1;
      
      try {
        await firebaseService.getDatabase().ref().update(updates);
        await this.loadStats();
      } catch (error) {
        console.error('Add IMEI error:', error);
      }
    }
  }

  async incrementDeliveredCount() {
    this.dailyDeliveredCount++;
    
    const todayDate = getTodayDateString();
    try {
      await firebaseService.setData(
        `${DB_PATHS.dashboard}/daily/${todayDate}/deliveredCount`,
        this.dailyDeliveredCount
      );
      this.updateUI();
    } catch (error) {
      console.error('Increment delivered count error:', error);
    }
  }

  checkMidnightReset() {
    const today = getTodayDateString();
    
    if (!this.lastCheckedDate) {
      this.lastCheckedDate = today;
      console.log(`✅ Initial check - Date: ${today}`);
      return;
    }
    
    if (this.lastCheckedDate !== today) {
      console.log(`🌙 Midnight passed: ${this.lastCheckedDate} → ${today}`);
      
      this.dailyReceivedIMEIs.clear();
      this.dailyDeliveredCount = 0;
      this.updateUI({});
      this.lastCheckedDate = today;
      
      toast.info('Günlük sayaçlar sıfırlandı - Yeni güne hoş geldiniz! 🌅');
    }
  }

  startMidnightCheck() {
    setInterval(() => this.checkMidnightReset(), 30000);
  }

  openResetModal() {
    document.getElementById('resetTeslimAlinan').textContent = this.dailyReceivedIMEIs.size;
    document.getElementById('resetTeslimEdilen').textContent = this.dailyDeliveredCount;
    document.getElementById('resetDashboardModal').classList.add('active');
  }

  closeResetModal() {
    document.getElementById('resetDashboardModal').classList.remove('active');
  }

  async confirmReset() {
    const todayDate = getTodayDateString();
    
    try {
      const currentData = await firebaseService.getData(`${DB_PATHS.dashboard}/daily/${todayDate}`);
      
      const resetLog = {
        timestamp: Date.now(),
        timestampReadable: getTimestamp(),
        user: window.currentUserName,
        previousData: {
          receivedCount: this.dailyReceivedIMEIs.size,
          deliveredCount: this.dailyDeliveredCount,
          receivedIMEIs: currentData?.receivedIMEIs ? Object.keys(currentData.receivedIMEIs) : [],
          sources: currentData?.sources || {}
        }
      };
      
      await firebaseService.setData(
        `${DB_PATHS.dashboard}/resetLogs/${todayDate}/${Date.now()}`,
        resetLog
      );
      
      await firebaseService.setData(`${DB_PATHS.dashboard}/daily/${todayDate}`, {
        receivedIMEIs: {},
        deliveredCount: 0,
        sources: {
          atanacak: 0,
          SonKullanıcı: 0,
          sahiniden: 0,
          mediaMarkt: 0,
          serviceReturn: 0
        }
      });
      
      this.dailyReceivedIMEIs.clear();
      this.dailyDeliveredCount = 0;
      this.updateUI({
        sources: {
          atanacak: 0,
          SonKullanıcı: 0,
          sahibinden: 0,
          mediaMarkt: 0,
          serviceReturn: 0
        }
      });
      
      this.closeResetModal();
      toast.success('✅ Dashboard başarıyla sıfırlandı ve işlem loglandı!');
      
      console.log('📊 Dashboard Reset Log:', resetLog);
      
    } catch (error) {
      console.error('❌ Dashboard reset error:', error);
      toast.error('Dashboard sıfırlanırken hata oluştu!');
    }
  }
}

export const dashboardModule = new DashboardModule();
export default dashboardModule;