import firebaseService from './firebase.service.js';
import { DB_PATHS, ROLE_CONFIG } from '../config/constants.js';
import toast from '../utils/toast.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.currentUserRole = null;
    this.currentUserName = null;
    this.currentUserPermissions = null;
  }

initialize() {
    const auth = firebaseService.getAuth();
    
    // EKLENEN SATIR: Butonların tıklanabilmesi için dinleyicileri en başta başlatıyoruz
    this.attachEventListeners();

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.handleUserLogin(user);
      } else {
        this.handleUserLogout();
      }
    });
  }

  
  async handleUserLogin(user) {
    this.currentUser = user;
    this.currentUserName = user.email.split('@')[0];
    
    // Global erişim için window'a ekle
    window.currentUserName = this.currentUserName;
    
    try {
      // Özel kullanıcı kontrolleri
      if (user.email === 'admin@servis.com') {
        await this.ensureAdminExists(user.uid);
        this.currentUserRole = 'admin';
      } else if (user.email === 'depo@mobilfon.com') {
        await this.ensureWarehouseExists(user.uid);
        this.currentUserRole = 'warehouse';
      } else {
        // Normal kullanıcı rol kontrolü
        const userData = await firebaseService.getData(`${DB_PATHS.users}/${user.uid}`);
        
        if (userData && userData.role) {
          this.currentUserRole = userData.role;
          this.currentUserPermissions = userData.permissions || null;
        } else {
          this.currentUserRole = this.inferRole(this.currentUserName);
        }
      }
      
      window.currentUserRole = this.currentUserRole;
      window.currentUserPermissions = this.currentUserPermissions;
      
      await this.setupUI();
      
    } catch (error) {
      console.error('User login handling error:', error);
      this.currentUserRole = 'viewer';
    }
  }

  handleUserLogout() {
    this.currentUser = null;
    this.currentUserRole = null;
    this.currentUserName = null;
    this.currentUserPermissions = null;
    
    window.currentUserName = null;
    window.currentUserRole = null;
    window.currentUserPermissions = null;
    
    this.showLoginScreen();
  }

  async ensureAdminExists(uid) {
    const adminData = await firebaseService.getData(`${DB_PATHS.users}/${uid}`);
    if (!adminData) {
      await firebaseService.setData(`${DB_PATHS.users}/${uid}`, {
        email: 'admin@servis.com',
        role: 'admin',
        createdAt: Date.now(),
        createdBy: 'System'
      });
    }
  }

  async ensureWarehouseExists(uid) {
    const warehouseData = await firebaseService.getData(`${DB_PATHS.users}/${uid}`);
    if (!warehouseData) {
      await firebaseService.setData(`${DB_PATHS.users}/${uid}`, {
        email: 'depo@mobilfon.com',
        role: 'warehouse',
        createdAt: Date.now(),
        createdBy: 'System'
      });
    }
  }

  inferRole(username) {
    if (username === 'admin') return 'admin';
    if (['samil', 'ibrahim'].includes(username)) return 'semi-admin';
    if (username === 'enes') return 'editor';
    return 'viewer';
  }

  async login(email, password) {
    try {
      const auth = firebaseService.getAuth();
      await auth.signInWithEmailAndPassword(email, password);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      let message = 'Giriş başarısız!';
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          message = 'Email veya şifre hatalı!';
          break;
        case 'auth/user-not-found':
          message = 'Kullanıcı bulunamadı!';
          break;
        case 'auth/invalid-email':
          message = 'Geçersiz email adresi!';
          break;
        case 'auth/too-many-requests':
          message = 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.';
          break;
      }
      
      return { success: false, message };
    }
  }

  async logout() {
    try {
      const auth = firebaseService.getAuth();
      await auth.signOut();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, message: 'Çıkış yapılırken hata oluştu!' };
    }
  }

  async setupUI() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('adminNav').style.display = 'flex';
    document.getElementById('navUserInfo').style.display = 'flex';
    
    const config = ROLE_CONFIG[this.currentUserRole] || ROLE_CONFIG['viewer'];
    
    // User bilgilerini göster
    const userName = config.text.includes('Admin') || config.text.includes('Depocu') 
      ? config.text 
      : `${this.currentUserName.charAt(0).toUpperCase() + this.currentUserName.slice(1)} (${config.text})`;
    
    document.getElementById('navUserName').textContent = `${config.icon} ${userName}`;
    
    // Panel görünürlüklerini ayarla
    document.getElementById('adminPanel').style.display = config.showAdminPanel ? 'block' : 'none';
    document.getElementById('userManagementBtn').style.display = config.showUserManagement ? 'block' : 'none';
    document.getElementById('resetDashboardBtn').style.display = (this.currentUserRole === 'admin') ? 'block' : 'none';
    
    // Dashboard göster (admin veya semi-admin ise)
    if (this.currentUserRole === 'admin' || this.currentUserRole === 'semi-admin') {
      document.getElementById('dashboardPanel').style.display = 'block';
      
      // Dashboard modülünü import et ve başlat
      const { dashboardModule } = await import('../modules/dashboard.module.js');
      await dashboardModule.initialize();
    }
    
    // Warehouse panel
    if (this.currentUserRole === 'warehouse') {
      document.getElementById('warehousePanel').style.display = 'block';
      const { warehouseModule } = await import('../modules/warehouse.module.js');
      await warehouseModule.initialize();
    }
    
    // Event listeners
    this.attachEventListeners();
  }

  showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('adminNav').style.display = 'none';
  }

  attachEventListeners() {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('navLogoutButton');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    
    if (loginButton) {
      loginButton.onclick = async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
          this.showError('Email ve şifre gereklidir!');
          return;
        }
        
        loginButton.disabled = true;
        loginButton.textContent = 'Giriş yapılıyor...';
        
        const result = await this.login(email, password);
        
        if (!result.success) {
          this.showError(result.message);
        }
        
        loginButton.disabled = false;
        loginButton.textContent = 'Giriş Yap';
      };
    }
    
    if (passwordInput) {
      passwordInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          loginButton.click();
        }
      };
    }
    
    if (logoutButton) {
      logoutButton.onclick = async () => {
        await this.logout();
      };
    }
  }

  showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }

  hasPermission(listName, permissionType = 'view') {
    if (this.currentUserRole === 'admin') return true;
    if (this.currentUserRole === 'semi-admin') return permissionType === 'view';
    if (this.currentUserRole === 'technician') {
      if (!this.currentUserPermissions) return false;
      const permission = this.currentUserPermissions[listName];
      if (!permission) return false;
      if (permissionType === 'view') return true;
      return permission === 'edit';
    }
    return false;
  }
}

export const authService = new AuthService();

export default authService;
