/**
 * Google Apps Script Backend for Web Ordering System
 * Handles Google Sheets CRUD API endpoints and Google Drive image uploading.
 */

function doGet(e) {
  // Return simple text output if visited directly
  return ContentService.createTextOutput("Web Ordering API is running successfully. Please connect your frontend application to this Web App URL.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const result = { success: false, error: "" };
  
  try {
    // Parse the request contents (expected text/plain containing JSON to bypass CORS preflight check)
    let requestData;
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else {
      throw new Error("No data found in request body.");
    }
    
    const action = requestData.action;
    const data = requestData.data;
    
    // Initialize DB if required (first-run check)
    initDatabase();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    switch (action) {
      case "init":
        result.data = {
          items: getSheetData("Items"),
          categories: getSheetData("Categories"),
          branches: getSheetData("Branches"),
          banners: getSheetData("Banners"),
          settings: getSettingsMap()
        };
        result.success = true;
        break;
        
      case "getItems":
        result.data = getSheetData("Items");
        result.success = true;
        break;
        
      case "getCategories":
        result.data = getSheetData("Categories");
        result.success = true;
        break;
        
      case "getOrders":
        result.data = getSheetData("Orders");
        result.success = true;
        break;
        
      case "getBranches":
        result.data = getSheetData("Branches");
        result.success = true;
        break;
        
      case "getBanners":
        result.data = getSheetData("Banners");
        result.success = true;
        break;
        
      case "getUsers":
        result.data = getSheetData("Users");
        result.success = true;
        break;
        
      case "saveItem":
        result.data = saveRowData("Items", data);
        result.success = true;
        break;
        
      case "deleteItem":
        deleteRowData("Items", data.id);
        result.success = true;
        break;
        
      case "saveCategory":
        result.data = saveRowData("Categories", data);
        result.success = true;
        break;
        
      case "deleteCategory":
        deleteRowData("Categories", data.id);
        result.success = true;
        break;
        
      case "saveBranch":
        result.data = saveRowData("Branches", data);
        result.success = true;
        break;
        
      case "deleteBranch":
        deleteRowData("Branches", data.id);
        result.success = true;
        break;
        
      case "saveBanner":
        result.data = saveRowData("Banners", data);
        result.success = true;
        break;
        
      case "deleteBanner":
        deleteRowData("Banners", data.id);
        result.success = true;
        break;
        
      case "saveUser":
        result.data = saveRowData("Users", data);
        result.success = true;
        break;
        
      case "deleteUser":
        deleteRowData("Users", data.id);
        result.success = true;
        break;
        
      case "createOrder":
        result.data = createOrder(data);
        result.success = true;
        break;
        
      case "updateOrderStatus":
        result.data = updateOrderStatus(data.orderId, data.status, data.riderId);
        result.success = true;
        break;
        
      case "uploadImage":
        result.data = uploadImage(data.base64Data, data.filename);
        result.success = true;
        break;
        
      case "login":
        result.data = authenticateUser(data.username, data.password);
        if (result.data) {
          result.success = true;
        } else {
          result.success = false;
          result.error = "Invalid username or password.";
        }
        break;

      case "saveSettings":
        saveSettingsData(data);
        result.success = true;
        break;
        
      default:
        throw new Error("Invalid action: " + action);
    }
    
  } catch (error) {
    result.success = false;
    result.error = error.toString();
  }
  
  // Return response with CORS handling (standard web app output format)
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Setup standard tables if they do not exist, and pre-populate them with default data.
 */
function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No active spreadsheet found. Make sure this script is container-bound to a Google Sheet.");
  }
  
  const tables = {
    "Items": ["id", "name", "description", "price", "category", "image_url", "status_badge", "available", "branches"],
    "Categories": ["id", "name", "active"],
    "Orders": ["id", "customer_name", "customer_email", "customer_phone", "order_type", "branch", "address", "items", "subtotal", "delivery_fee", "total", "status", "rider_id", "created_at", "updated_at"],
    "Users": ["id", "username", "password", "role", "name", "status"],
    "Branches": ["id", "city", "name", "address", "active"],
    "Banners": ["id", "title", "subtitle", "image_url", "link_url", "active"],
    "Settings": ["key", "value"]
  };
  
  for (let tableName in tables) {
    let sheet = ss.getSheetByName(tableName);
    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      sheet.appendRow(tables[tableName]);
      
      // format headers to bold
      sheet.getRange(1, 1, 1, tables[tableName].length).setFontWeight("bold");
      
      // Seed default data if table was empty
      seedDefaultData(tableName);
    }
  }
}

