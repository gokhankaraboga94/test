// ========================================
// APPLICATION CONSTANTS
// ========================================

export const FIREBASE_CONFIG = {
        apiKey: "AIzaSyCbwCl4dKOV7w9e1enR_pxG8GyNIbmzCNs",
      authDomain: "cokluhaber-dc6ff.firebaseapp.com",
      projectId: "cokluhaber-dc6ff",
      storageBucket: "cokluhaber-dc6ff.appspot.com",
      messagingSenderId: "433806685700",
      appId: "1:433806685700:web:8bedc51407c6c4b56f2751",
      measurementId: "G-TYRTT351HP",
      databaseURL: "https://cokluhaber-dc6ff-default-rtdb.firebaseio.com/"
};




export const LIST_NAMES = {
  atanacak: '📋 Atanacak',
  parcaBekliyor: '⚙️ Parça Bekliyor',
  phonecheck: '📱 PhoneCheck',
  gokhan: '🧑‍🔧 Gökhan',
  enes: '🧑‍🔧 Enes',
  yusuf: '🧑‍🔧 Yusuf',
  samet: '🧑‍🔧 Samet',
  engin: '🧑‍🔧 Engin',
  ismail: '🧑‍🔧 İsmail',
  mehmet: '🧑‍🔧 Mehmet',
  onarim: '🔧 Onarım Tamamlandı',
  onCamDisServis: '🔨 Ön Cam Dış Servis',
  anakartDisServis: '🔨 Anakart Dış Servis',
  satisa: '💰 Satışa Gidecek',
  sahiniden: '🏪 Sahibinden',
  mediaMarkt: '🛒 Media Markt',
  SonKullanıcı: '👤 Son Kullanıcı',
  teslimEdilenler: '✅ Teslim Edilenler'
};

export const ROLE_CONFIG = {
  admin: {
    icon: '👑',
    text: 'Admin',
    gradient: 'linear-gradient(135deg, #93fb98ff, #5796f5ff)',
    showAdminPanel: true,
    showUserManagement: true,
    showNav: true
  },
  'semi-admin': {
    icon: '👔',
    text: 'Yarı Admin',
    gradient: 'linear-gradient(135deg, #f39c12, #e67e22)',
    showAdminPanel: true,
    showUserManagement: false,
    showNav: false
  },
  editor: {
    icon: '✏️',
    text: 'Düzenleyici',
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
    showAdminPanel: false,
    showUserManagement: false,
    showNav: false
  },
  viewer: {
    icon: '👁️',
    text: 'Görüntüleyici',
    gradient: 'linear-gradient(135deg, #95a5a6, #7f8c8d)',
    showAdminPanel: false,
    showUserManagement: false,
    showNav: false
  },
  technician: {
    icon: '🔧',
    text: 'Teknisyen',
    gradient: 'linear-gradient(135deg, #e67e22, #d35400)',
    showAdminPanel: false,
    showUserManagement: false,
    showNav: false
  },
  warehouse: {
    icon: '📦',
    text: 'Depocu',
    gradient: 'linear-gradient(135deg, #2ecc71, #27ae60)',
    showAdminPanel: false,
    showUserManagement: false,
    showNav: true,
    showWarehousePanel: true
  }
};

export const TECHNICIAN_USERS = [
  'gokhan', 'samet', 'yusuf', 'ismail', 'engin', 'mehmet', 'enes'
];

export const SPECIAL_LISTS = [
  'phonecheck', 'parcaBekliyor', 'atanacak', 'onarim', 
  'onCamDisServis', 'anakartDisServis', 'satisa', 
  'sahiniden', 'mediaMarkt', 'SonKullanıcı', 'teslimEdilenler'
];

export const DASHBOARD_SOURCE_LISTS = [
  'atanacak', 'SonKullanıcı', 'sahiniden', 'mediaMarkt'
];

export const DB_PATHS = {
  users: 'users',
  servis: 'servis',
  history: 'servis/history',
  partOrders: 'partOrders',
  dashboard: 'dashboard',
  serviceReturns: 'servis/serviceReturns'
};

export const TIMEOUTS = {
  SCANNER: 150,
  SEARCH: 300,
  CONFLICT_CHECK: 60000,
  AUTO_REFRESH: 600000 // 10 dakika
};

export const PERMISSIONS = {
  VIEW: 'view',
  EDIT: 'edit'
};


<script>       

<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>


</script>

