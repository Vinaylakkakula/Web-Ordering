/**
 * Gourmet Express - Application Controller (app.js)
 * State management, rendering engine, cart logic, and backend integrations.
 */

class WebOrderingApp {
    constructor() {
        // App State
        this.cart = [];
        this.items = [];
        this.categories = [];
        this.branches = [];
        this.banners = [];
        this.orders = [];
        this.users = [];
        this.coupons = [];
        this.settings = {
            delivery_fee: 50.00, // Indian Rupee default fee
            tax_rate: 0.05,      // 5% GST rate
            drive_folder_id: ""
        };

        this.currentUser = null; 
        this.currentView = 'customer'; 
        this.orderType = 'Delivery'; 
        this.selectedCity = '';
        this.selectedBranch = '';
        this.activeCategory = 'Popular!';
        this.searchQuery = '';
        this.currentBannerIndex = 0;
        this.activeAdminTab = 'items';
        
        // Database Mode Integration
        this.dbMode = 'mock'; 
        this.gasUrl = ''; 
        
        // Timer references
        this.carouselInterval = null;
        this.syncInterval = null;

        // Form assets
        this.uploadedImageBase64 = null;
        this.uploadedImageName = null;

        // Auto-refresh countdown for dashboards (2 seconds)
        this.refreshRateMs = 2000;
    }

    // ==========================================================================
    // INITIALIZATION & CONFIGURATION
    // ==========================================================================
    async init() {
        // Redefine window.alert to route to custom premium toast notifications
        window.alert = (message) => {
            let type = 'info';
            const msgLower = String(message || '').toLowerCase();
            if (msgLower.includes('success') || msgLower.includes('saved') || msgLower.includes('successfully') || msgLower.includes('configured')) {
                type = 'success';
            } else if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('invalid') || msgLower.includes('wrong') || msgLower.includes('cannot')) {
                type = 'error';
            } else if (msgLower.includes('empty') || msgLower.includes('select') || msgLower.includes('complete') || msgLower.includes('warning') || msgLower.includes('sure') || msgLower.includes('before checkout')) {
                type = 'warning';
            }
            this.showNotification(message, type);
        };

        this.loadSettingsFromStorage();
        this.initMockDatabase();
        await this.loadDatabase();

        // Bind events & set up DOM elements
        this.bindEvents();
        
        // Render Customer Homepage views
        this.renderCitySelect();
        this.renderCategories();
        this.renderMenu();
        this.renderCarousel();
        this.updateCartBadge();
        
        // Start auto-slide banners
        this.startCarouselTimer();
        
        // Start real-time sync loops
        this.startSyncTimer();

