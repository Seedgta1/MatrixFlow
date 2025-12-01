
/* 
⚠️ ISTRUZIONI IMPORTANTI PER GOOGLE APPS SCRIPT ⚠️

Copia e incolla questo codice nel tuo editor di script su Google (Estensioni > Apps Script).
Questo aggiornamento OTTIMIZZA la velocità: le immagini vengono scaricate solo quando servono.

---------------- INIZIO CODICE GAS ----------------

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000); 

  try {
    // SOSTITUISCI CON IL TUO ID FOGLIO SE DIVERSO
    var ss = SpreadsheetApp.openById("1RQ8Jpq0PUTVGIPIVa3NgRD4M-TNe8pKVVypVuRtniho");
    
    var usersSheet = ss.getSheetByName("Users");
    var utilsSheet = ss.getSheetByName("Utilities");
    
    if (!usersSheet || !utilsSheet) {
       // Auto-creazione se mancano (fallback sicurezza)
       if (!usersSheet) usersSheet = ss.insertSheet("Users");
       if (!utilsSheet) utilsSheet = ss.insertSheet("Utilities");
    }
    
    // Setup Headers
    if (usersSheet.getLastRow() === 0) usersSheet.appendRow(["id", "username", "password", "email", "phone", "sponsorId", "parentId", "joinedAt", "level", "avatarConfig"]);
    if (utilsSheet.getLastRow() === 0) utilsSheet.appendRow(["id", "userId", "type", "provider", "status", "dateAdded", "attachmentName", "attachmentData"]);

    var action = e.parameter.action;
    var result = {};

    // ------------------------------------------------
    // 1. GET USERS (LITE VERSION) - NO IMMAGINI
    // ------------------------------------------------
    if (action === "getUsers") {
      var rows = usersSheet.getDataRange().getValues();
      var users = [];
      
      if (rows.length > 1) {
        var headers = rows[0];
        // Mappa colonne utenti
        var uColMap = {};
        headers.forEach(function(h, i) { uColMap[h] = i; });

        for (var i = 1; i < rows.length; i++) {
          var user = {
            id: String(rows[i][uColMap['id']]),
            username: rows[i][uColMap['username']],
            password: rows[i][uColMap['password']],
            email: rows[i][uColMap['email']],
            phone: rows[i][uColMap['phone']],
            sponsorId: rows[i][uColMap['sponsorId']],
            parentId: rows[i][uColMap['parentId']],
            joinedAt: rows[i][uColMap['joinedAt']],
            level: rows[i][uColMap['level']],
            avatarConfig: {}
          };
          try { user.avatarConfig = JSON.parse(rows[i][uColMap['avatarConfig']]); } catch(err) {}
          user.utilities = [];
          users.push(user);
        }
        
        // Lettura Utilities (SOLO METADATI, NO attachmentData per velocità)
        var utilRows = utilsSheet.getDataRange().getValues();
        if (utilRows.length > 1) {
          var utilHeaders = utilRows[0];
          var utilColMap = {};
          utilHeaders.forEach(function(h, i) { utilColMap[h] = i; });
          
          for (var i = 1; i < utilRows.length; i++) {
            var r = utilRows[i];
            var uId = String(r[utilColMap['userId']]);
            
            var utility = {
              id: String(r[utilColMap['id']]),
              userId: uId,
              type: r[utilColMap['type']],
              provider: r[utilColMap['provider']],
              status: r[utilColMap['status']],
              dateAdded: r[utilColMap['dateAdded']],
              attachmentName: r[utilColMap['attachmentName']],
              // NOTA: NON INVIAMO attachmentData QUI PER VELOCIZZARE IL CARICAMENTO
              hasAttachment: (r[utilColMap['attachmentData']] && r[utilColMap['attachmentData']] !== "") ? true : false
            };

            var owner = users.find(function(u) { return u.id === uId; });
            if (owner) owner.utilities.push(utility);
          }
        }
      }
      result = users;

    // ------------------------------------------------
    // 2. GET SINGLE IMAGE (LAZY LOAD)
    // ------------------------------------------------
    } else if (action === "getUtilityImage") {
      // Accetta sia POST body che Query Param
      var targetId = e.parameter.utilityId;
      if (!targetId && e.postData && e.postData.contents) {
         try { targetId = JSON.parse(e.postData.contents).utilityId; } catch(e) {}
      }
      
      var rows = utilsSheet.getDataRange().getValues();
      var foundData = null;
      
      // Headers per trovare indice colonna
      var headers = rows[0];
      var idIdx = headers.indexOf("id");
      var dataIdx = headers.indexOf("attachmentData");
      
      if (idIdx > -1 && dataIdx > -1) {
         for(var i=1; i<rows.length; i++) {
            if(String(rows[i][idIdx]) === String(targetId)) {
               foundData = rows[i][dataIdx];
               break;
            }
         }
      }
      
      if (foundData) {
         result = { success: true, attachmentData: foundData };
      } else {
         result = { success: false, error: "Image not found" };
      }

    // ------------------------------------------------
    // 3. REGISTER
    // ------------------------------------------------
    } else if (action === "register") {
      var data = JSON.parse(e.postData.contents);
      usersSheet.appendRow([data.id, data.username, data.password, data.email, data.phone, data.sponsorId, data.parentId, data.joinedAt, data.level, JSON.stringify(data.avatarConfig)]);
      result = { success: true };

    // ------------------------------------------------
    // 4. ADD UTILITY
    // ------------------------------------------------
    } else if (action === "addUtility") {
      var data = JSON.parse(e.postData.contents);
      utilsSheet.appendRow([data.id, data.userId, data.type, data.provider, data.status, data.dateAdded, data.attachmentName, data.attachmentData]);
      result = { success: true };
      
    // ------------------------------------------------
    // 5. UPDATE USER
    // ------------------------------------------------
    } else if (action === "updateUser") {
      var data = JSON.parse(e.postData.contents);
      var rows = usersSheet.getDataRange().getValues();
      for(var i=1; i<rows.length; i++) {
        if(String(rows[i][0]) === String(data.id)) {
           if(data.avatarConfig) usersSheet.getRange(i+1, 10).setValue(JSON.stringify(data.avatarConfig));
           if(data.email) usersSheet.getRange(i+1, 4).setValue(data.email);
           if(data.phone) usersSheet.getRange(i+1, 5).setValue(data.phone);
           break;
        }
      }
      result = { success: true };

    // ------------------------------------------------
    // 6. UPDATE STATUS (ADMIN)
    // ------------------------------------------------
    } else if (action === "updateUtilityStatus") {
      var data = JSON.parse(e.postData.contents);
      var rows = utilsSheet.getDataRange().getValues();
      var found = false;
      var headers = rows[0];
      var idIdx = headers.indexOf("id"); // Colonna ID
      var statusIdx = headers.indexOf("status"); // Colonna Status

      if (idIdx > -1 && statusIdx > -1) {
          for(var i=1; i<rows.length; i++) {
            if(String(rows[i][idIdx]) === String(data.utilityId)) {
              utilsSheet.getRange(i+1, statusIdx + 1).setValue(data.status);
              found = true;
              break;
            }
          }
      }
      
      if (!found) return ContentService.createTextOutput(JSON.stringify({ "error": "Utility ID not found" })).setMimeType(ContentService.MimeType.JSON);
      result = { success: true };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ "error": e.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

---------------- FINE CODICE GAS ----------------
*/

