import firebaseService from './firebase.service.js';
import { DB_PATHS, LIST_NAMES } from '../config/constants.js';
import { getTimestamp } from '../utils/helpers.js';

class DatabaseService {
  constructor() {
    this.userCodes = {};
    this.codeTimestamps = {};
    this.codeUsers = {};
    this.scannedCodes = new Set();
    this.allCodes = new Set();
  }

  initializeLists(lists) {
    lists.forEach(listName => {
      if (!this.userCodes[listName]) {
        this.userCodes[listName] = new Set();
        this.codeTimestamps[listName] = {};
        this.codeUsers[listName] = {};
      }
    });
  }

  async loadAllData() {
    try {
      const data = await firebaseService.getData(DB_PATHS.servis);
      if (!data) return;

      const allKeys = Object.keys(data).filter(k => k !== 'eslesenler' && k !== 'history');
      
      for (const listName of allKeys) {
        const localName = listName === 'onarimTamamlandi' ? 'onarim' : listName;
        
        if (!this.userCodes[localName]) {
          this.userCodes[localName] = new Set();
          this.codeTimestamps[localName] = {};
          this.codeUsers[localName] = {};
        }
        
        const listData = await firebaseService.getData(`${DB_PATHS.servis}/${listName}`);
        
        if (!listData) continue;
        
        this.userCodes[localName].clear();
        this.codeTimestamps[localName] = {};
        this.codeUsers[localName] = {};
        
        const keys = Object.keys(listData).filter(k => k !== 'eslesenler' && k !== 'adet');
        
        keys.forEach(code => {
          const val = listData[code];
          
          if (typeof val === 'object') {
            const user = val.user || '';
            const ts = val.ts || '';
            this.codeTimestamps[localName][code] = ts;
            this.codeUsers[localName][code] = user;
            this.userCodes[localName].add(code);
            if (localName !== 'teslimEdilenler') {
              this.allCodes.add(code);
            }
          } else {
            this.codeTimestamps[localName][code] = val;
            this.codeUsers[localName][code] = null;
            this.userCodes[localName].add(code);
            if (localName !== 'teslimEdilenler') {
              this.allCodes.add(code);
            }
          }
        });
        
        if (listData.eslesenler) {
          Object.keys(listData.eslesenler).forEach(code => this.scannedCodes.add(code));
        }
      }
      
      // Global scanned codes
      const scannedData = await firebaseService.getData(`${DB_PATHS.servis}/eslesenler`);
      if (scannedData) {
        this.scannedCodes.clear();
        Object.keys(scannedData).forEach(code => this.scannedCodes.add(code));
      }
      
      return true;
    } catch (error) {
      console.error('Load data error:', error);
      return false;
    }
  }

  async saveBarcodeHistory(code, fromList, toList, user) {
    const timestamp = getTimestamp();
    const historyEntry = {
      from: fromList || 'Yeni Ekleme',
      to: toList,
      user: user,
      timestamp: timestamp,
      timestampRaw: Date.now()
    };
    
    try {
      await firebaseService.getDatabase()
        .ref(`${DB_PATHS.history}/${code}`)
        .push(historyEntry);
      return true;
    } catch (error) {
      console.error('Save history error:', error);
      return false;
    }
  }

  async getBarcodeHistory(code) {
    try {
      const historyData = await firebaseService.getData(`${DB_PATHS.history}/${code}`);
      if (!historyData) return [];
      
      return Object.values(historyData).sort((a, b) => b.timestampRaw - a.timestampRaw);
    } catch (error) {
      console.error('Get history error:', error);
      return [];
    }
  }

  async addBarcode(listName, code, user) {
    const dbPath = listName === 'onarim' ? 'onarimTamamlandi' : listName;
    const timestamp = getTimestamp();
    
    try {
      await firebaseService.setData(`${DB_PATHS.servis}/${dbPath}/${code}`, {
        ts: timestamp,
        user: user
      });
      
      this.userCodes[listName].add(code);
      this.codeTimestamps[listName][code] = timestamp;
      this.codeUsers[listName][code] = user;
      
      if (listName !== 'teslimEdilenler') {
        this.allCodes.add(code);
      }
      
      return true;
    } catch (error) {
      console.error('Add barcode error:', error);
      return false;
    }
  }

  async removeBarcode(listName, code) {
    const dbPath = listName === 'onarim' ? 'onarimTamamlandi' : listName;
    
    try {
      await firebaseService.removeData(`${DB_PATHS.servis}/${dbPath}/${code}`);
      
      this.userCodes[listName].delete(code);
      delete this.codeTimestamps[listName][code];
      delete this.codeUsers[listName][code];
      
      return true;
    } catch (error) {
      console.error('Remove barcode error:', error);
      return false;
    }
  }

  findBarcodeInLists(code) {
    const foundIn = [];
    
    Object.entries(this.userCodes).forEach(([listName, codeSet]) => {
      if (codeSet && codeSet.has(code)) {
        foundIn.push({
          listName: listName,
          displayName: LIST_NAMES[listName] || listName,
          timestamp: this.codeTimestamps[listName][code],
          user: this.codeUsers[listName][code]
        });
      }
    });
    
    return foundIn;
  }

  async updateListCount(listName) {
    const count = this.userCodes[listName]?.size || 0;
    const dbPath = listName === 'onarim' ? 'onarimTamamlandi' : listName;
    
    try {
      await firebaseService.setData(`${DB_PATHS.servis}/${dbPath}/adet`, count);
      return count;
    } catch (error) {
      console.error('Update count error:', error);
      return count;
    }
  }

  removeFromOtherLists(code, exceptList) {
    let removedFrom = null;
    
    Object.keys(this.userCodes).forEach(listName => {
      if (listName !== exceptList && this.userCodes[listName]?.has(code)) {
        removedFrom = listName;
        this.userCodes[listName].delete(code);
        delete this.codeTimestamps[listName][code];
        delete this.codeUsers[listName][code];
        
        const dbPath = listName === 'onarim' ? 'onarimTamamlandi' : listName;
        firebaseService.removeData(`${DB_PATHS.servis}/${dbPath}/${code}`);
      }
    });
    
    return removedFrom;
  }

  getListStats() {
    const stats = {};
    
    Object.entries(this.userCodes).forEach(([listName, codeSet]) => {
      stats[listName] = {
        count: codeSet.size,
        displayName: LIST_NAMES[listName] || listName
      };
    });
    
    return stats;
  }
}

export const databaseService = new DatabaseService();
export default databaseService;