        // New Custom Aesthetics
        this.initTheme();
        this.initBackgroundParticles();
        this.renderStories();
    }

    loadSettingsFromStorage() {
        const storedMode = localStorage.getItem('ordering_db_mode');
        if (storedMode) this.dbMode = storedMode;
        
        const storedUrl = localStorage.getItem('ordering_gas_url');
        if (storedUrl) this.gasUrl = storedUrl;

        // Update UI inputs to match
        const dbModeRadio = document.querySelector(`input[name="db-mode"][value="${this.dbMode}"]`);
        if (dbModeRadio) dbModeRadio.checked = true;

        const gasUrlInput = document.getElementById('gas-endpoint-url');
        if (gasUrlInput) gasUrlInput.value = this.gasUrl;
        
        const gasUrlGroup = document.getElementById('gas-url-group');
        if (this.dbMode === 'live') {
            gasUrlGroup.classList.remove('hidden');
        } else {
            gasUrlGroup.classList.add('hidden');
        }

        // Cart persistence
        const savedCart = localStorage.getItem('ordering_cart');
        if (savedCart) {
            try {
                this.cart = JSON.parse(savedCart);
            } catch(e) {
                this.cart = [];
            }
        }
    }

    saveSettings() {
        const mode = document.querySelector('input[name="db-mode"]:checked').value;
        const url = document.getElementById('gas-endpoint-url').value.trim();

        if (mode === 'live' && !url) {
            alert('Please specify a valid Google Apps Script Web App URL for live mode.');
            return;
        }

        this.dbMode = mode;
        this.gasUrl = url;

        localStorage.setItem('ordering_db_mode', this.dbMode);
        localStorage.setItem('ordering_gas_url', this.gasUrl);

        alert('Settings saved. Reloading database...');
        this.closeSettingsModal();
        this.loadDatabase().then(() => {
            this.renderCitySelect();
            this.renderCategories();
            this.renderMenu();
            this.renderCarousel();
            this.setView('customer');
        });
    }

    // ==========================================================================
    // BACKEND API SERVICE LAYER
    // ==========================================================================
    async apiCall(action, data = {}) {
        if (this.dbMode === 'mock') {
            return this.mockApiCall(action, data);
        }

        let loaderText = 'Syncing data...';
        switch (action) {
            case 'init': loaderText = 'Loading store details...'; break;
            case 'getOrders': loaderText = 'Fetching orders list...'; break;
            case 'getUsers': loaderText = 'Loading user accounts...'; break;
            case 'saveItem': loaderText = 'Saving menu item...'; break;
            case 'deleteItem': loaderText = 'Deleting menu item...'; break;
            case 'saveCategory': loaderText = 'Saving category...'; break;
            case 'deleteCategory': loaderText = 'Deleting category...'; break;
            case 'saveBranch': loaderText = 'Saving branch location...'; break;
            case 'deleteBranch': loaderText = 'Deleting branch...'; break;
            case 'saveBanner': loaderText = 'Saving banner...'; break;
            case 'deleteBanner': loaderText = 'Deleting banner...'; break;
            case 'submitOrder': loaderText = 'Placing your order...'; break;
            case 'updateOrderStatus': loaderText = 'Updating order status...'; break;
            case 'cancelOrder': loaderText = 'Cancelling order...'; break;
            case 'saveSettings': loaderText = 'Updating store settings...'; break;
            default: loaderText = 'Loading database...'; break;
        }
        this.showLoader(loaderText);
        try {
            const response = await fetch(this.gasUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({ action, data })
            });

            if (!response.ok) {
                throw new Error(`HTTP network error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            this.hideLoader();

            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error || 'Server processing failed.');
            }
        } catch (err) {
            this.hideLoader();
            console.error('GAS API Error:', err);
            alert(`API Connection Failed: ${err.message}\nEnsure Web App URL is correct and permissions are set to "Anyone".`);
            throw err;
        }
    }

    async loadDatabase() {
        try {
            const db = await this.apiCall('init');
            this.items = db.items || [];
            this.categories = db.categories || [];
            this.branches = db.branches || [];
            this.banners = db.banners || [];
            
            if (db.settings) {
                this.settings.delivery_fee = parseFloat(db.settings.delivery_fee) || 50.00;
                this.settings.tax_rate = parseFloat(db.settings.tax_rate) || 0.05;
                this.settings.drive_folder_id = db.settings.drive_folder_id || "";
                
                if (db.settings.coupons) {
                    try {
                        this.coupons = JSON.parse(db.settings.coupons);
                    } catch(e) {
                        this.coupons = [];
                    }
                }
            }
            
            if (this.coupons.length === 0) {
                if (this.dbMode === 'mock') {
                    this.coupons = this.getMockData('coupons');
                } else {
                    this.coupons = [
                        { code: 'WELCOME10', type: 'percentage', value: 0.10, min_order: 100, label: '10% OFF', active: true, desc: 'Get 10% off on your first order' },
                        { code: 'FREEDEL', type: 'freedelivery', value: 0, min_order: 250, label: 'FREE Delivery', active: true, desc: 'Free delivery on orders above ₹250' },
                        { code: 'VINAY20', type: 'percentage', value: 0.20, min_order: 300, label: '20% OFF', active: true, desc: 'Get 20% off on orders above ₹300' }
                    ];
                }
            }
            
            this.users = await this.apiCall('getUsers');
            this.orders = await this.apiCall('getOrders');
        } catch (err) {
            console.error('Failed to load database. Reverting to mock arrays.', err);
            this.dbMode = 'mock';
            localStorage.setItem('ordering_db_mode', 'mock');
            this.loadSettingsFromStorage();
            await this.loadDatabase();
        }
    }

    async refreshOrdersOnly() {
        try {
            const countSpinner = document.getElementById('kitchen-refresh-spinner');
            if (countSpinner) countSpinner.classList.add('fa-spin');

            let actionName = 'getOrders';
            let data = {};
            if (this.dbMode === 'mock') {
                this.orders = this.getMockData('Orders');
            } else {
                const response = await fetch(this.gasUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: actionName, data })
                });
                const result = await response.json();
                if (result.success) {
                    this.orders = result.data;
                }
            }
            
            if (countSpinner) {
                setTimeout(() => countSpinner.classList.remove('fa-spin'), 600);
            }

            // Play alert sound if new orders land in Pending
            const pendingOrders = this.orders.filter(o => o.status === 'Pending');
            if (pendingOrders.length > this.previousPendingCount) {
                this.playSynthChime('alert');
            }
            this.previousPendingCount = pendingOrders.length;

            if (this.currentView === 'kitchen') {
                this.renderKitchenDashboard();
            } else if (this.currentView === 'rider') {
                this.renderRiderDashboard();
            } else if (this.currentView === 'admin') {
                if (this.activeAdminTab === 'analytics') {
                    this.renderAdminAnalytics();
                } else if (this.activeAdminTab === 'orders') {
                    const container = document.getElementById('admin-content-container');
                    this.renderAdminOrders(container);
                }
            }

            const trackModal = document.getElementById('track-modal');
            if (trackModal && trackModal.classList.contains('open')) {
                const trackId = document.getElementById('track-order-id-input').value.trim();
                if (trackId) {
                    const currentOrder = this.orders.find(o => o.id === trackId);
                    if (currentOrder) {
                        this.renderTrackOrder(currentOrder);
                    }
                }
            }
        } catch(e) {
            console.error('Silent refresh failed:', e);
        }
    }

    async triggerDbInit() {
        if (!confirm('Warning: This will reset or initialize the database tables with default seed data. Proceed?')) return;
        
        try {
            if (this.dbMode === 'mock') {
                localStorage.removeItem('ordering_db_items');
                localStorage.removeItem('ordering_db_categories');
                localStorage.removeItem('ordering_db_branches');
                localStorage.removeItem('ordering_db_banners');
                localStorage.removeItem('ordering_db_users');
                localStorage.removeItem('ordering_db_orders');
                localStorage.removeItem('ordering_db_settings');
                this.initMockDatabase(true);
            } else {
                await this.apiCall('init');
            }
            
            alert('Database Reset Successful!');
            await this.loadDatabase();
            this.renderCitySelect();
            this.renderCategories();
            this.renderMenu();
            this.renderCarousel();
            this.closeSettingsModal();
        } catch (e) {
            alert('Reset error: ' + e.message);
        }
    }

    // ==========================================================================
    // CLIENT-SIDE LOCAL STORAGE (MOCK MODE DATABASE)
    // ==========================================================================
    initMockDatabase(forceReset = false) {
        const getSeed = (key) => localStorage.getItem('ordering_db_' + key);
        
        if (!getSeed('items') || forceReset) {
            const seedItems = [
                { id: "ITM-1", name: "Classic Pepperoni Pizza", description: "Delicious mozzarella cheese with load of beef pepperonis on hand-tossed dough.", price: 349.00, category: "Pizza Flavors", image_url: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500", status_badge: "Popular!", available: true, branches: "All" },
                { id: "ITM-2", name: "Garlic Butter Parmesan Bread", description: "Warm toasted bread coated with melted butter, chopped garlic, parsley and parmesan cheese.", price: 149.00, category: "Starters", image_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500", status_badge: "Hot", available: true, branches: "All" },
                { id: "ITM-3", name: "Buffalo Chicken Wings", description: "Crispy fried chicken wings tossed in spicy red-hot buffalo sauce served with ranch.", price: 249.00, category: "Starters", image_url: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500", status_badge: "New", available: true, branches: "All" },
                { id: "ITM-4", name: "Double Fudge Chocolate Brownie", description: "Rich chocolate brownie baked with fudge chunks, topped with vanilla ice cream syrup.", price: 129.00, category: "Desserts", image_url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500", status_badge: "Discount 10%", available: true, branches: "All" },
                { id: "ITM-5", name: "Gourmet Margherita Pizza", description: "Fresh vine-ripened tomatoes, sweet basil leaves, and sliced fresh buffalo mozzarella.", price: 299.00, category: "Pizza Flavors", image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500", status_badge: "Popular!", available: true, branches: "All" },
                { id: "ITM-6", name: "Cold Premium Lemonade", description: "Freshly squeezed lemon juice, sparkling water, mint leaves, and ice.", price: 79.00, category: "Beverages & Extras", image_url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500", status_badge: "", available: true, branches: "All" }
            ];
            localStorage.setItem('ordering_db_items', JSON.stringify(seedItems));
        }
        
        if (!getSeed('categories') || forceReset) {
            const seedCats = [
                { id: "CAT-1", name: "Popular!", active: true },
                { id: "CAT-2", name: "Starters", active: true },
                { id: "CAT-3", name: "Pizza Flavors", active: true },
                { id: "CAT-4", name: "Desserts", active: true },
                { id: "CAT-5", name: "Beverages & Extras", active: true }
            ];
            localStorage.setItem('ordering_db_categories', JSON.stringify(seedCats));
        }

        if (!getSeed('branches') || forceReset) {
            const seedBranches = [
                { id: "BRH-1", city: "Mumbai", name: "Bandra West", address: "Linking Road, Bandra, Mumbai", active: true },
                { id: "BRH-2", city: "Mumbai", name: "Andheri East", address: "Sakinaka, Andheri, Mumbai", active: true },
                { id: "BRH-3", city: "Delhi", name: "Connaught Place", address: "Inner Circle, Connaught Place, New Delhi", active: true },
                { id: "BRH-4", city: "Delhi", name: "South Ext", address: "Ring Road, South Extension, New Delhi", active: true }
            ];
            localStorage.setItem('ordering_db_branches', JSON.stringify(seedBranches));
        }

        if (!getSeed('banners') || forceReset) {
            const seedBanners = [
                { id: "BAN-1", title: "New Menu Items", subtitle: "Try our delicious new additions today", image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200", link_url: "#", active: true },
                { id: "BAN-2", title: "Weekend Crazy Double Deals", subtitle: "Buy 1 Get 1 Free on all Large Pizzas", image_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200", link_url: "#", active: true }
            ];
            localStorage.setItem('ordering_db_banners', JSON.stringify(seedBanners));
        }

        if (!getSeed('users') || forceReset) {
            const seedUsers = [
                { id: "USR-1", username: "admin", password: "admin", role: "Admin", name: "Chief Administrator", status: true },
                { id: "USR-2", username: "kitchen", password: "kitchen", role: "Kitchen", name: "Main Kitchen Chef", status: true },
                { id: "USR-3", username: "rider", password: "rider", role: "Rider", name: "Express Rider Johnny", status: true, earnings: 0.00 }
            ];
            localStorage.setItem('ordering_db_users', JSON.stringify(seedUsers));
        }

        if (!getSeed('orders') || forceReset) {
            localStorage.setItem('ordering_db_orders', JSON.stringify([]));
        }

        if (!getSeed('settings') || forceReset) {
            const seedSettings = [
                { key: "drive_folder_id", value: "" },
                { key: "delivery_fee", value: "50.00" },
                { key: "tax_rate", value: "0.05" },
                { key: "hero_background_url", value: "https://media.tenor.com/y2h2652Bv8gAAAAd/pizza-pizza-oven.gif" }
            ];
            localStorage.setItem('ordering_db_settings', JSON.stringify(seedSettings));
        }

        if (!getSeed('coupons') || forceReset) {
            const seedCoupons = [
                { code: 'WELCOME10', type: 'percentage', value: 0.10, min_order: 100, label: '10% OFF', active: true, desc: 'Get 10% off on your first order' },
                { code: 'FREEDEL', type: 'freedelivery', value: 0, min_order: 250, label: 'FREE Delivery', active: true, desc: 'Free delivery on orders above ₹250' },
                { code: 'VINAY20', type: 'percentage', value: 0.20, min_order: 300, label: '20% OFF', active: true, desc: 'Get 20% off on orders above ₹300' }
            ];
            localStorage.setItem('ordering_db_coupons', JSON.stringify(seedCoupons));
        }
    }

    getMockData(key) {
        return JSON.parse(localStorage.getItem('ordering_db_' + key.toLowerCase()) || '[]');
    }

    saveMockData(key, data) {
        localStorage.setItem('ordering_db_' + key.toLowerCase(), JSON.stringify(data));
    }

    mockApiCall(action, data) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const getTable = (k) => this.getMockData(k);
                const saveTable = (k, d) => this.saveMockData(k, d);

                try {
                    switch (action) {
                        case 'init': {
                            const mockSets = getTable('Settings') || [];
                            const setsMap = {};
                            mockSets.forEach(s => {
                                setsMap[s.key] = s.value;
                            });
                            resolve({
                                items: getTable('Items'),
                                categories: getTable('Categories'),
                                branches: getTable('Branches'),
                                banners: getTable('Banners'),
                                settings: setsMap
                            });
                            break;
                        }

                        case 'getOrders':
                            resolve(getTable('Orders'));
                            break;

                        case 'getUsers':
                            resolve(getTable('Users'));
                            break;

                        case 'saveItem': {
                            const rows = getTable('Items');
                            if (!data.id) {
                                data.id = "ITM-" + Math.floor(1000 + Math.random() * 9000);
                                rows.push(data);
                            } else {
                                const idx = rows.findIndex(r => r.id === data.id);
                                if (idx !== -1) rows[idx] = data;
                            }
                            saveTable('Items', rows);
                            resolve(data);
                            break;
                        }

                        case 'deleteItem': {
                            const rows = getTable('Items');
                            const filtered = rows.filter(r => r.id !== data.id);
                            saveTable('Items', filtered);
                            resolve({ success: true });
                            break;
                        }

                        case 'saveCategory': {
                            const rows = getTable('Categories');
                            if (!data.id) {
                                data.id = "CAT-" + Math.floor(100 + Math.random() * 900);
                                rows.push(data);
                            } else {
                                const idx = rows.findIndex(r => r.id === data.id);
                                if (idx !== -1) rows[idx] = data;
                            }
                            saveTable('Categories', rows);
                            resolve(data);
                            break;
                        }

                        case 'deleteCategory': {
                            const rows = getTable('Categories');
                            const filtered = rows.filter(r => r.id !== data.id);
                            saveTable('Categories', filtered);
                            resolve({ success: true });
                            break;
                        }

                        case 'saveBranch': {
                            const rows = getTable('Branches');
                            if (!data.id) {
                                data.id = "BRH-" + Math.floor(100 + Math.random() * 900);
                                rows.push(data);
                            } else {
                                const idx = rows.findIndex(r => r.id === data.id);
                                if (idx !== -1) rows[idx] = data;
                            }
                            saveTable('Branches', rows);
                            resolve(data);
                            break;
                        }

                        case 'deleteBranch': {
                            const rows = getTable('Branches');
                            const filtered = rows.filter(r => r.id !== data.id);
                            saveTable('Branches', filtered);
                            resolve({ success: true });
                            break;
                        }

                        case 'saveBanner': {
                            const rows = getTable('Banners');
                            if (!data.id) {
                                data.id = "BAN-" + Math.floor(100 + Math.random() * 900);
                                rows.push(data);
                            } else {
                                const idx = rows.findIndex(r => r.id === data.id);
                                if (idx !== -1) rows[idx] = data;
                            }
                            saveTable('Banners', rows);
                            resolve(data);
                            break;
                        }

                        case 'deleteBanner': {
                            const rows = getTable('Banners');
                            const filtered = rows.filter(r => r.id !== data.id);
                            saveTable('Banners', filtered);
                            resolve({ success: true });
                            break;
                        }

                        case 'saveUser': {
                            const rows = getTable('Users');
                            if (!data.id) {
                                data.id = "USR-" + Math.floor(100 + Math.random() * 900);
                                rows.push(data);
                            } else {
                                const idx = rows.findIndex(r => r.id === data.id);
                                if (idx !== -1) rows[idx] = data;
                            }
                            saveTable('Users', rows);
                            resolve(data);
                            break;
                        }

                        case 'deleteUser': {
                            const rows = getTable('Users');
                            const filtered = rows.filter(r => r.id !== data.id);
                            saveTable('Users', filtered);
                            resolve({ success: true });
                            break;
                        }

                        case 'createOrder': {
                            const rows = getTable('Orders');
                            data.id = "ORD-" + Math.floor(100000 + Math.random() * 900000);
                            data.status = "Pending";
                            data.rider_id = "";
                            data.created_at = new Date().toISOString();
                            data.updated_at = new Date().toISOString();
                            rows.push(data);
                            saveTable('Orders', rows);
                            resolve(data);
                            break;
                        }

                        case 'updateOrderStatus': {
                            const rows = getTable('Orders');
                            const order = rows.find(r => r.id === data.orderId);
                            if (order) {
                                order.status = data.status;
                                order.updated_at = new Date().toISOString();
                                if (data.riderId !== undefined) {
                                    order.rider_id = data.riderId;
                                }
                                saveTable('Orders', rows);

                                if (data.status === 'Delivered' && order.rider_id) {
                                    const uRows = getTable('Users');
                                    const rider = uRows.find(u => u.id === order.rider_id);
                                    if (rider) {
                                        rider.earnings = parseFloat(rider.earnings || 0) + 50.00; // Flat ₹50 delivery commission
                                        saveTable('Users', uRows);
                                    }
                                }
                                resolve(order);
                            } else {
                                reject('Order not found');
                            }
                            break;
                        }

                        case 'login': {
                            const uRows = getTable('Users');
                            const matched = uRows.find(u => u.username.toLowerCase() === data.username.toLowerCase() && u.password === data.password && (u.status === true || u.status === "TRUE"));
                            if (matched) {
                                const copy = Object.assign({}, matched);
                                delete copy.password;
                                resolve(copy);
                            } else {
                                reject(new Error('Invalid username or password.'));
                            }
                            break;
                        }

                        case 'saveSettings': {
                            const sets = getTable('Settings') || [];
                            for (let key in data) {
                                const val = data[key];
                                const match = sets.find(s => s.key === key);
                                if (match) {
                                    match.value = val;
                                } else {
                                    sets.push({ key, value: val });
                                }
                            }
                            saveTable('Settings', sets);
                            resolve(data);
                            break;
                        }

                        case 'uploadImage':
                            resolve("https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500");
                            break;

                        default:
                            reject('Unknown action: ' + action);
                    }
                } catch(e) {
                    reject(e);
                }
            }, 300);
        });
    }

    // ==========================================================================
    // RENDERING ENGINE - CUSTOMER HOME
    // ==========================================================================
    renderCitySelect() {
        const selectCity = document.getElementById('select-city');
        const uniqueCities = [...new Set(this.branches.filter(b => b.active).map(b => b.city))];
        
        selectCity.innerHTML = '<option value="">Select City</option>';
        uniqueCities.forEach(city => {
            selectCity.innerHTML += `<option value="${city}">${city}</option>`;
        });
        
        if (uniqueCities.length > 0) {
            selectCity.value = uniqueCities[0];
            this.handleCityChange();
        }
    }

    handleCityChange() {
        const city = document.getElementById('select-city').value;
        this.selectedCity = city;
        
        const selectBranch = document.getElementById('select-branch');
        selectBranch.innerHTML = '<option value="">Select Branch</option>';
        
        const filteredBranches = this.branches.filter(b => b.city === city && b.active);
        filteredBranches.forEach(branch => {
            selectBranch.innerHTML += `<option value="${branch.id}">${branch.name}</option>`;
        });

        if (filteredBranches.length > 0) {
            selectBranch.value = filteredBranches[0].id;
            this.handleBranchChange();
        }
        
        this.renderMenu();
    }

    handleBranchChange() {
        const branchId = document.getElementById('select-branch').value;
        const branch = this.branches.find(b => b.id === branchId);
        this.selectedBranch = branch ? branch.name : '';
    }

    renderCategories() {
        const container = document.getElementById('categories-container');
        container.innerHTML = '';
        
        const activeCats = this.categories.filter(c => c.active);
        
        if (!activeCats.some(c => c.name === 'Popular!')) {
            activeCats.unshift({ id: 'popular', name: 'Popular!', active: true });
        }
        
        activeCats.forEach(cat => {
            const isActive = cat.name === this.activeCategory ? 'active' : '';
            container.innerHTML += `
                <div class="category-pill ${isActive}" onclick="app.setActiveCategory('${cat.name}', this)">
                    ${cat.name}
                </div>
            `;
        });
    }

    setActiveCategory(categoryName, element) {
        this.activeCategory = categoryName;
        
        document.querySelectorAll('.category-pill').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        
        // Reset search query when clicking categories
        this.searchQuery = '';
        const searchInput = document.getElementById('hero-menu-search');
        if (searchInput) searchInput.value = '';

        document.getElementById('current-category-title').textContent = categoryName;
        
        // Modern skeleton loaders delay
        this.renderMenuSkeletons();
        setTimeout(() => {
            this.renderMenu();
        }, 400);
    }

    handleSearchInput(event) {
        this.searchQuery = event.target.value.toLowerCase().trim();
        const catTitle = document.getElementById('current-category-title');
        if (this.searchQuery) {
            catTitle.innerHTML = `<i class="fa-solid fa-magnifying-glass mr-2" style="font-size:1.3rem; color:var(--primary-color);"></i> Search Results for "${event.target.value}"`;
        } else {
            catTitle.innerHTML = this.activeCategory;
        }
        this.renderMenu();
    }

    renderMenu() {
        const container = document.getElementById('menu-grid-container');
        container.innerHTML = '';
        
        const filteredItems = this.items.filter(item => {
            // City branch check first
            let branchMatches = false;
            if (!item.branches || item.branches === 'All') {
                branchMatches = true;
            } else if (this.selectedCity && item.branches.includes(this.selectedCity)) {
                branchMatches = true;
            }
            if (!branchMatches) return false;

            // Search filtering overrides categories
            if (this.searchQuery) {
                const nameMatch = item.name && item.name.toLowerCase().includes(this.searchQuery);
                const descMatch = item.description && item.description.toLowerCase().includes(this.searchQuery);
                return nameMatch || descMatch;
            }

            // Standard category filtering
            const catMatches = item.category === this.activeCategory;
            const isPopularFilter = this.activeCategory === 'Popular!' && item.status_badge === 'Popular!';
            return catMatches || isPopularFilter;
        });

        if (filteredItems.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fa-solid fa-cookie-bite" style="font-size: 3rem; margin-bottom: 10px; color: var(--text-muted);"></i>
                    <p>No dishes found matching this category or city branch.</p>
                </div>
            `;
            return;
        }

        filteredItems.forEach((item, idx) => {
            let tagHtml = '';
            if (item.status_badge) {
                let badgeClass = 'tag-popular';
                if (item.status_badge.toLowerCase().includes('new')) badgeClass = 'tag-new';
                if (item.status_badge.toLowerCase().includes('hot')) badgeClass = 'tag-hot';
                if (item.status_badge.toLowerCase().includes('discount')) badgeClass = 'tag-discount';
                
                tagHtml = `<div class="card-badge-tag ${badgeClass}">${item.status_badge}</div>`;
            }

            const inStock = item.available !== false && item.available !== "FALSE";
            const cardStockClass = inStock ? '' : 'out-of-stock';
            
            // Card click calls details popup; quick add button calls handleQuickAdd
            const cardClick = inStock ? `onclick="app.openProductDetailModal('${item.id}', event)"` : '';
            const actionClick = inStock ? `onclick="app.handleQuickAdd(event, '${item.id}')"` : '';

            // Add .animate-card class with staggared delays
            container.innerHTML += `
                <div class="menu-card ${cardStockClass} animate-card" ${cardClick} style="animation-delay: ${idx * 0.05}s">
                    ${tagHtml}
                    <div class="card-img-container">
                        <img src="${item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}" class="card-img" alt="${item.name}">
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">${item.name}</h3>
                        <p class="card-desc">${item.description || ''}</p>
                        <div class="card-footer">
                            <span class="card-price">₹${parseFloat(item.price).toFixed(2)}</span>
                            <div class="btn-add-cart-icon" ${actionClick}>
                                <i class="fa-solid fa-cart-plus"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    renderCarousel() {
        const container = document.getElementById('carousel-container');
        const dotsContainer = document.getElementById('carousel-dots-container');
        
        container.innerHTML = '';
        dotsContainer.innerHTML = '';
        
        const activeBanners = this.banners.filter(b => b.active);
        
        if (activeBanners.length === 0) {
            activeBanners.push({
                title: "Welcome to Vinay Cafe",
                subtitle: "Fresh ingredients cooked with premium passion",
                image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200"
            });
        }

        activeBanners.forEach((banner, idx) => {
            container.innerHTML += `
                <div class="carousel-slide">
                    <img src="${banner.image_url}" class="carousel-image" alt="${banner.title}">
                    <div class="carousel-slide-tint"></div>
                    <div class="carousel-slide-content">
                        <h2>${banner.title}</h2>
                        <p>${banner.subtitle}</p>
                    </div>
                </div>
            `;

            dotsContainer.innerHTML += `
                <div class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="app.setBannerSlide(${idx})"></div>
            `;
        });

        this.currentBannerIndex = 0;
        this.updateBannerSlidePosition();
    }

    startCarouselTimer() {
        if (this.carouselInterval) clearInterval(this.carouselInterval);
        this.carouselInterval = setInterval(() => {
            this.nextBanner();
        }, 5000);
    }

    setBannerSlide(index) {
        this.currentBannerIndex = index;
        this.updateBannerSlidePosition();
        this.startCarouselTimer();
    }

    nextBanner() {
        const slidesCount = document.querySelectorAll('.carousel-slide').length;
        if (slidesCount <= 1) return;
        this.currentBannerIndex = (this.currentBannerIndex + 1) % slidesCount;
        this.updateBannerSlidePosition();
    }

    prevBanner() {
        const slidesCount = document.querySelectorAll('.carousel-slide').length;
        if (slidesCount <= 1) return;
        this.currentBannerIndex = (this.currentBannerIndex - 1 + slidesCount) % slidesCount;
        this.updateBannerSlidePosition();
    }

    updateBannerSlidePosition() {
        const container = document.getElementById('carousel-container');
        if (!container) return;
        
        container.style.transform = `translateX(-${this.currentBannerIndex * 100}%)`;
        
        const dots = document.querySelectorAll('.carousel-dot');
        dots.forEach((dot, idx) => {
            if (idx === this.currentBannerIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // ==========================================================================
    // SHOPPING CART DRAWER ACTIONS
    // ==========================================================================
    setOrderType(type) {
        this.orderType = type;
        
        const btnDel = document.getElementById('btn-delivery');
        const btnPick = document.getElementById('btn-pickup');
        const addressGroup = document.getElementById('delivery-address-group');
        const addressInput = document.getElementById('cust-address');
        
        if (type === 'Delivery') {
            btnDel.classList.add('active');
            btnPick.classList.remove('active');
            addressGroup.style.display = 'block';
            addressInput.required = true;
        } else {
            btnDel.classList.remove('active');
            btnPick.classList.add('active');
            addressGroup.style.display = 'none';
            addressInput.required = false;
        }
        
        this.renderCart();
    }

    toggleCartDrawer() {
        const drawer = document.getElementById('cart-drawer');
        drawer.classList.toggle('open');
        if (drawer.classList.contains('open')) {
            this.renderCart();
        }
    }

    addToCart(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const cartItem = this.cart.find(c => c.id === itemId);
        if (cartItem) {
            cartItem.quantity += 1;
        } else {
            this.cart.push({
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                image_url: item.image_url,
                quantity: 1
            });
        }

        this.updateCartBadge();
        localStorage.setItem('ordering_cart', JSON.stringify(this.cart));
        
        const badge = document.getElementById('cart-badge-count');
        badge.style.transform = 'scale(1.4)';
        setTimeout(() => badge.style.transform = 'scale(1)', 200);
    }

    updateCartBadge() {
        const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('cart-badge-count').textContent = count;
    }

    changeCartQuantity(itemId, delta) {
        const cartItem = this.cart.find(c => c.id === itemId);
        if (!cartItem) return;

        cartItem.quantity += delta;
        if (cartItem.quantity <= 0) {
            this.cart = this.cart.filter(c => c.id !== itemId);
        }

        this.updateCartBadge();
        localStorage.setItem('ordering_cart', JSON.stringify(this.cart));
        this.renderCart();
    }

    renderCart() {
        const container = document.getElementById('cart-items-list');
        container.innerHTML = '';

        const checkoutForm = document.getElementById('checkout-form-container');
        const cartExtras = document.getElementById('cart-drawer-extras');
        const cartSummary = document.getElementById('cart-summary-container');

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="empty-cart-view">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <p>Your basket is currently empty.</p>
                </div>
            `;
            
            document.getElementById('summary-subtotal').textContent = '₹0.00';
            document.getElementById('summary-delivery').textContent = '₹0.00';
            document.getElementById('summary-tax').textContent = '₹0.00';
            document.getElementById('summary-total').textContent = '₹0.00';
            
            // Hide discount summary
            document.getElementById('summary-discount-row').classList.add('hidden');
            
            // Reset delivery progress bar
            document.getElementById('fd-progress-bar-fill').style.width = '0%';
            document.getElementById('fd-progress-bar-fill').classList.remove('completed');
            document.getElementById('fd-progress-text').textContent = 'Add items to get Free Delivery!';

            // Hide empty cart checkout parts
            if (checkoutForm) checkoutForm.classList.add('hidden');
            if (cartExtras) cartExtras.classList.add('hidden');
            if (cartSummary) cartSummary.classList.add('hidden');
            return;
        }

        // Show cart checkout parts if items exist
        if (checkoutForm) checkoutForm.classList.remove('hidden');
        if (cartExtras) cartExtras.classList.remove('hidden');
        if (cartSummary) cartSummary.classList.remove('hidden');

        this.cart.forEach((item, idx) => {
            // Check notes details
            const itemNotesHtml = item.notes ? `<div class="cart-item-notes" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; font-style: italic;"><i class="fa-solid fa-note-sticky text-yellow mr-1"></i> "${item.notes}"</div>` : '';
            container.innerHTML += `
                <div class="cart-item animate-slide-in" style="animation-delay: ${idx * 0.05}s">
                    <img src="${item.image_url}" class="cart-item-img" alt="${item.name}">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        ${itemNotesHtml}
                        <div class="cart-item-price">₹${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                    <div class="cart-item-controls">
                        <button class="qty-btn" onclick="app.changeCartQuantity('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="app.changeCartQuantity('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <i class="fa-solid fa-trash-can cart-item-remove" onclick="app.changeCartQuantity('${item.id}', -${item.quantity})"></i>
                </div>
            `;
        });

        // Calculations & Promo discount checks
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Progress Bar Calculation (target: ₹499)
        const progressFill = document.getElementById('fd-progress-bar-fill');
        const progressText = document.getElementById('fd-progress-text');
        
        let freeDelivery = false;
        if (subtotal >= 499) {
            freeDelivery = true;
            progressFill.style.width = '100%';
            progressFill.classList.add('completed');
            progressText.innerHTML = '<i class="fa-solid fa-circle-check"></i> Congratulations! You unlocked <strong>FREE Delivery</strong>!';
        } else {
            const pct = (subtotal / 499) * 100;
            progressFill.style.width = pct + '%';
            progressFill.classList.remove('completed');
            progressText.innerHTML = `Add <strong>₹${(499 - subtotal).toFixed(2)}</strong> more for FREE Delivery!`;
        }

        // Apply Promo discount
        let discount = 0;
        const discountRow = document.getElementById('summary-discount-row');
        
        if (this.appliedPromo) {
            if (subtotal < this.appliedPromo.min_order) {
                // Remove promo if subtotal falls below min_order
                this.appliedPromo = null;
                discountRow.classList.add('hidden');
                const errorMsg = document.getElementById('promo-error-msg');
                if (errorMsg) {
                    errorMsg.textContent = 'Discount removed. Minimum order not met.';
                    errorMsg.classList.remove('hidden');
                    setTimeout(() => errorMsg.classList.add('hidden'), 3500);
                }
            } else {
                if (this.appliedPromo.discountType === 'percentage') {
                    discount = subtotal * this.appliedPromo.value;
                    document.getElementById('summary-promo-label').textContent = this.appliedPromo.label;
                    document.getElementById('summary-discount').textContent = `-₹${discount.toFixed(2)}`;
                    discountRow.classList.remove('hidden');
                } else if (this.appliedPromo.discountType === 'fixed') {
                    discount = this.appliedPromo.value;
                    document.getElementById('summary-promo-label').textContent = this.appliedPromo.label;
                    document.getElementById('summary-discount').textContent = `-₹${discount.toFixed(2)}`;
                    discountRow.classList.remove('hidden');
                } else if (this.appliedPromo.discountType === 'freedelivery') {
                    freeDelivery = true;
                    document.getElementById('summary-promo-label').textContent = this.appliedPromo.label;
                    document.getElementById('summary-discount').textContent = `FREE`;
                    discountRow.classList.remove('hidden');
                }
            }
        } else {
            discountRow.classList.add('hidden');
        }

        let deliveryFee = this.orderType === 'Delivery' ? this.settings.delivery_fee : 0.00;
        if (freeDelivery) {
            deliveryFee = 0.00;
        }
        
        const taxRate = this.settings.tax_rate;
        const finalTaxedSubtotal = Math.max(0, subtotal - discount);
        const tax = finalTaxedSubtotal * taxRate;
        const total = finalTaxedSubtotal + deliveryFee + tax;

        document.getElementById('summary-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('summary-delivery').textContent = `₹${deliveryFee.toFixed(2)}`;
        document.getElementById('summary-tax').textContent = `₹${tax.toFixed(2)}`;
        document.getElementById('summary-total').textContent = `₹${total.toFixed(2)}`;
    }

    async submitCheckout() {
        if (this.cart.length === 0) {
            alert('Basket is empty. Add items before checking out.');
            return;
        }

        const city = document.getElementById('select-city').value;
        const branchSelect = document.getElementById('select-branch');
        const branchName = branchSelect.options[branchSelect.selectedIndex]?.text || '';
        
        if (!city || !branchName) {
            alert('Please select a City and Branch location above before checkout.');
            return;
        }

        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const email = document.getElementById('cust-email').value.trim();
        const address = document.getElementById('cust-address').value.trim();

        if (!name || !phone || !email || (this.orderType === 'Delivery' && !address)) {
            alert('Please complete all contact and delivery details.');
            return;
        }

        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        let freeDelivery = false;
        if (subtotal >= 499) {
            freeDelivery = true;
        }

        let discount = 0;
        if (this.appliedPromo) {
            if (this.appliedPromo.discountType === 'percentage') {
                discount = subtotal * this.appliedPromo.value;
            } else if (this.appliedPromo.discountType === 'freedelivery') {
                freeDelivery = true;
            }
        }

        let deliveryFee = this.orderType === 'Delivery' ? this.settings.delivery_fee : 0.00;
        if (freeDelivery) {
            deliveryFee = 0.00;
        }

        const tax = Math.max(0, subtotal - discount) * this.settings.tax_rate;
        const total = Math.max(0, subtotal - discount) + deliveryFee + tax;

        const orderPayload = {
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
            order_type: this.orderType,
            branch: `${city} - ${branchName}`,
            address: this.orderType === 'Delivery' ? address : 'N/A (Store Pickup)',
            items: JSON.stringify(this.cart),
            subtotal: subtotal,
            delivery_fee: deliveryFee,
            total: total
        };

        try {
            const completedOrder = await this.apiCall('createOrder', orderPayload);
            
            // Clear cart state
            this.cart = [];
            localStorage.removeItem('ordering_cart');
            this.updateCartBadge();
            this.toggleCartDrawer();

            // RENDER STUNNING SUCCESS CHECKOUT OVERLAY (CONFETA BOUNCER)
            this.showSuccessOverlay(completedOrder.id, email);
            
            // Wait for overlay animation to complete
            setTimeout(() => {
                this.openTrackModal();
                document.getElementById('track-order-id-input').value = completedOrder.id;
                this.trackOrderFromInput();
            }, 3000);

            this.refreshOrdersOnly();
        } catch (e) {
            alert('Checkout failed: ' + e.message);
        }
    }

    // Dynamic success modal creation in Javascript
    showSuccessOverlay(orderId, email = '') {
        const overlay = document.createElement('div');
        overlay.className = 'success-overlay';
        overlay.id = 'dynamic-success-overlay';
        
        const emailNoticeHtml = email ? `<div style="font-size: 0.95rem; color:var(--primary-color); margin-bottom: 15px; font-weight: 600;"><i class="fa-solid fa-envelope"></i> Confirmation sent to <strong style="color:#fff;">${email}</strong></div>` : '';

        overlay.innerHTML = `
            <div class="success-card">
                <div class="scooter-road-container">
                    <div class="scooter-road"></div>
                    <div class="scooter-icon"><i class="fa-solid fa-motorcycle"></i></div>
                </div>
                <h2 style="font-size: 2rem; margin-bottom: 10px; color:#fff; font-weight:800;">Order Confirmed!</h2>
                <p style="color:var(--text-secondary); margin-bottom: 20px;">Vinay Cafe is preparing your delicious meal.<br>Order ID: <strong class="text-yellow" style="font-size:1.25rem;">${orderId}</strong></p>
                ${emailNoticeHtml}
                <div style="font-size: 0.9rem; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Dispatching your delivery ride...</div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Triggers fade in
        setTimeout(() => overlay.classList.add('open'), 20);
        
        // Remove after 3 seconds
        setTimeout(() => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 400);
        }, 2900);
    }

    // ==========================================================================
    // REAL-TIME ORDER TRACKER
    // ==========================================================================
    openTrackModal() {
        document.getElementById('track-modal').classList.add('open');
        document.getElementById('tracking-details-area').classList.add('hidden');
        document.getElementById('tracking-error').classList.add('hidden');
        document.getElementById('track-order-id-input').value = '';
    }

    closeTrackModal() {
        document.getElementById('track-modal').classList.remove('open');
    }

    trackOrderFromInput() {
        const orderId = document.getElementById('track-order-id-input').value.trim();
        const errBox = document.getElementById('tracking-error');
        const detailArea = document.getElementById('tracking-details-area');
        
        if (!orderId) {
            errBox.textContent = 'Please enter an Order ID.';
            errBox.classList.remove('hidden');
            detailArea.classList.add('hidden');
            return;
        }

        const match = this.orders.find(o => o.id.toLowerCase() === orderId.toLowerCase());
        
        if (!match) {
            errBox.textContent = `Order ID "${orderId}" not found. Ensure ID matches exactly.`;
            errBox.classList.remove('hidden');
            detailArea.classList.add('hidden');
            return;
        }

        errBox.classList.add('hidden');
        detailArea.classList.remove('hidden');
        this.renderTrackOrder(match);
    }

    renderTrackOrder(order) {
        const statuses = ['Pending', 'Preparing', 'Ready', 'Out-for-Delivery', 'Delivered'];
        let currentStatusIndex = 0;
        const normalizedStatus = order.status.replace(/ /g, '-');
        
        if (normalizedStatus === 'Preparing') currentStatusIndex = 1;
        if (normalizedStatus === 'Ready') currentStatusIndex = 2;
        if (normalizedStatus === 'Out-for-Delivery') currentStatusIndex = 3;
        if (normalizedStatus === 'Delivered') currentStatusIndex = 4;
        
        statuses.forEach((statusName, idx) => {
            const stepNode = document.getElementById(`step-${statusName}`);
            if (stepNode) {
                stepNode.classList.remove('active', 'completed');
                if (idx < currentStatusIndex) {
                    stepNode.classList.add('completed');
                } else if (idx === currentStatusIndex) {
                    stepNode.classList.add('active');
                }
            }
        });

        const receiptContent = document.getElementById('order-slip-receipt-content');
        
        let parsedItems = [];
        try {
            parsedItems = JSON.parse(order.items);
        } catch(e) {
            parsedItems = [];
        }

        let itemsRows = '';
        parsedItems.forEach(itm => {
            itemsRows += `
                <div class="slip-row">
                    <span>${itm.name} x ${itm.quantity}</span>
                    <span>₹${(itm.price * itm.quantity).toFixed(2)}</span>
                </div>
            `;
        });

        receiptContent.innerHTML = `
            <div class="slip-title">VINAY CAFE</div>
            <div class="slip-subtitle">Order Slip Receipt & Tracking</div>
            
            <div class="slip-row">
                <span><strong>Order ID:</strong></span>
                <span class="text-yellow"><strong>${order.id}</strong></span>
            </div>
            <div class="slip-row">
                <span><strong>Date:</strong></span>
                <span>${new Date(order.created_at).toLocaleString()}</span>
            </div>
            <div class="slip-row">
                <span><strong>Type:</strong></span>
                <span>${order.order_type} (${order.branch})</span>
            </div>
            <div class="slip-row">
                <span><strong>Customer:</strong></span>
                <span>${order.customer_name}</span>
            </div>
            <div class="slip-row">
                <span><strong>Phone:</strong></span>
                <span>${order.customer_phone}</span>
            </div>
            ${order.order_type === 'Delivery' ? `
            <div class="slip-row">
                <span><strong>Address:</strong></span>
                <span>${order.address}</span>
            </div>` : ''}

            <div class="slip-divider"></div>
            
            ${itemsRows}

            <div class="slip-divider"></div>
            
            <div class="slip-row">
                <span>Subtotal</span>
                <span>₹${parseFloat(order.subtotal).toFixed(2)}</span>
            </div>
            <div class="slip-row">
                <span>Delivery Fee</span>
                <span>₹${parseFloat(order.delivery_fee).toFixed(2)}</span>
            </div>
            <div class="slip-row">
                <span>Sales Tax (GST)</span>
                <span>₹${(parseFloat(order.total) - parseFloat(order.subtotal) - parseFloat(order.delivery_fee)).toFixed(2)}</span>
            </div>
            <div class="slip-row" style="font-size: 1.1rem; font-weight: 800; color: #fff;">
                <span>Total Paid</span>
                <span class="text-yellow">₹${parseFloat(order.total).toFixed(2)}</span>
            </div>

            <div class="slip-divider"></div>
            <div style="text-align: center; font-size: 0.8rem; color: var(--text-secondary);">
                Current Status: <strong class="text-yellow">${order.status}</strong><br>
                Thank you for ordering with us!
            </div>
        `;
    }

    // ==========================================================================
    // AUTHENTICATION & SESSION
    // ==========================================================================
    openLoginModal() {
        if (this.currentUser) {
            if (confirm(`Logged in as ${this.currentUser.name}. Would you like to sign out?`)) {
                this.currentUser = null;
                document.getElementById('profile-text').textContent = 'Login';
                this.setView('customer');
            }
            return;
        }

        document.getElementById('login-modal').classList.add('open');
        document.getElementById('login-error-msg').classList.add('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    closeLoginModal() {
        document.getElementById('login-modal').classList.remove('open');
    }

    quickFillLogin(username, password) {
        document.getElementById('username').value = username;
        document.getElementById('password').value = password;
    }

    async handleLogin(event) {
        event.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        const errBox = document.getElementById('login-error-msg');

        try {
            const authUser = await this.apiCall('login', { username: user, password: pass });
            
            if (authUser) {
                this.currentUser = authUser;
                document.getElementById('profile-text').textContent = authUser.name;
                this.closeLoginModal();
                
                if (authUser.role === 'Admin') {
                    this.setView('admin');
                } else if (authUser.role === 'Kitchen') {
                    this.setView('kitchen');
                } else if (authUser.role === 'Rider') {
                    this.setView('rider');
                }
            }
        } catch(e) {
            errBox.textContent = e.message || 'Invalid username or password.';
            errBox.classList.remove('hidden');
        }
    }

    // ==========================================================================
    // VIEW ROUTING CONTROLLER
    // ==========================================================================
    setView(viewName) {
        this.currentView = viewName;
        
        document.querySelectorAll('.view-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetView = document.getElementById('view-' + viewName);
        if (targetView) {
            targetView.classList.add('active');
        }

        if (viewName === 'admin') {
            this.changeAdminTab(this.activeAdminTab);
        } else if (viewName === 'kitchen') {
            this.renderKitchenDashboard();
        } else if (viewName === 'rider') {
            this.renderRiderDashboard();
        } else if (viewName === 'customer') {
            this.renderMenu();
        }
    }

    // ==========================================================================
    // ADMIN DASHBOARD
    // ==========================================================================
    changeAdminTab(tabName) {
        this.activeAdminTab = tabName;
        const container = document.getElementById('admin-content-container');
        
        document.querySelectorAll('.dashboard-tabs .tab-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(tabName.substring(0, 3))) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        switch(tabName) {
            case 'items':
                this.renderAdminItems(container);
                break;
            case 'categories':
                this.renderAdminCategories(container);
                break;
            case 'branches':
                this.renderAdminBranches(container);
                break;
            case 'banners':
                this.renderAdminBanners(container);
                break;
            case 'users':
                this.renderAdminUsers(container);
                break;
            case 'orders':
                this.renderAdminOrders(container);
                break;
            case 'coupons':
                this.renderAdminCoupons(container);
                break;
            case 'analytics':
                this.renderAdminAnalytics(container);
                break;
            case 'settings':
                this.renderAdminSettings(container);
                break;
        }
    }

    renderAdminItems(container) {
        let itemRows = '';
        this.items.forEach(itm => {
            const isAvail = itm.available === true || itm.available === "TRUE";
            itemRows += `
                <tr>
                    <td><img src="${itm.image_url}" class="table-thumbnail"></td>
                    <td><strong>${itm.name}</strong><br><small class="text-muted">${itm.id}</small></td>
                    <td>${itm.category}</td>
                    <td>₹${parseFloat(itm.price).toFixed(2)}</td>
                    <td>${itm.status_badge || '-'}</td>
                    <td><span class="badge-status ${isAvail ? 'badge-active' : 'badge-inactive'}">${isAvail ? 'In Stock' : 'Out of Stock'}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="table-action-btn" onclick="app.openEditItemModal('${itm.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="table-action-btn btn-del" onclick="app.deleteItem('${itm.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Badge</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows || '<tr><td colspan="7" style="text-align:center;">No items created yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    openAddItemModal() {
        document.getElementById('item-modal-title').textContent = 'Add Menu Item';
        document.getElementById('admin-item-form').reset();
        document.getElementById('item-form-id').value = '';
        document.getElementById('item-image-preview-element').src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200';
        
        const categorySelect = document.getElementById('item-category');
        categorySelect.innerHTML = '';
        this.categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
        });

        this.uploadedImageBase64 = null;
        this.uploadedImageName = null;
        document.getElementById('image-upload-preview-filename').textContent = '';
        
        document.getElementById('admin-item-modal').classList.add('open');
    }

    openEditItemModal(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        this.openAddItemModal();
        document.getElementById('item-modal-title').textContent = 'Edit Menu Item';
        
        document.getElementById('item-form-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-price').value = item.price;
        document.getElementById('item-category').value = item.category;
        document.getElementById('item-desc').value = item.description || '';
        document.getElementById('item-badge').value = item.status_badge || '';
        document.getElementById('item-branches').value = item.branches || 'All';
        document.getElementById('item-image-url').value = item.image_url || '';
        document.getElementById('item-image-preview-element').src = item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200';
        document.getElementById('item-available').checked = (item.available === true || item.available === "TRUE");
    }

    closeItemModal() {
        document.getElementById('admin-item-modal').classList.remove('open');
    }

    toggleImageSource(mode) {
        const urlBox = document.getElementById('img-url-container');
        const uploadBox = document.getElementById('img-upload-container');
        if (mode === 'url') {
            urlBox.classList.remove('hidden');
            uploadBox.classList.add('hidden');
        } else {
            urlBox.classList.add('hidden');
            uploadBox.classList.remove('hidden');
        }
    }

    handleImageFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImageBase64 = e.target.result;
            this.uploadedImageName = file.name;
            document.getElementById('image-upload-preview-filename').textContent = `Ready to upload: ${file.name}`;
            document.getElementById('item-image-preview-element').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async handleSaveItem(event) {
        event.preventDefault();
        
        const id = document.getElementById('item-form-id').value;
        const name = document.getElementById('item-name').value.trim();
        const price = parseFloat(document.getElementById('item-price').value);
        const category = document.getElementById('item-category').value;
        const description = document.getElementById('item-desc').value.trim();
        const status_badge = document.getElementById('item-badge').value;
        const branches = document.getElementById('item-branches').value;
        const available = document.getElementById('item-available').checked;
        
        const imgRadio = document.querySelector('input[name="img-src"]:checked').value;
        let image_url = document.getElementById('item-image-url').value.trim();

        this.showLoader('Saving Product Item...');

        try {
            if (imgRadio === 'upload' && this.uploadedImageBase64) {
                image_url = await this.apiCall('uploadImage', {
                    base64Data: this.uploadedImageBase64,
                    filename: `${Date.now()}_${this.uploadedImageName}`
                });
            }

            const itemPayload = {
                id, name, price, category, description, status_badge, branches, available, image_url
            };

            await this.apiCall('saveItem', itemPayload);
            this.closeItemModal();
            await this.loadDatabase();
            this.changeAdminTab('items');
        } catch (e) {
            alert('Failed to save item: ' + e.message);
        } finally {
            this.hideLoader();
        }
    }

    async deleteItem(itemId) {
        if (!confirm('Are you sure you want to delete this menu item?')) return;
        try {
            await this.apiCall('deleteItem', { id: itemId });
            await this.loadDatabase();
            this.changeAdminTab('items');
        } catch (e) {
            alert('Failed to delete item: ' + e.message);
        }
    }

    renderAdminCategories(container) {
        let catRows = '';
        this.categories.forEach(cat => {
            const isAct = cat.active === true || cat.active === "TRUE";
            catRows += `
                <tr>
                    <td><strong>${cat.name}</strong></td>
                    <td><small class="text-muted">${cat.id}</small></td>
                    <td><span class="badge-status ${isAct ? 'badge-active' : 'badge-inactive'}">${isAct ? 'Active' : 'Hidden'}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="table-action-btn" onclick="app.openCategoryForm('${cat.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="table-action-btn btn-del" onclick="app.deleteCategory('${cat.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="mb-2">
                <button class="btn btn-sm btn-primary" onclick="app.openCategoryForm()"><i class="fa-solid fa-plus"></i> Add Category</button>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Category Name</th>
                            <th>Category ID</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${catRows || '<tr><td colspan="4" style="text-align:center;">No categories loaded.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    openCategoryForm(catId = '') {
        const cat = this.categories.find(c => c.id === catId) || { id: '', name: '', active: true };
        const genericModal = document.getElementById('admin-generic-modal');
        document.getElementById('generic-modal-title').textContent = catId ? 'Edit Category' : 'Add Category';
        
        document.getElementById('generic-modal-body-content').innerHTML = `
            <form onsubmit="app.handleSaveCategory(event)">
                <input type="hidden" id="gen-cat-id" value="${cat.id}">
                <div class="form-group">
                    <label for="gen-cat-name">Category Name *</label>
                    <input type="text" id="gen-cat-name" value="${cat.name}" required placeholder="e.g. Crazy Burgers">
                </div>
                <div class="form-group checkbox-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" id="gen-cat-active" ${cat.active ? 'checked' : ''}>
                        <span>Category is active & displayed in menu list</span>
                    </label>
                </div>
                <div class="modal-actions-bar mt-2">
                    <button type="submit" class="btn btn-primary">Save Category</button>
                </div>
            </form>
        `;
        genericModal.classList.add('open');
    }

    async handleSaveCategory(event) {
        event.preventDefault();
        const id = document.getElementById('gen-cat-id').value;
        const name = document.getElementById('gen-cat-name').value.trim();
        const active = document.getElementById('gen-cat-active').checked;

        try {
            await this.apiCall('saveCategory', { id, name, active });
            document.getElementById('admin-generic-modal').classList.remove('open');
            await this.loadDatabase();
            this.changeAdminTab('categories');
        } catch(e) {
            alert(e.message);
        }
    }

    async deleteCategory(catId) {
        if(!confirm('Are you sure you want to delete this category?')) return;
        try {
            await this.apiCall('deleteCategory', { id: catId });
            await this.loadDatabase();
            this.changeAdminTab('categories');
        } catch(e) {
            alert(e.message);
        }
    }

    renderAdminBranches(container) {
        let branchRows = '';
        this.branches.forEach(b => {
            const isAct = b.active === true || b.active === "TRUE";
            branchRows += `
                <tr>
                    <td><strong>${b.name}</strong><br><small class="text-muted">${b.address}</small></td>
                    <td>${b.city}</td>
                    <td><span class="badge-status ${isAct ? 'badge-active' : 'badge-inactive'}">${isAct ? 'Active' : 'Closed'}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="table-action-btn" onclick="app.openBranchForm('${b.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="table-action-btn btn-del" onclick="app.deleteBranch('${b.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="mb-2">
                <button class="btn btn-sm btn-primary" onclick="app.openBranchForm()"><i class="fa-solid fa-plus"></i> Add Branch</button>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Branch Location</th>
                            <th>City</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${branchRows || '<tr><td colspan="4" style="text-align:center;">No branches loaded.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    openBranchForm(branchId = '') {
        const branch = this.branches.find(b => b.id === branchId) || { id: '', city: '', name: '', address: '', active: true };
        const genericModal = document.getElementById('admin-generic-modal');
        document.getElementById('generic-modal-title').textContent = branchId ? 'Edit Branch' : 'Add Branch';
        
        document.getElementById('generic-modal-body-content').innerHTML = `
            <form onsubmit="app.handleSaveBranch(event)">
                <input type="hidden" id="gen-brh-id" value="${branch.id}">
                <div class="form-group">
                    <label for="gen-brh-city">City Name *</label>
                    <input type="text" id="gen-brh-city" value="${branch.city}" required placeholder="e.g. Mumbai">
                </div>
                <div class="form-group">
                    <label for="gen-brh-name">Branch Label *</label>
                    <input type="text" id="gen-brh-name" value="${branch.name}" required placeholder="e.g. Bandra West">
                </div>
                <div class="form-group">
                    <label for="gen-brh-address">Full Address *</label>
                    <input type="text" id="gen-brh-address" value="${branch.address}" required placeholder="e.g. Linking Road, Bandra, Mumbai">
                </div>
                <div class="form-group checkbox-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" id="gen-brh-active" ${branch.active ? 'checked' : ''}>
                        <span>Branch is open and visible to customers</span>
                    </label>
                </div>
                <div class="modal-actions-bar mt-2">
                    <button type="submit" class="btn btn-primary">Save Branch</button>
                </div>
            </form>
        `;
        genericModal.classList.add('open');
    }

    async handleSaveBranch(event) {
        event.preventDefault();
        const id = document.getElementById('gen-brh-id').value;
        const city = document.getElementById('gen-brh-city').value.trim();
        const name = document.getElementById('gen-brh-name').value.trim();
        const address = document.getElementById('gen-brh-address').value.trim();
        const active = document.getElementById('gen-brh-active').checked;

        try {
            await this.apiCall('saveBranch', { id, city, name, address, active });
            document.getElementById('admin-generic-modal').classList.remove('open');
            await this.loadDatabase();
            this.changeAdminTab('branches');
        } catch(e) {
            alert(e.message);
        }
    }

    async deleteBranch(brhId) {
        if(!confirm('Are you sure you want to delete this branch?')) return;
        try {
            await this.apiCall('deleteBranch', { id: brhId });
            await this.loadDatabase();
            this.changeAdminTab('branches');
        } catch(e) {
            alert(e.message);
        }
    }

    renderAdminBanners(container) {
        let bannerRows = '';
        this.banners.forEach(b => {
            const isAct = b.active === true || b.active === "TRUE";
            bannerRows += `
                <tr>
                    <td><img src="${b.image_url}" class="table-thumbnail" style="width: 80px;"></td>
                    <td><strong>${b.title}</strong><br><small class="text-muted">${b.subtitle}</small></td>
                    <td><span class="badge-status ${isAct ? 'badge-active' : 'badge-inactive'}">${isAct ? 'Showing' : 'Hidden'}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="table-action-btn" onclick="app.openBannerForm('${b.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="table-action-btn btn-del" onclick="app.deleteBanner('${b.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="mb-2">
                <button class="btn btn-sm btn-primary" onclick="app.openBannerForm()"><i class="fa-solid fa-plus"></i> Add Banner</button>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Preview</th>
                            <th>Details</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bannerRows || '<tr><td colspan="4" style="text-align:center;">No banners configured.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    openBannerForm(bannerId = '') {
        const banner = this.banners.find(b => b.id === bannerId) || { id: '', title: '', subtitle: '', image_url: '', active: true };
        const genericModal = document.getElementById('admin-generic-modal');
        document.getElementById('generic-modal-title').textContent = bannerId ? 'Edit Banner' : 'Add Banner';
        
        document.getElementById('generic-modal-body-content').innerHTML = `
            <form onsubmit="app.handleSaveBanner(event)">
                <input type="hidden" id="gen-ban-id" value="${banner.id}">
                <div class="form-group">
                    <label for="gen-ban-title">Banner Header Title *</label>
                    <input type="text" id="gen-ban-title" value="${banner.title}" required placeholder="e.g. Delicious Special Deals">
                </div>
                <div class="form-group">
                    <label for="gen-ban-subtitle">Subtext Description *</label>
                    <input type="text" id="gen-ban-subtitle" value="${banner.subtitle}" required placeholder="e.g. Buy one large pizza get one free!">
                </div>
                <div class="form-group">
                    <label for="gen-ban-img">Direct Image URL *</label>
                    <input type="url" id="gen-ban-img" value="${banner.image_url}" required placeholder="https://images.unsplash.com/...">
                </div>
                <div class="form-group checkbox-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" id="gen-ban-active" ${banner.active ? 'checked' : ''}>
                        <span>Banner is active & shown in home carousel</span>
                    </label>
                </div>
                <div class="modal-actions-bar mt-2">
                    <button type="submit" class="btn btn-primary">Save Banner</button>
                </div>
            </form>
        `;
        genericModal.classList.add('open');
    }

    async handleSaveBanner(event) {
        event.preventDefault();
        const id = document.getElementById('gen-ban-id').value;
        const title = document.getElementById('gen-ban-title').value.trim();
        const subtitle = document.getElementById('gen-ban-subtitle').value.trim();
        const image_url = document.getElementById('gen-ban-img').value.trim();
        const active = document.getElementById('gen-ban-active').checked;

        try {
            await this.apiCall('saveBanner', { id, title, subtitle, image_url, active });
            document.getElementById('admin-generic-modal').classList.remove('open');
            await this.loadDatabase();
            this.changeAdminTab('banners');
            this.renderCarousel();
        } catch(e) {
            alert(e.message);
        }
    }

    async deleteBanner(banId) {
        if(!confirm('Are you sure you want to delete this banner?')) return;
        try {
            await this.apiCall('deleteBanner', { id: banId });
            await this.loadDatabase();
            this.changeAdminTab('banners');
            this.renderCarousel();
        } catch(e) {
            alert(e.message);
        }
    }

    renderAdminUsers(container) {
        let userRows = '';
        this.users.forEach(u => {
            const isAct = u.status === true || u.status === "TRUE";
            userRows += `
                <tr>
                    <td><strong>${u.name}</strong><br><small class="text-muted">Username: ${u.username}</small></td>
                    <td><span class="badge-status ${isAct ? 'badge-active' : 'badge-inactive'}">${isAct ? 'Active' : 'Suspended'}</span></td>
                    <td><strong>${u.role}</strong></td>
                    <td>${u.role === 'Rider' ? `₹${parseFloat(u.earnings || 0).toFixed(2)}` : 'N/A'}</td>
                    <td>
                        <div class="action-btn-group">
                            <button class="table-action-btn" onclick="app.openUserForm('${u.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="table-action-btn btn-del" onclick="app.deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="mb-2">
                <button class="btn btn-sm btn-primary" onclick="app.openUserForm()"><i class="fa-solid fa-plus"></i> Add New Employee</button>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Staff Info</th>
                            <th>Status</th>
                            <th>System Role</th>
                            <th>Rider Accumulated Earnings</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userRows || '<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    openUserForm(userId = '') {
        const user = this.users.find(u => u.id === userId) || { id: '', username: '', password: '', role: 'Kitchen', name: '', status: true };
        const genericModal = document.getElementById('admin-generic-modal');
        document.getElementById('generic-modal-title').textContent = userId ? 'Edit User Credentials' : 'Register Staff Member';
        
        document.getElementById('generic-modal-body-content').innerHTML = `
            <form onsubmit="app.handleSaveUser(event)">
                <input type="hidden" id="gen-usr-id" value="${user.id}">
                <div class="form-group">
                    <label for="gen-usr-name">Employee Full Name *</label>
                    <input type="text" id="gen-usr-name" value="${user.name}" required placeholder="e.g. John Miller">
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label for="gen-usr-uname">Username *</label>
                        <input type="text" id="gen-usr-uname" value="${user.username}" required placeholder="e.g. jmiller">
                    </div>
                    <div class="form-group flex-1">
                        <label for="gen-usr-pass">Password (Plain) *</label>
                        <input type="password" id="gen-usr-pass" value="${user.password}" required placeholder="Set password">
                    </div>
                </div>
                <div class="form-group">
                    <label for="gen-usr-role">Dashboard Permission Role *</label>
                    <select id="gen-usr-role">
                        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin Dashboard</option>
                        <option value="Kitchen" ${user.role === 'Kitchen' ? 'selected' : ''}>Kitchen Operations Panel</option>
                        <option value="Rider" ${user.role === 'Rider' ? 'selected' : ''}>Rider Delivery Board</option>
                    </select>
                </div>
                <div class="form-group checkbox-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" id="gen-usr-active" ${user.status ? 'checked' : ''}>
                        <span>Account login authorization is active</span>
                    </label>
                </div>
                <div class="modal-actions-bar mt-2">
                    <button type="submit" class="btn btn-primary">Save User Credentials</button>
                </div>
            </form>
        `;
        genericModal.classList.add('open');
    }

    async handleSaveUser(event) {
        event.preventDefault();
        const id = document.getElementById('gen-usr-id').value;
        const name = document.getElementById('gen-usr-name').value.trim();
        const username = document.getElementById('gen-usr-uname').value.trim().toLowerCase();
        const password = document.getElementById('gen-usr-pass').value;
        const role = document.getElementById('gen-usr-role').value;
        const status = document.getElementById('gen-usr-active').checked;

        try {
            await this.apiCall('saveUser', { id, name, username, password, role, status });
            document.getElementById('admin-generic-modal').classList.remove('open');
            await this.loadDatabase();
            this.changeAdminTab('users');
        } catch(e) {
            alert(e.message);
        }
    }

    async deleteUser(usrId) {
        if(!confirm('Are you sure you want to delete this employee account?')) return;
        try {
            await this.apiCall('deleteUser', { id: usrId });
            await this.loadDatabase();
            this.changeAdminTab('users');
        } catch(e) {
            alert(e.message);
        }
    }

    closeGenericModal() {
        document.getElementById('admin-generic-modal').classList.remove('open');
    }

    renderAdminAnalytics(container) {
        const ordersList = this.orders;
        const totalOrders = ordersList.length;
        
        const deliveredOrders = ordersList.filter(o => o.status === 'Delivered');
        const revenueTotal = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
        const avgOrder = totalOrders > 0 ? (revenueTotal / deliveredOrders.length || 0) : 0;
        const pendingCount = ordersList.filter(o => o.status === 'Pending').length;

        const itemsFreq = {};
        ordersList.forEach(order => {
            let orderItems = [];
            try {
                orderItems = JSON.parse(order.items);
            } catch(e) {
                orderItems = [];
            }
            orderItems.forEach(oi => {
                itemsFreq[oi.name] = (itemsFreq[oi.name] || 0) + oi.quantity;
            });
        });

        const topItems = Object.keys(itemsFreq).map(name => ({
            name, quantity: itemsFreq[name]
        })).sort((a,b) => b.quantity - a.quantity).slice(0, 5);

        const maxQty = topItems.length > 0 ? Math.max(...topItems.map(t => t.quantity)) : 10;
        
        let chartRowsHtml = '';
        topItems.forEach(item => {
            const pct = (item.quantity / maxQty) * 100;
            chartRowsHtml += `
                <div class="chart-bar-row">
                    <span class="bar-label" title="${item.name}">${item.name}</span>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${pct}%"></div>
                    </div>
                    <span class="bar-value">${item.quantity} orders</span>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <div class="anal-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
                    <div class="anal-details">
                        <span class="label">Delivered Revenue</span>
                        <span class="value">₹${revenueTotal.toFixed(2)}</span>
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="anal-icon blue-icon"><i class="fa-solid fa-cubes"></i></div>
                    <div class="anal-details">
                        <span class="label">Total Orders Placed</span>
                        <span class="value">${totalOrders}</span>
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="anal-icon green-icon"><i class="fa-solid fa-receipt"></i></div>
                    <div class="anal-details">
                        <span class="label">Avg Order Size</span>
                        <span class="value">₹${avgOrder.toFixed(2)}</span>
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="anal-icon" style="background: rgba(255, 59, 48, 0.1); color: var(--accent-red);"><i class="fa-solid fa-hourglass-half"></i></div>
                    <div class="anal-details">
                        <span class="label">Pending Queue</span>
                        <span class="value">${pendingCount}</span>
                    </div>
                </div>
            </div>

            <div class="charts-row">
                <div class="chart-panel">
                    <h3 class="chart-title"><i class="fa-solid fa-chart-simple"></i> Top 5 Popular Menu Items (Units Sold)</h3>
                    <div class="bar-chart-container">
                        ${chartRowsHtml || '<p style="color:var(--text-secondary); text-align:center;">No dishes sold yet.</p>'}
                    </div>
                </div>

                <div class="chart-panel">
                    <h3 class="chart-title"><i class="fa-solid fa-chart-pie"></i> Orders By Types</h3>
                    <div class="pie-chart-list">
                        <div class="pie-item">
                            <div class="pie-item-label">
                                <div class="pie-dot" style="background-color: var(--primary-color)"></div>
                                <span>Delivery Orders</span>
                            </div>
                            <span class="pie-val">${ordersList.filter(o => o.order_type === 'Delivery').length}</span>
                        </div>
                        <div class="pie-item">
                            <div class="pie-item-label">
                                <div class="pie-dot" style="background-color: var(--accent-blue)"></div>
                                <span>Pickup Orders</span>
                            </div>
                            <span class="pie-val">${ordersList.filter(o => o.order_type === 'Pickup').length}</span>
                        </div>
                    </div>
                    
                    <h3 class="chart-title mt-3" style="border-top: 1px solid var(--border-color); padding-top: 15px;"><i class="fa-solid fa-store"></i> Active Branch Orders</h3>
                    <div class="pie-chart-list">
                        ${this.branches.map(br => {
                            const count = ordersList.filter(o => o.branch.includes(br.name)).length;
                            return `
                                <div class="pie-item">
                                    <div class="pie-item-label">
                                        <div class="pie-dot" style="background-color: var(--text-secondary)"></div>
                                        <span>${br.name} (${br.city})</span>
                                    </div>
                                    <span class="pie-val">${count}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderAdminSettings(container) {
        container.innerHTML = `
            <form onsubmit="app.handleSaveAdminSettings(event)" style="max-width: 600px; background: rgba(255,255,255,0.02); padding: 30px; border-radius: 20px; border: var(--glass-border); box-shadow: var(--card-shadow);">
                <h3 style="margin-bottom: 25px; color:#fff; display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-sliders text-yellow"></i> Store Configuration Settings</h3>
                
                <div class="form-group">
                    <label for="set-delivery-fee">Default Delivery Fee (₹) *</label>
                    <input type="number" id="set-delivery-fee" step="1" value="${this.settings.delivery_fee}" required>
                </div>

                <div class="form-group">
                    <label for="set-tax-rate">Sales Tax Rate (GST decimal, e.g. 0.05 for 5%) *</label>
                    <input type="number" id="set-tax-rate" step="0.01" value="${this.settings.tax_rate}" required>
                </div>

                <div class="form-group">
                    <label for="set-drive-id">Google Drive Upload Folder ID (Google Sheet mode only)</label>
                    <input type="text" id="set-drive-id" value="${this.settings.drive_folder_id || ''}" placeholder="folder_id_string">
                </div>

                <div class="modal-actions-bar mt-3" style="justify-content: flex-start;">
                    <button type="submit" class="btn btn-primary">Save Settings Configuration</button>
                </div>
            </form>
        `;
    }

    async handleSaveAdminSettings(event) {
        event.preventDefault();
        
        const delivery_fee = parseFloat(document.getElementById('set-delivery-fee').value);
        const tax_rate = parseFloat(document.getElementById('set-tax-rate').value);
        const drive_folder_id = document.getElementById('set-drive-id').value.trim();

        this.showLoader('Saving Settings Configuration...');

        try {
            const settingsPayload = { delivery_fee, tax_rate, drive_folder_id };
            await this.apiCall('saveSettings', settingsPayload);
            
            // Reload database
            await this.loadDatabase();
            
            alert('Settings configured successfully!');
            this.changeAdminTab('settings');
        } catch (e) {
            alert('Failed to save settings: ' + e.message);
        } finally {
            this.hideLoader();
        }
    }

    // ==========================================================================
    // KITCHEN MONITOR OPERATIONS
    // ==========================================================================
    renderKitchenDashboard() {
        const pendingContainer = document.getElementById('kitchen-pending-orders');
        const preparingContainer = document.getElementById('kitchen-preparing-orders');
        const readyContainer = document.getElementById('kitchen-ready-orders');

        pendingContainer.innerHTML = '';
        preparingContainer.innerHTML = '';
        readyContainer.innerHTML = '';

        const listPending = this.orders.filter(o => o.status === 'Pending');
        const listPrep = this.orders.filter(o => o.status === 'Preparing');
        const listReady = this.orders.filter(o => o.status === 'Ready');

        document.getElementById('count-pending').textContent = listPending.length;
        document.getElementById('count-preparing').textContent = listPrep.length;
        document.getElementById('count-ready').textContent = listReady.length;

        const getCardHtml = (o, nextStatus, btnLabel, btnClass) => {
            let items = [];
            try {
                items = JSON.parse(o.items);
            } catch(e) {
                items = [];
            }
            
            const listItemsHtml = items.map(itm => `
                <li><span class="k-item-name">${itm.name}</span> <span>x${itm.quantity}</span></li>
            `).join('');

            return `
                <div class="k-order-card">
                    <div class="k-card-header">
                        <span class="k-order-id">${o.id}</span>
                        <span class="k-order-time">${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div class="k-customer-detail">
                        <strong>${o.customer_name}</strong> (${o.order_type})<br>
                        <small class="text-muted">Branch: ${o.branch}</small>
                    </div>
                    <div class="k-order-items">
                        <ul>${listItemsHtml}</ul>
                    </div>
                    ${nextStatus ? `
                    <div class="k-card-actions">
                        <button class="btn btn-sm ${btnClass}" onclick="app.updateOrderStatus('${o.id}', '${nextStatus}')">
                            ${btnLabel}
                        </button>
                    </div>` : ''}
                </div>
            `;
        };

        listPending.forEach(o => {
            pendingContainer.innerHTML += getCardHtml(o, 'Preparing', 'Start Preparing', 'btn-primary');
        });

        listPrep.forEach(o => {
            preparingContainer.innerHTML += getCardHtml(o, 'Ready', 'Mark as Cooked', 'btn-warning');
        });

        listReady.forEach(o => {
            readyContainer.innerHTML += getCardHtml(o, null, '', '');
        });
    }

    async updateOrderStatus(orderId, newStatus, riderId) {
        try {
            await this.apiCall('updateOrderStatus', { orderId, status: newStatus, riderId });
            await this.loadDatabase();
            
            if (this.currentView === 'kitchen') {
                this.renderKitchenDashboard();
            } else if (this.currentView === 'rider') {
                this.renderRiderDashboard();
            }
        } catch(e) {
            alert('Failed to update status: ' + e.message);
        }
    }

    // ==========================================================================
    // RIDER DELIVERY PANEL
    // ==========================================================================
    renderRiderDashboard() {
        if (!this.currentUser) return;
        
        document.getElementById('rider-welcome-msg').textContent = `Welcome Back, Rider ${this.currentUser.name}!`;

        const availableContainer = document.getElementById('rider-available-pickups');
        const assignedContainer = document.getElementById('rider-assigned-deliveries');

        availableContainer.innerHTML = '';
        assignedContainer.innerHTML = '';

        const readyDeliveries = this.orders.filter(o => o.status === 'Ready' && o.order_type === 'Delivery' && (!o.rider_id || o.rider_id === ''));
        const activeAssigned = this.orders.filter(o => o.status === 'Out for Delivery' && o.rider_id === this.currentUser.id);

        const riderRecord = this.users.find(u => u.id === this.currentUser.id) || this.currentUser;
        const totalEarningsVal = parseFloat(riderRecord.earnings || 0.00);
        const deliverCount = Math.floor(totalEarningsVal / 50.00); // ₹50 flat rate

        document.getElementById('rider-stat-count').textContent = deliverCount;
        document.getElementById('rider-stat-earnings').textContent = `₹${totalEarningsVal.toFixed(2)}`;

        const getRiderCardHtml = (o, actionName, btnLabel, btnClass) => {
            let items = [];
            try {
                items = JSON.parse(o.items);
            } catch(e) {
                items = [];
            }
            
            const listItemsHtml = items.map(itm => `${itm.name} (x${itm.quantity})`).join(', ');
            const showNavMapBtn = actionName === 'Delivered';

            return `
                <div class="k-order-card">
                    <div class="k-card-header">
                        <span class="k-order-id">${o.id}</span>
                        <span class="k-order-time">Subtotal: ₹${parseFloat(o.total).toFixed(2)}</span>
                    </div>
                    <div class="k-customer-detail">
                        <strong>Address:</strong> ${o.address}<br>
                        <strong>Phone:</strong> <a href="tel:${o.customer_phone}" style="color:var(--primary-color)">${o.customer_phone}</a><br>
                        <small class="text-muted">Branch: ${o.branch} | Customer: ${o.customer_name}</small>
                    </div>
                    <div class="k-order-items" style="font-size:0.8rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">
                        <strong>Items:</strong> ${listItemsHtml}
                    </div>
                    <div class="k-card-actions" style="gap:10px;">
                        ${showNavMapBtn ? `<button class="btn btn-sm btn-secondary" onclick="app.openRiderMapModal('${o.id}')"><i class="fa-solid fa-map-location-dot"></i> Navigate Route</button>` : ''}
                        <button class="btn btn-sm ${btnClass}" onclick="app.updateOrderStatus('${o.id}', '${actionName}', '${this.currentUser.id}')">
                            ${btnLabel}
                        </button>
                    </div>
                </div>
            `;
        };

        readyDeliveries.forEach(o => {
            availableContainer.innerHTML += getRiderCardHtml(o, 'Out for Delivery', '<i class="fa-solid fa-truck-ramp-box"></i> Accept Delivery', 'btn-primary');
        });

        activeAssigned.forEach(o => {
            assignedContainer.innerHTML += getRiderCardHtml(o, 'Delivered', '<i class="fa-solid fa-house-circle-check"></i> Mark as Delivered', 'btn-warning');
        });

        if (readyDeliveries.length === 0) {
            availableContainer.innerHTML = '<p class="text-muted text-center py-4" style="text-align:center;">No pending packages for delivery at this branch.</p>';
        }
        if (activeAssigned.length === 0) {
            assignedContainer.innerHTML = '<p class="text-muted text-center py-4" style="text-align:center;">You have no active routes right now.</p>';
        }
    }

    // ==========================================================================
    // SYSTEM TIMERS & REFRESHES (2 SECONDS SYNC)
    // ==========================================================================
    startSyncTimer() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        this.syncInterval = setInterval(() => {
            const isDashboard = ['admin', 'kitchen', 'rider'].includes(this.currentView);
            const isTrackingOpen = document.getElementById('track-modal').classList.contains('open');

            if (isDashboard || isTrackingOpen) {
                this.refreshOrdersOnly();
            }
        }, this.refreshRateMs);
    }

    // ==========================================================================
    // UI LAYOUT MODAL CONTROL AND LOADERS
    // ==========================================================================
    openSettingsModal() {
        document.getElementById('settings-modal').classList.add('open');
    }

    closeSettingsModal() {
        document.getElementById('settings-modal').classList.remove('open');
    }

    handleDbModeChange(val) {
        const gasUrlGroup = document.getElementById('gas-url-group');
        if (val === 'live') {
            gasUrlGroup.classList.remove('hidden');
        } else {
            gasUrlGroup.classList.add('hidden');
        }
    }

    showLoader(text = 'Syncing data...') {
        document.getElementById('app-loader-text').textContent = text;
        document.getElementById('app-global-loader').classList.remove('hidden');
    }

    hideLoader() {
        document.getElementById('app-global-loader').classList.add('hidden');
    }

    showNotification(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `
            <div class="toast-content">
                <i class="fa-solid ${icon}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.classList.add('fade-out'); setTimeout(() => this.parentElement.remove(), 300);"><i class="fa-solid fa-xmark"></i></button>
        `;

        container.appendChild(toast);

        // Auto remove animation after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    bindEvents() {
        const drawer = document.getElementById('cart-drawer');
        drawer.addEventListener('click', (e) => {
            if (e.target === drawer) {
                this.toggleCartDrawer();
            }
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('open');
                }
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            const list = document.getElementById('theme-dropdown-list');
            if (list) list.classList.remove('open');
        });
    }

    // ==========================================================================
    // VISUAL LUXE UPGRADES: SKELETONS, CONFETTI, PARTICLES, STORIES, SOUNDS
    // ==========================================================================
    
    initTheme() {
        const cachedTheme = localStorage.getItem('vinay_cafe_theme') || 'gold';
        this.applyThemeVariables(cachedTheme);
        
        // Sync Dropdown options active class
        setTimeout(() => {
            const opts = document.querySelectorAll('.theme-opt');
            opts.forEach(opt => {
                const clickAttr = opt.getAttribute('onclick');
                if (clickAttr && clickAttr.includes(cachedTheme)) {
                    opt.classList.add('active');
                } else {
                    opt.classList.remove('active');
                }
            });
        }, 100);
    }

    toggleThemeDropdown(event) {
        event.stopPropagation();
        const list = document.getElementById('theme-dropdown-list');
        if (list) list.classList.toggle('open');
    }

    setTheme(themeName, element) {
        this.applyThemeVariables(themeName);
        localStorage.setItem('vinay_cafe_theme', themeName);
        
        document.querySelectorAll('.theme-opt').forEach(opt => opt.classList.remove('active'));
        if (element) {
            element.classList.add('active');
        }
        
        const list = document.getElementById('theme-dropdown-list');
        if (list) list.classList.remove('open');
        
        this.playSynthChime('success');
    }

    applyThemeVariables(themeName) {
        const body = document.body;
        body.classList.remove('gold-theme', 'crimson-theme', 'matcha-theme', 'sapphire-theme', 'amethyst-theme', 'rose-theme');
        body.classList.add(themeName + '-theme');
    }

    initBackgroundParticles() {
        const container = document.getElementById('particles-bg-container');
        if (!container) return;
        container.innerHTML = '';
        
        const count = 15;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            const size = Math.random() * 20 + 8; // 8px to 28px
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            particle.style.left = Math.random() * 100 + 'vw';
            particle.style.bottom = '-' + (Math.random() * 20 + 10) + 'px';
            
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (Math.random() * 15 + 15) + 's';
            
            container.appendChild(particle);
        }
    }

    renderStories() {
        const container = document.getElementById('stories-container');
        if (!container) return;
        container.innerHTML = '';
        
        const storySeeds = [
            { id: 'chef', title: "Chef's Choice", category: "Popular!", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150" },
            { id: 'pizza', title: "Pizza Heaven", category: "Pizza Flavors", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150" },
            { id: 'starter', title: "Crispy Starters", category: "Starters", image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=150" },
            { id: 'desserts', title: "Sweet Treats", category: "Desserts", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=150" },
            { id: 'drinks', title: "Mocktails & Co", category: "Beverages & Extras", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=150" }
        ];

        storySeeds.forEach(story => {
            const isViewed = localStorage.getItem('story_viewed_' + story.id) ? 'viewed' : '';
            container.innerHTML += `
                <div class="story-bubble ${isViewed}" onclick="app.handleStoryClick('${story.id}', '${story.category}', this)">
                    <div class="story-ring">
                        <div class="story-ring-spin"></div>
                        <div class="story-img-container">
                            <img src="${story.image}" alt="${story.title}">
                        </div>
                    </div>
                    <span class="story-label">${story.title}</span>
                </div>
            `;
        });
    }

    handleStoryClick(storyId, category, element) {
        localStorage.setItem('story_viewed_' + storyId, 'true');
        element.classList.add('viewed');
        
        const catPill = [...document.querySelectorAll('.category-pill')].find(p => p.textContent.trim() === category);
        if (catPill) {
            this.setActiveCategory(category, catPill);
            catPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        const matchItem = this.items.find(itm => itm.category === category && (itm.available === true || itm.available === "TRUE"));
        if (matchItem) {
            setTimeout(() => {
                this.openProductDetailModal(matchItem.id);
            }, 500);
        }
    }

    renderMenuSkeletons() {
        const container = document.getElementById('menu-grid-container');
        if (!container) return;
        container.innerHTML = '';
        
        for (let i = 0; i < 6; i++) {
            container.innerHTML += `
                <div class="skeleton-card">
                    <div class="skeleton-img"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-desc"></div>
                    <div class="skeleton-desc-short"></div>
                    <div class="skeleton-footer">
                        <div class="skeleton-price"></div>
                        <div class="skeleton-btn"></div>
                    </div>
                    <div class="skeleton-shine"></div>
                </div>
            `;
        }
    }

    // Web Audio Synthesized chimes (No assets network load dependencies)
    playSynthChime(type = 'success') {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const ctx = new AudioContext();
            
            if (type === 'success') {
                // Ascending major chord (C4, E4, G4, C5)
                const freqs = [261.63, 329.63, 392.00, 523.25];
                freqs.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + (idx * 0.08));
                    
                    gain.gain.setValueAtTime(0.12, ctx.currentTime + (idx * 0.08));
                    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + (idx * 0.08) + 0.35);
                    
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    
                    osc.start(ctx.currentTime + (idx * 0.08));
                    osc.stop(ctx.currentTime + (idx * 0.08) + 0.4);
                });
            } else if (type === 'alert') {
                // Bell chime (E5, C5)
                const freqs = [659.25, 523.25];
                freqs.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + (idx * 0.15));
                    
                    gain.gain.setValueAtTime(0.15, ctx.currentTime + (idx * 0.15));
                    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + (idx * 0.15) + 0.45);
                    
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    
                    osc.start(ctx.currentTime + (idx * 0.15));
                    osc.stop(ctx.currentTime + (idx * 0.15) + 0.5);
                });
            } else if (type === 'whip') {
                // Frequency sweep (1000Hz down to 150Hz)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(1000, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.45);
                
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.45);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
            }
        } catch(e) {
            console.error('Web Audio Synth failed:', e);
        }
    }

    // Pure JavaScript Canvas Confetti engine
    triggerConfetti(targetContainer = document.body) {
        try {
            const canvas = document.createElement('canvas');
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '9999';
            
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            targetContainer.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            const colors = ['#ffd000', '#ff3b30', '#34c759', '#007aff', '#af52de', '#ff2d55'];
            const particles = [];
            
            for (let i = 0; i < 80; i++) {
                particles.push({
                    x: canvas.width / 2,
                    y: canvas.height / 2 - 50,
                    size: Math.random() * 6 + 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    angle: Math.random() * Math.PI * 2,
                    speed: Math.random() * 8 + 4,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: Math.random() * 0.2 - 0.1,
                    decay: Math.random() * 0.02 + 0.96,
                    opacity: 1
                });
            }
            
            const animate = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                let alive = false;
                
                particles.forEach(p => {
                    p.x += Math.cos(p.angle) * p.speed;
                    p.y += Math.sin(p.angle) * p.speed + 1.8; // gravity
                    p.speed *= p.decay;
                    p.rotation += p.rotationSpeed;
                    p.opacity -= 0.015;
                    
                    if (p.opacity > 0) {
                        alive = true;
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.rotation);
                        ctx.fillStyle = p.color;
                        ctx.globalAlpha = p.opacity;
                        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                        ctx.restore();
                    }
                });
                
                if (alive) {
                    requestAnimationFrame(animate);
                } else {
                    canvas.remove();
                }
            };
            
            animate();
        } catch(e) {
            console.error('Confetti animation failed:', e);
        }
    }

    // ==========================================================================
    // PRODUCT DETAIL CUSTOMIZATION MODAL FUNCTIONS
    // ==========================================================================
    openProductDetailModal(itemId, event) {
        if (event) {
            // Bypasses detail modal when clicking quick-add basket icon
            if (event.target.closest('.btn-add-cart-icon')) {
                return;
            }
        }
        
        this.activeProductModalItem = this.items.find(i => i.id === itemId);
        if (!this.activeProductModalItem) return;

        this.productModalQty = 1;
        
        document.getElementById('p-detail-img').src = this.activeProductModalItem.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
        document.getElementById('p-detail-name').textContent = this.activeProductModalItem.name;
        document.getElementById('p-detail-desc').textContent = this.activeProductModalItem.description || 'Prepared fresh with premium ingredients.';
        
        const badge = document.getElementById('p-detail-badge');
        if (this.activeProductModalItem.status_badge) {
            badge.textContent = this.activeProductModalItem.status_badge;
            badge.style.display = 'block';
            
            badge.className = 'p-detail-badge-tag';
            if (this.activeProductModalItem.status_badge.toLowerCase().includes('new')) badge.classList.add('tag-new');
            else if (this.activeProductModalItem.status_badge.toLowerCase().includes('hot')) badge.classList.add('tag-hot');
            else if (this.activeProductModalItem.status_badge.toLowerCase().includes('discount')) badge.classList.add('tag-discount');
            else badge.classList.add('tag-popular');
        } else {
            badge.style.display = 'none';
        }

        // Reset inputs
        document.querySelector('input[name="p-size"][value="regular"]').checked = true;
        document.getElementById('size-reg-label').classList.add('active');
        document.getElementById('size-large-label').classList.remove('active');
        
        document.querySelectorAll('input[name="p-addon"]').forEach(chk => chk.checked = false);
        document.getElementById('p-special-notes').value = '';
        document.getElementById('p-detail-qty').textContent = '1';
        
        this.updateProductModalPrice();
        document.getElementById('product-detail-modal').classList.add('open');
    }

    closeProductDetailModal() {
        document.getElementById('product-detail-modal').classList.remove('open');
    }

    changeProductModalQty(delta) {
        this.productModalQty += delta;
        if (this.productModalQty < 1) this.productModalQty = 1;
        document.getElementById('p-detail-qty').textContent = this.productModalQty;
        this.updateProductModalPrice();
    }

    updateProductModalPrice() {
        if (!this.activeProductModalItem) return;
        
        let basePrice = parseFloat(this.activeProductModalItem.price);
        
        // Size Selector Card calculations
        const sizeOption = document.querySelector('input[name="p-size"]:checked').value;
        const regCard = document.getElementById('size-reg-label');
        const lrgCard = document.getElementById('size-large-label');
        
        if (sizeOption === 'large') {
            basePrice += 80.00;
            lrgCard.classList.add('active');
            regCard.classList.remove('active');
        } else {
            regCard.classList.add('active');
            lrgCard.classList.remove('active');
        }

        // Add-ons Calculations
        document.querySelectorAll('input[name="p-addon"]:checked').forEach(chk => {
            const addPrice = parseFloat(chk.getAttribute('data-price')) || 0;
            basePrice += addPrice;
        });

        const total = basePrice * this.productModalQty;
        document.getElementById('p-detail-total-price').textContent = `₹${total.toFixed(2)}`;
    }

    addProductModalToCart() {
        if (!this.activeProductModalItem) return;

        const sizeOption = document.querySelector('input[name="p-size"]:checked').value;
        const sizeLabel = sizeOption === 'large' ? 'Large' : 'Regular';
        
        const selectedAddons = [];
        document.querySelectorAll('input[name="p-addon"]:checked').forEach(chk => {
            selectedAddons.push(chk.value);
        });

        const specialNotes = document.getElementById('p-special-notes').value.trim();

        // Build customized composite attributes
        let basePrice = parseFloat(this.activeProductModalItem.price);
        let titleAddon = ` (${sizeLabel}`;
        if (sizeOption === 'large') basePrice += 80.00;
        
        if (selectedAddons.length > 0) {
            basePrice += selectedAddons.reduce((sum, name) => {
                const input = document.querySelector(`input[name="p-addon"][value="${name}"]`);
                return sum + (parseFloat(input.getAttribute('data-price')) || 0);
            }, 0);
            titleAddon += `, Add-ons: ${selectedAddons.join(', ')}`;
        }
        titleAddon += ')';

        const customizedItemName = this.activeProductModalItem.name + titleAddon;
        const uniqueCartId = this.activeProductModalItem.id + '_' + Date.now();
        
        this.cart.push({
            id: uniqueCartId,
            name: customizedItemName,
            price: basePrice,
            image_url: this.activeProductModalItem.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            quantity: this.productModalQty,
            notes: specialNotes
        });

        this.updateCartBadge();
        localStorage.setItem('ordering_cart', JSON.stringify(this.cart));
        
        this.playSynthChime('success');
        this.triggerConfetti(document.getElementById('product-detail-modal'));
        
        const badge = document.getElementById('cart-badge-count');
        badge.style.transform = 'scale(1.4)';
        setTimeout(() => badge.style.transform = 'scale(1)', 200);

        this.closeProductDetailModal();
        
        setTimeout(() => {
            this.toggleCartDrawer();
        }, 500);
    }

    handleQuickAdd(event, itemId) {
        event.stopPropagation();
        this.addToCart(itemId);
        this.playSynthChime('success');
    }

    // ==========================================================================
    // PROMO CODES ENGINE
    // ==========================================================================
    applyPromoCode() {
        const codeInput = document.getElementById('promo-code-input');
        const successMsg = document.getElementById('promo-success-msg');
        const errorMsg = document.getElementById('promo-error-msg');
        
        if (!codeInput) return;
        const code = codeInput.value.trim().toUpperCase();
        
        successMsg.classList.add('hidden');
        errorMsg.classList.add('hidden');
        
        if (!code) {
            errorMsg.textContent = 'Please enter a coupon code.';
            errorMsg.classList.remove('hidden');
            return;
        }

        const matchCoupon = this.coupons.find(c => c.code === code && (c.active === true || c.active === "TRUE"));

        if (matchCoupon) {
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            if (subtotal < parseFloat(matchCoupon.min_order)) {
                errorMsg.textContent = `Minimum order of ₹${parseFloat(matchCoupon.min_order).toFixed(2)} required for coupon "${code}".`;
                errorMsg.classList.remove('hidden');
                
                codeInput.style.animation = 'wiggleIcon 0.4s ease';
                setTimeout(() => codeInput.style.animation = '', 450);
                
                this.appliedPromo = null;
                this.renderCart();
                return;
            }

            this.appliedPromo = {
                code: code,
                discountType: matchCoupon.type,
                value: parseFloat(matchCoupon.value),
                label: matchCoupon.label,
                min_order: parseFloat(matchCoupon.min_order)
            };
            
            successMsg.textContent = `Coupon "${code}" applied!`;
            successMsg.classList.remove('hidden');
            this.playSynthChime('success');
            this.triggerConfetti(document.getElementById('cart-drawer'));
            
            this.renderCart();
        } else {
            this.appliedPromo = null;
            errorMsg.textContent = `Invalid code "${code}". Try WELCOME10 or FREEDEL.`;
            errorMsg.classList.remove('hidden');
            
            codeInput.style.animation = 'wiggleIcon 0.4s ease';
            setTimeout(() => codeInput.style.animation = '', 450);
            
            this.renderCart();
        }
    }

    // ==========================================================================
    // ADMIN DASHBOARD ORDERS HISTORY VIEW
    // ==========================================================================
    renderAdminOrders(container) {
        let orderRows = '';
        const searchInputVal = this.adminOrderSearchQuery || '';
        
        const filteredOrders = this.orders.filter(o => {
            if (!searchInputVal) return true;
            const search = searchInputVal.toLowerCase();
            return (o.id && o.id.toLowerCase().includes(search)) || 
                   (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
                   (o.customer_phone && o.customer_phone.toLowerCase().includes(search)) ||
                   (o.status && o.status.toLowerCase().includes(search));
        });

        filteredOrders.forEach(o => {
            let parsedItems = [];
            try {
                parsedItems = JSON.parse(o.items);
            } catch(e) {
                parsedItems = [];
            }
            const itemsSummary = parsedItems.map(itm => `${itm.name} (x${itm.quantity})`).join(', ');
            
            orderRows += `
                <tr>
                    <td><strong>${o.id}</strong><br><small class="text-muted">${new Date(o.created_at).toLocaleString()}</small></td>
                    <td><strong>${o.customer_name}</strong><br><small class="text-muted">${o.customer_phone}</small></td>
                    <td>${o.order_type} (${o.branch})</td>
                    <td title="${itemsSummary}" style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${itemsSummary}</td>
                    <td>₹${parseFloat(o.total).toFixed(2)}</td>
                    <td>
                        <select onchange="app.changeOrderStatusFromAdmin('${o.id}', this.value)" style="padding: 6px 10px; font-size: 0.85rem; background: rgba(0,0,0,0.4); color:#fff; border: 1px solid var(--border-color); border-radius: 6px; outline:none; cursor:pointer;">
                            <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Preparing" ${o.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                            <option value="Ready" ${o.status === 'Ready' ? 'selected' : ''}>Ready</option>
                            <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <button class="table-action-btn" onclick="app.viewOrderDetailsFromAdmin('${o.id}')" title="Print Invoice / View Receipt"><i class="fa-solid fa-file-invoice"></i></button>
                            <button class="table-action-btn btn-del" onclick="app.cancelOrderFromAdmin('${o.id}')" title="Cancel Order"><i class="fa-solid fa-ban"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="mb-2" style="display: flex; gap: 15px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                <div class="hero-search-wrapper" style="max-width: 320px; margin-bottom: 0; box-shadow: none; border-radius: 8px;">
                    <i class="fa-solid fa-magnifying-glass search-icon-main" style="left: 12px; font-size: 0.9rem;"></i>
                    <input type="text" id="admin-orders-search" placeholder="Search orders..." value="${searchInputVal}" oninput="app.handleAdminOrdersSearch(event)" style="padding: 8px 12px 8px 36px; font-size: 0.9rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; width: 100%; color:#fff; outline:none;">
                </div>
                <button class="btn btn-sm btn-secondary" onclick="app.refreshOrdersOnly()"><i class="fa-solid fa-arrows-rotate"></i> Refresh Queue</button>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Type & Branch</th>
                            <th>Items Summary</th>
                            <th>Total Price</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRows || '<tr><td colspan="7" style="text-align:center;">No orders found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    handleAdminOrdersSearch(event) {
        this.adminOrderSearchQuery = event.target.value.trim();
        const container = document.getElementById('admin-content-container');
        this.renderAdminOrders(container);
    }

    async changeOrderStatusFromAdmin(orderId, newStatus) {
        this.showLoader(`Updating Order ${orderId}...`);
        try {
            await this.apiCall('updateOrderStatus', { orderId, status: newStatus });
            await this.loadDatabase();
            this.changeAdminTab('orders');
        } catch(e) {
            alert(e.message);
        } finally {
            this.hideLoader();
        }
    }

    async cancelOrderFromAdmin(orderId) {
        if (!confirm(`Are you sure you want to cancel order ${orderId}?`)) return;
        this.showLoader(`Cancelling Order ${orderId}...`);
        try {
            await this.apiCall('updateOrderStatus', { orderId, status: 'Cancelled' });
            await this.loadDatabase();
            this.changeAdminTab('orders');
        } catch(e) {
            alert(e.message);
        } finally {
            this.hideLoader();
        }
    }

    viewOrderDetailsFromAdmin(orderId) {
        const match = this.orders.find(o => o.id === orderId);
        if (match) {
            this.openTrackModal();
            document.getElementById('track-order-id-input').value = orderId;
            this.trackOrderFromInput();
        }
    }

    // ==========================================================================
    // RIDER DYNAMIC SVG GPS SIMULATION
    // ==========================================================================
    openRiderMapModal(orderId) {
        this.activeMapOrder = this.orders.find(o => o.id === orderId);
        if (!this.activeMapOrder) return;
        
        document.getElementById('rider-map-modal').classList.add('open');
        document.getElementById('riderPin').style.visibility = 'hidden';
        document.getElementById('deliveryPathActive').style.strokeDashoffset = '1000';
        
        const logsContainer = document.getElementById('rider-logs-list-container');
        logsContainer.innerHTML = `
            <div class="rider-log-item active">
                <i class="fa-solid fa-circle-info"></i>
                <div>
                    <span class="time">${new Date().toLocaleTimeString()}</span> - Ready for dispatch.
                </div>
            </div>
        `;
        
        const startBtn = document.getElementById('btn-start-nav');
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Driving Route';
    }

    closeRiderMapModal() {
        document.getElementById('rider-map-modal').classList.remove('open');
    }

    startRiderMapSimulation() {
        const riderPin = document.getElementById('riderPin');
        const path = document.getElementById('deliveryPath');
        const activePath = document.getElementById('deliveryPathActive');
        const logsContainer = document.getElementById('rider-logs-list-container');
        const startBtn = document.getElementById('btn-start-nav');
        
        if (!path || !riderPin || !this.activeMapOrder) return;
        
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-truck-ramp-box fa-spin"></i> Driving Route...';
        
        riderPin.style.visibility = 'visible';
        this.playSynthChime('whip');
        
        const length = path.getTotalLength();
        activePath.style.strokeDasharray = length;
        activePath.style.strokeDashoffset = length;
        
        let progress = 0;
        const speed = 2.5; 
        
        const logStages = {
            10: "Rider accepted delivery ticket. Packaging locked. GPS signal established.",
            30: "Departed Vinay Cafe branch with fresh warm meal.",
            55: "Driving past main junction bypass road. Speed: 52 km/h.",
            75: "Arrived at customer residential sector. Dialing customer phone...",
            90: "Rider at front door. Delivery hand-off completed."
        };
        
        const timer = setInterval(() => {
            progress += speed;
            if (progress >= 100) {
                clearInterval(timer);
                riderPin.setAttribute('transform', `translate(540, 80)`);
                activePath.style.strokeDashoffset = '0';
                
                logsContainer.innerHTML += `
                    <div class="rider-log-item success">
                        <i class="fa-solid fa-circle-check"></i>
                        <div>
                            <span class="time">${new Date().toLocaleTimeString()}</span> - <strong>Delivered!</strong> Ticket closed.
                        </div>
                    </div>
                `;
                
                startBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Route Completed';
                this.playSynthChime('success');
                
                setTimeout(() => {
                    this.updateOrderStatus(this.activeMapOrder.id, 'Delivered', this.currentUser.id);
                    this.closeRiderMapModal();
                }, 2000);
                return;
            }
            
            const currentLen = (progress / 100) * length;
            const point = path.getPointAtLength(currentLen);
            riderPin.setAttribute('transform', `translate(${point.x}, ${point.y})`);
            activePath.style.strokeDashoffset = length - currentLen;
            
            for (let stage in logStages) {
                if (progress >= parseInt(stage) && progress < parseInt(stage) + speed) {
                    logsContainer.innerHTML += `
                        <div class="rider-log-item">
                            <i class="fa-solid fa-location-dot"></i>
                            <div>
                                <span class="time">${new Date().toLocaleTimeString()}</span> - ${logStages[stage]}
                            </div>
                        </div>
                    `;
                    logsContainer.scrollTop = logsContainer.scrollHeight;
                }
            }
        }, 100);
    }

    // ==========================================================================
    // INTERACTIVE OFFERS DRAWER & COUPON MANAGER
    // ==========================================================================
    toggleOffersPicker(event) {
        if (event) event.stopPropagation();
        const list = document.getElementById('offers-picker-list');
        const btn = document.getElementById('btn-offers-picker-toggle');
        if (list && btn) {
            list.classList.toggle('hidden');
            btn.classList.toggle('open');
            if (!list.classList.contains('hidden')) {
                this.renderCartOffers();
            }
        }
    }

    renderCartOffers() {
        const container = document.getElementById('offers-picker-list');
        if (!container) return;
        container.innerHTML = '';
        
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const activeCoupons = this.coupons.filter(c => c.active === true || c.active === "TRUE");

        if (activeCoupons.length === 0) {
            container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:12px;">No active coupon offers at this time.</div>`;
            return;
        }

        activeCoupons.forEach(coupon => {
            const isSelectable = subtotal >= parseFloat(coupon.min_order);
            const opacityClass = isSelectable ? '' : 'style="opacity:0.5;"';
            const action = isSelectable ? `onclick="app.selectOfferCoupon('${coupon.code}')"` : '';
            
            container.innerHTML += `
                <div class="offer-coupon-card" ${opacityClass} ${action}>
                    <div class="offer-card-left">
                        <div class="offer-code-badge">${coupon.code}</div>
                        <div class="offer-desc" style="margin-top:2px;">${coupon.desc || coupon.label}</div>
                        <div class="offer-min-order">Min Order: ₹${parseFloat(coupon.min_order).toFixed(2)}</div>
                    </div>
                    ${isSelectable ? `<button class="btn-apply-offer">Apply</button>` : `<span style="font-size:0.7rem; color:var(--accent-red); font-weight:700;">Needs ₹${parseFloat(coupon.min_order).toFixed(2)}</span>`}
                </div>
            `;
        });
    }

    selectOfferCoupon(code) {
        const input = document.getElementById('promo-code-input');
        if (input) {
            input.value = code;
            this.applyPromoCode();
            this.toggleOffersPicker();
        }
    }

    renderAdminCoupons(container) {
        let rows = '';
        this.coupons.forEach(c => {
            const isActive = c.active === true || c.active === "TRUE";
            rows += `
                <tr>
                    <td><strong class="text-yellow">${c.code}</strong></td>
                    <td>${c.desc || c.label}</td>
                    <td>${c.type === 'percentage' ? (c.value * 100) + '%' : (c.type === 'freedelivery' ? 'Free Delivery' : '₹' + parseFloat(c.value).toFixed(2))}</td>
                    <td>₹${parseFloat(c.min_order).toFixed(2)}</td>
                    <td><span class="badge-status ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? 'Active' : 'Disabled'}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="table-action-btn" onclick="app.openCouponForm('${c.code}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="table-action-btn btn-del" onclick="app.deleteCoupon('${c.code}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="mb-2">
                <button class="btn btn-sm btn-primary" onclick="app.openCouponForm()"><i class="fa-solid fa-plus"></i> Create New Coupon</button>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Coupon Code</th>
                            <th>Description</th>
                            <th>Discount Value</th>
                            <th>Min Order Size</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align:center;">No coupons registered.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    openCouponForm(code = '') {
        const coupon = this.coupons.find(c => c.code === code) || { code: '', type: 'percentage', value: 0.10, min_order: 100, label: '10% OFF', active: true, desc: '' };
        const genericModal = document.getElementById('admin-generic-modal');
        document.getElementById('generic-modal-title').textContent = code ? 'Edit Coupon' : 'Create Coupon';
        
        const isEdit = code ? 'readonly' : '';

        document.getElementById('generic-modal-body-content').innerHTML = `
            <form onsubmit="app.handleSaveCoupon(event)">
                <div class="form-group">
                    <label for="coupon-code">Coupon Code *</label>
                    <input type="text" id="coupon-code" value="${coupon.code}" required placeholder="e.g. EXTRA50" ${isEdit} style="text-transform: uppercase;">
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label for="coupon-type">Discount Type *</label>
                        <select id="coupon-type" onchange="app.handleCouponTypeChange(this.value)">
                            <option value="percentage" ${coupon.type === 'percentage' ? 'selected' : ''}>Percentage (%)</option>
                            <option value="fixed" ${coupon.type === 'fixed' ? 'selected' : ''}>Flat Cash Discount (₹)</option>
                            <option value="freedelivery" ${coupon.type === 'freedelivery' ? 'selected' : ''}>Free Delivery</option>
                        </select>
                    </div>
                    <div class="form-group flex-1" id="coupon-value-group">
                        <label for="coupon-value" id="coupon-value-label">Discount Value *</label>
                        <input type="number" id="coupon-value" step="0.01" value="${coupon.type === 'percentage' ? coupon.value * 100 : coupon.value}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label for="coupon-min-order">Minimum Order Amount (₹) *</label>
                    <input type="number" id="coupon-min-order" step="1" value="${coupon.min_order}" required>
                </div>
                <div class="form-group">
                    <label for="coupon-desc">Coupon Headline Description *</label>
                    <input type="text" id="coupon-desc" value="${coupon.desc || ''}" required placeholder="e.g. Get 10% off your billing total">
                </div>
                <div class="form-group checkbox-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" id="coupon-active" ${coupon.active ? 'checked' : ''}>
                        <span>Coupon is active & selectable by clients</span>
                    </label>
                </div>
                <div class="modal-actions-bar mt-2">
                    <button type="submit" class="btn btn-primary">Save Coupon Code</button>
                </div>
            </form>
        `;
        genericModal.classList.add('open');
        this.handleCouponTypeChange(coupon.type);
    }

    handleCouponTypeChange(val) {
        const valGroup = document.getElementById('coupon-value-group');
        const valLabel = document.getElementById('coupon-value-label');
        const valInput = document.getElementById('coupon-value');
        
        if (!valGroup || !valLabel || !valInput) return;
        
        if (val === 'freedelivery') {
            valGroup.style.display = 'none';
            valInput.required = false;
            valInput.value = '0';
        } else {
            valGroup.style.display = 'block';
            valInput.required = true;
            if (val === 'percentage') {
                valLabel.textContent = 'Discount Percentage (%) *';
            } else {
                valLabel.textContent = 'Flat Discount (₹) *';
            }
        }
    }

    async handleSaveCoupon(event) {
        event.preventDefault();
        const code = document.getElementById('coupon-code').value.trim().toUpperCase();
        const type = document.getElementById('coupon-type').value;
        let value = parseFloat(document.getElementById('coupon-value').value);
        const min_order = parseFloat(document.getElementById('coupon-min-order').value);
        const desc = document.getElementById('coupon-desc').value.trim();
        const active = document.getElementById('coupon-active').checked;

        if (type === 'percentage') {
            value = value / 100; 
        }

        const matchIdx = this.coupons.findIndex(c => c.code === code);
        const couponObj = {
            code, type, value, min_order, desc, active,
            label: type === 'freedelivery' ? 'FREE Delivery' : (type === 'percentage' ? (value * 100) + '% OFF' : '₹' + value + ' OFF')
        };

        if (matchIdx !== -1) {
            this.coupons[matchIdx] = couponObj;
        } else {
            this.coupons.push(couponObj);
        }

        this.showLoader('Saving Coupon...');
        try {
            await this.saveCouponsToDatabase();
            document.getElementById('admin-generic-modal').classList.remove('open');
            this.changeAdminTab('coupons');
        } catch(e) {
            alert(e.message);
        } finally {
            this.hideLoader();
        }
    }

    async deleteCoupon(code) {
        if (!confirm(`Are you sure you want to delete coupon ${code}?`)) return;
        this.coupons = this.coupons.filter(c => c.code !== code);
        this.showLoader('Deleting Coupon...');
        try {
            await this.saveCouponsToDatabase();
            this.changeAdminTab('coupons');
        } catch(e) {
            alert(e.message);
        } finally {
            this.hideLoader();
        }
    }

    async saveCouponsToDatabase() {
        if (this.dbMode === 'mock') {
            localStorage.setItem('ordering_db_coupons', JSON.stringify(this.coupons));
        } else {
            await this.apiCall('saveSettings', { coupons: JSON.stringify(this.coupons) });
        }
        await this.loadDatabase();
    }
}

// Global Instant instantiation
const app = new WebOrderingApp();

// Previous count tracking for sounds
app.previousPendingCount = 0;

window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
