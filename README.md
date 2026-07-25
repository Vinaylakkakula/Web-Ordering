# Gourmet Express - Web Ordering & Delivery System

A premium, modern Single Page Web Application for food ordering, featuring dynamic menu items, real-time dashboards, order tracking, and full Google Sheets & Drive integrations.

## ⚡ Key Features
* 🛒 **Customer Portal**: Delivery & Pickup order checkout with branch selections and sliding banners.
* 📋 **Order Slip Tracker**: Visual step-by-step progress tracking (Pending ➔ Preparing ➔ Ready ➔ On the Way ➔ Delivered).
* 🖥️ **Admin Control Panel**: Full CRUD operations for menu items, categories, branches, and banner slides.
* 🍳 **Kitchen Monitor**: Real-time 3-column Kanban order flow queue with auto-refreshes every 2 seconds.
* 🛵 **Rider Delivery Portal**: Active route navigator and flat-rate commission tracking ($5.00/order).
* 📊 **Revenue Analytics**: Delivered sales calculations, total orders count, popular dishes breakdown bar charts.
* 🛠️ **Dual-Database Mode**: Run inside local browser storage (Mock Mode) or hook up to real Google Sheets (Live Mode).

---

## 🚀 Rapid Development & Preview (Mock Mode)
By default, the application runs in **Mock Sandbox Mode** using browser `localStorage` for database operations.
1. Simply double-click `index.html` or serve the directory using a local web server (e.g. VS Code Live Server).
2. The page loads with pre-seeded mockup items (Classic Pepperoni Pizza, Wings, Lemonade, etc.).
3. You can place orders, view tracking slips, and log into dashboards immediately.

### 🔑 Staff Account Logins (Mock Mode & Google Sheets Seeds)
Open the profile icon on the top right header to authenticate as a staff user:
* **Admin Dashboard**: Username: `admin` | Password: `admin`
* **Kitchen Panel**: Username: `kitchen` | Password: `kitchen`
* **Rider Dashboard**: Username: `rider` | Password: `rider`

---

## 🌐 Connecting to Live Google Sheets (Live Mode)

Follow these steps to connect the app to a real Google Sheets database and utilize Google Drive for image uploads.

### Step 1: Set up the Google Sheet Database
1. Go to [Google Sheets](https://sheets.google.com) and create a **blank spreadsheet**.
2. Give your sheet a name (e.g. `Gourmet Express Database`).
3. Note the **Spreadsheet ID** from the browser address bar:
   `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID_HERE]/edit`

### Step 2: Set up the Google Apps Script Backend
1. In your Google Sheet, click **Extensions** ➔ **Apps Script**.
2. Delete any code in the editor and copy-paste the entire contents of the local [Code.gs](file:///Code.gs) file.
3. Click the disk icon to **Save**.

### Step 3: Deploy as a Web App API
1. Click the **Deploy** button on the top-right ➔ **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Fill out the configuration fields:
   * **Description**: `Web Ordering API`
   * **Execute as**: `Me (your-email@gmail.com)`
   * **Who has access**: **`Anyone`** *(CRITICAL: Must be set to Anyone to allow frontend checkout API requests).*
4. Click **Deploy**.
5. Grant permissions by logging into your Google account (click "Advanced" and then "Go to Web Ordering (unsafe)" if asked).
6. Copy the **Web App URL** generated in the deployment dialog:
   `https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec`

### Step 4: Configure the Frontend
1. Open `index.html` in your browser.
2. Click the **Settings (gear icon)** in the top right.
3. Select **Live Production Mode**.
4. Paste your copied **Google Apps Script Web App Endpoint URL** into the URL input field.
5. Click **Save Settings**.
6. Click the **Initialize / Reset Database** yellow button to create the database tables inside your Google Sheet automatically!
7. Check your Google Sheet; you will see sheets named `Items`, `Categories`, `Orders`, `Users`, `Branches`, `Banners`, and `Settings` populated with seed rows.

---

## 📁 Google Drive Image Upload Integration
When you add/edit a product item in the **Admin Dashboard** and select **Upload to Google Drive**:
1. The backend automatically checks for a folder named `Web-Ordering Uploads` inside your Google Drive. If it does not exist, it creates one.
2. The folder sharing permission is set to public ("Anyone with the link can view").
3. The uploaded picture file is saved inside this folder.
4. The system retrieves a direct public image link (`https://lh3.googleusercontent.com/d/[fileId]`) and saves it to the Google Sheet.
5. The image loads instantly in your web application.

---

## 📱 Local Verification Checklist
* Check that categories filter products correctly.
* Verify items can be added to the shopping basket.
* Test checkout details validations.
* Verify real-time order tracking slip details update immediately upon state transitions in the Kitchen or Rider panels.