/**
 * Retreive list of settings as key-value pair map.
 */
function getSettingsMap() {
  const data = getSheetData("Settings");
  const settings = {};
  data.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

/**
 * Core Helper: Read sheet rows and convert to Array of JSON Objects.
 */
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return []; // Only headers or empty
  
  const headers = values[0];
  const data = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowObj = {};
    headers.forEach((header, index) => {
      let cellValue = row[index];
      // Format boolean checks
      if (cellValue === "TRUE" || cellValue === true) {
        cellValue = true;
      } else if (cellValue === "FALSE" || cellValue === false) {
        cellValue = false;
      }
      rowObj[header] = cellValue;
    });
    data.push(rowObj);
  }
  
  return data;
}

/**
 * Core Helper: Insert or Update a row based on item ID.
 */
function saveRowData(sheetName, itemData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet " + sheetName + " does not exist.");
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Assign new ID if not present
  if (!itemData.id) {
    itemData.id = sheetName.substring(0, 3).toUpperCase() + "-" + Math.floor(100000 + Math.random() * 900000);
  }
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  let rowNum = -1;
  
  // Search for existing ID
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == itemData.id) {
      rowNum = i + 1; // 1-based index conversion
      break;
    }
  }
  
  // Map JSON values back to columns order
  const rowValues = headers.map(header => {
    let val = itemData[header];
    if (val === undefined) return "";
    return val;
  });
  
  if (rowNum !== -1) {
    // Update existing row
    sheet.getRange(rowNum, 1, 1, headers.length).setValues([rowValues]);
  } else {
    // Insert new row
    sheet.appendRow(rowValues);
  }
  
  return itemData;
}

/**
 * Core Helper: Delete row by ID.
 */
function deleteRowData(sheetName, itemId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == itemId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

/**
 * Checkout logic: create a new order and notify the customer by email.
 */
function createOrder(orderData) {
  orderData.id = "ORD-" + Math.floor(100000 + Math.random() * 900000);
  orderData.status = "Pending";
  orderData.rider_id = "";
  orderData.created_at = new Date().toISOString();
  orderData.updated_at = new Date().toISOString();
  
  const savedOrder = saveRowData("Orders", orderData);
  
  // Send email receipt to customer
  try {
    if (orderData.customer_email) {
      sendOrderEmailReceipt(savedOrder);
    }
  } catch (err) {
    Logger.log("Failed to send email: " + err.toString());
  }
  
  return savedOrder;
}

/**
 * Handle Order State Transitions (Pending -> Preparing -> Ready -> Out for Delivery -> Delivered).
 */
function updateOrderStatus(orderId, newStatus, riderId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Orders");
  if (!sheet) throw new Error("Orders sheet not found");
  
  const values = sheet.getDataRange().getValues();
  let rowNum = -1;
  const headers = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == orderId) {
      rowNum = i + 1;
      break;
    }
  }
  
  if (rowNum === -1) throw new Error("Order ID not found: " + orderId);
  
  const statusCol = headers.indexOf("status") + 1;
  const riderCol = headers.indexOf("rider_id") + 1;
  const updateCol = headers.indexOf("updated_at") + 1;
  
  sheet.getRange(rowNum, statusCol).setValue(newStatus);
  sheet.getRange(rowNum, updateCol).setValue(new Date().toISOString());
  
  if (riderId !== undefined) {
    sheet.getRange(rowNum, riderCol).setValue(riderId);
    
    // Accumulate rider earnings if marked as Delivered
    if (newStatus === "Delivered") {
      accumulateRiderEarnings(riderId);
    }
  }
  
  // Return the updated order details
  const updatedRows = getSheetData("Orders");
  return updatedRows.find(o => o.id === orderId);
}

/**
 * Adds $5.00 delivery earning to rider when marked as Delivered.
 */
function accumulateRiderEarnings(riderId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) return;
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  let idCol = headers.indexOf("id");
  let earningsCol = headers.indexOf("status"); // Reusing status for simplicity, or appending columns.
  
  // Let's create a dynamic check if "earnings" exists, otherwise add the column
  let earnIndex = headers.indexOf("earnings");
  if (earnIndex === -1) {
    sheet.getRange(1, headers.length + 1).setValue("earnings").setFontWeight("bold");
    earnIndex = headers.length;
  }
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] == riderId) {
      const cellRange = sheet.getRange(i + 1, earnIndex + 1);
      const currentEarn = parseFloat(cellRange.getValue() || 0);
      cellRange.setValue(currentEarn + 50.00); // Earn ₹50.00 per delivery flat rate commission
      break;
    }
  }
}

