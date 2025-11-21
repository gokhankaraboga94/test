import { FIREBASE_CONFIG } from '../config/constants.js';

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
  }

  initialize() {
    if (!this.app) {
      this.app = firebase.initializeApp(FIREBASE_CONFIG);
      this.auth = firebase.auth();
      this.db = firebase.database();
    }
    return this;
  }

  getAuth() {
    return this.auth;
  }

  getDatabase() {
    return this.db;
  }

  getRef(path) {
    return this.db.ref(path);
  }

  async getData(path) {
    try {
      const snapshot = await this.getRef(path).once('value');
      return snapshot.val();
    } catch (error) {
      console.error(`Error getting data from ${path}:`, error);
      throw error;
    }
  }

  async setData(path, data) {
    try {
      await this.getRef(path).set(data);
      return true;
    } catch (error) {
      console.error(`Error setting data at ${path}:`, error);
      throw error;
    }
  }

  async updateData(path, data) {
    try {
      await this.getRef(path).update(data);
      return true;
    } catch (error) {
      console.error(`Error updating data at ${path}:`, error);
      throw error;
    }
  }

  async removeData(path) {
    try {
      await this.getRef(path).remove();
      return true;
    } catch (error) {
      console.error(`Error removing data from ${path}:`, error);
      throw error;
    }
  }

  onValue(path, callback) {
    this.getRef(path).on('value', callback);
  }

  offValue(path) {
    this.getRef(path).off('value');
  }
}

export const firebaseService = new FirebaseService().initialize();
export default firebaseService;