// --- CONFIGURAZIONE GOOGLE SHEETS ---
// URL fornito dall'utente per il database online
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby47789n0WFIM4PhzI0HHBArPPQMZJxF7V0xucbheQlXF7hW7qjqsqQbMF27WPZSuxo/exec';

const TIMEOUT_MS = 20000; // Increased timeout

export const googleSheetsClient = {
  async get(action: string, params: any = {}) {
    if (GOOGLE_SCRIPT_URL.includes('INSERISCI_QUI')) {
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Add cache busting timestamp
    const queryParams = { ...params, action, _: Date.now().toString() };
    const query = new URLSearchParams(queryParams).toString();

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?${query}`, {
            method: 'GET',
            mode: 'cors', // Explicit CORS mode
            redirect: 'follow', // Importante per gli script Google
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json.error) {
                console.error("GS Script Error:", json.error);
                return null;
            }
            return json;
        } catch(e) {
            console.error("Google Sheets ha restituito un errore non JSON:", text.substring(0, 100));
            return null;
        }
    } catch (e: any) {
        clearTimeout(timeoutId);
        console.error("GS Get Network Error", e);
        return null;
    }
  },

  async post(action: string, data: any) {
    if (GOOGLE_SCRIPT_URL.includes('INSERISCI_QUI')) return { success: false, error: "URL mancante" };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}`, {
            method: 'POST',
            mode: 'cors', // Explicit CORS mode
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        const text = await response.text();
        try {
             const json = JSON.parse(text);
             if (json.error) {
                 return { success: false, error: "Errore Cloud: " + json.error };
             }
             return json;
        } catch(e) {
             console.error("Google Sheets POST errore parsing:", text.substring(0, 100));
             return { success: false, error: "Risposta Server non valida" };
        }
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
             return { success: false, error: "Timeout connessione server." };
        }
        console.error("GS Post Error", e);
        return { success: false, error: "Errore di connessione." };
    }
  }
};