/**
 * Simple Authentication match.
 */
function authenticateUser(username, password) {
  const users = getSheetData("Users");
  const matchedUser = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password && u.status === true);
  if (matchedUser) {
    // Exclude password from response
    const copy = Object.assign({}, matchedUser);
    delete copy.password;
    return copy;
  }
  return null;
}

/**
 * Upload Base64 Image to Google Drive and return public link.
 */
function uploadImage(base64Data, filename) {
  // Folder initialization
  const FOLDER_NAME = "Web-Ordering Uploads";
  let folder;
  
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(FOLDER_NAME);
    // Make folder contents publicly readable so uploaded images can be shown in frontend
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  
  // Strip metadata header if present (e.g. data:image/png;base64,)
  let cleanBase64 = base64Data;
  if (base64Data.indexOf(",") !== -1) {
    cleanBase64 = base64Data.split(",")[1];
  }
  
  const decoded = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decoded).setName(filename);
  
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Return the web content URL for direct rendering in an <img> source
  // We use standard webContentLink (downloads directly) or direct preview link
  const fileId = file.getId();
  
  // Direct image rendering link structure
  return "https://lh3.googleusercontent.com/d/" + fileId;
}

/**
 * Format and send transaction receipt.
 */
function sendOrderEmailReceipt(order) {
  let items = [];
  try {
    if (typeof order.items === 'string') {
      items = JSON.parse(order.items);
    } else if (Array.isArray(order.items)) {
      items = order.items;
    }
  } catch (e) {
    items = [];
  }
  
  let itemsHtml = "";
  items.forEach(item => {
    const itemNotes = item.notes ? `<br><small style="color:#d4af37; font-style:italic;">Note: "${item.notes}"</small>` : "";
    itemsHtml += `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); color:#e0e0e0;">
          <strong>${item.name}</strong>${itemNotes}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center; color:#e0e0e0;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: right; color:#ffd000; font-weight:bold;">
          ₹${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `;
  });
  
  const emailHtml = `
    <div style="font-family: 'Outfit', 'Inter', 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; background: #0c0c0e; border: 1px solid #d4af37; border-radius: 12px; color: #ffffff;">
      <div style="text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.2); padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">Vinay <span style="color: #ffd000;">Cafe</span></h1>
        <p style="color: #ffd000; margin: 5px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Order Confirmed</p>
      </div>
      
      <p style="font-size: 16px; line-height: 1.5; color: #f0f0f0;">Hello <strong>${order.customer_name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #a0a0a5;">We have successfully received your order and our chefs are already preparing it. Here are your transaction details:</p>
      
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 13.5px; line-height: 1.6; color: #c8c8cd;">
        <strong style="color: #ffd000;">Order Code:</strong> ${order.id}<br>
        <strong>Dining Option:</strong> ${order.order_type}<br>
        <strong>Selected Branch:</strong> ${order.branch}<br>
        ${order.order_type === "Delivery" ? `<strong>Address:</strong> ${order.address}<br>` : ""}
        <strong>Date & Time:</strong> ${new Date(order.created_at).toLocaleString()}
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px;">
        <thead>
          <tr style="background: rgba(212, 175, 55, 0.1);">
            <th style="padding: 10px; text-align: left; color:#ffd000; font-weight:bold; border-bottom: 1px solid #d4af37;">Dish Item</th>
            <th style="padding: 10px; text-align: center; color:#ffd000; font-weight:bold; border-bottom: 1px solid #d4af37;">Qty</th>
            <th style="padding: 10px; text-align: right; color:#ffd000; font-weight:bold; border-bottom: 1px solid #d4af37;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div style="text-align: right; margin-top: 20px; font-size: 14px; line-height: 1.8; color: #a0a0a5; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
        Subtotal: <span style="color:#ffffff;">₹${parseFloat(order.subtotal).toFixed(2)}</span><br>
        Delivery Fee: <span style="color:#ffffff;">₹${parseFloat(order.delivery_fee).toFixed(2)}</span><br>
        <span style="font-size: 18px; color: #ffd000; font-weight: 800;">Grand Total: ₹${parseFloat(order.total).toFixed(2)}</span>
      </div>
      
      <div style="text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.2); padding-top: 20px; margin-top: 30px; font-size: 12px; color: #888890;">
        <p style="margin: 0 0 5px 0;">Have questions about your meal? Contact us directly at your selected branch.</p>
        <p style="margin: 0; font-weight:bold; color:#ffd000;">Thank you for dining with Vinay Cafe!</p>
      </div>
    </div>
  `;
  
  MailApp.sendEmail({
    to: order.customer_email,
    subject: "Vinay Cafe - Order Receipt [#" + order.id + "]",
    htmlBody: emailHtml
  });
}

/**
 * Seed Database with Default Configurations.
 */
function seedDefaultData(tableName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tableName);
  if (!sheet) return;
  
  const defaultSeeds = {
    "Categories": [
      ["CAT-1", "Popular!", true],
      ["CAT-2", "Starters", true],
      ["CAT-3", "Pizza Flavors", true],
      ["CAT-4", "Desserts", true],
      ["CAT-5", "Beverages & Extras", true]
    ],
    
    "Items": [
      ["ITM-1", "Classic Pepperoni Pizza", "Delicious mozzarella cheese with load of beef pepperonis on hand-tossed dough.", 349.00, "Pizza Flavors", "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500", "Popular!", true, "All"],
      ["ITM-2", "Garlic Butter Parmesan Bread", "Warm toasted bread coated with melted butter, chopped garlic, parsley and parmesan cheese.", 149.00, "Starters", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500", "Hot", true, "All"],
      ["ITM-3", "Buffalo Chicken Wings", "Crispy fried chicken wings tossed in spicy red-hot buffalo sauce served with ranch.", 249.00, "Starters", "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500", "New", true, "All"],
      ["ITM-4", "Double Fudge Chocolate Brownie", "Rich chocolate brownie baked with fudge chunks, topped with vanilla ice cream syrup.", 129.00, "Desserts", "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500", "Discount 10%", true, "All"],
      ["ITM-5", "Gourmet Margherita Pizza", "Fresh vine-ripened tomatoes, sweet basil leaves, and sliced fresh buffalo mozzarella.", 299.00, "Pizza Flavors", "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500", "Popular!", true, "All"],
      ["ITM-6", "Cold Premium Lemonade", "Freshly squeezed lemon juice, sparkling water, mint leaves, and ice.", 79.00, "Beverages & Extras", "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500", "", true, "All"]
    ],
    
    "Branches": [
      ["BRH-1", "Mumbai", "Bandra West", "Linking Road, Bandra, Mumbai", true],
      ["BRH-2", "Mumbai", "Andheri East", "Sakinaka, Andheri, Mumbai", true],
      ["BRH-3", "Delhi", "Connaught Place", "Inner Circle, Connaught Place, New Delhi", true],
      ["BRH-4", "Delhi", "South Ext", "Ring Road, South Extension, New Delhi", true]
    ],
    
    "Banners": [
      ["BAN-1", "New Menu Items", "Try our delicious new additions today", "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200", "#", true],
      ["BAN-2", "Weekend Crazy Double Deals", "Buy 1 Get 1 Free on all Large Pizzas", "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200", "#", true]
    ],
    
    "Users": [
      ["USR-1", "admin", "admin", "Admin", "Chief Administrator", true],
      ["USR-2", "kitchen", "kitchen", "Kitchen", "Main Kitchen Chef", true],
      ["USR-3", "rider", "rider", "Rider", "Express Rider Johnny", true]
    ],
    
    "Settings": [
      ["drive_folder_id", ""],
      ["delivery_fee", "50.00"],
      ["tax_rate", "0.05"],
      ["hero_background_url", "https://media.tenor.com/y2h2652Bv8gAAAAd/pizza-pizza-oven.gif"]
    ]
  };
  
  if (defaultSeeds[tableName]) {
    const data = defaultSeeds[tableName];
    data.forEach(row => {
      sheet.appendRow(row);
    });
  }
}

/**
 * Update settings key value records in Google Sheet.
 */
function saveSettingsData(settingsMap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Settings");
  if (!sheet) return;
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  for (let key in settingsMap) {
    const val = settingsMap[key];
    let found = false;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(val);
        found = true;
        break;
      }
    }
    
    if (!found) {
      sheet.appendRow([key, val]);
    }
  }
}
