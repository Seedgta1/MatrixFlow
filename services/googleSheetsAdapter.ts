
/* 
⚠️ ISTRUZIONI IMPORTANTI PER GOOGLE APPS SCRIPT ⚠️

Copia e incolla questo codice nel tuo editor di script su Google (Estensioni > Apps Script).
Questo codice supporta:
1. Salvataggio immagini (attachmentData)
2. Modifica stato utenze da parte dell'admin
3. Gestione corretta dei fogli Users e Utilities

---------------- INIZIO CODICE GAS ----------------

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other processes to finish.
  lock.tryLock(30000);

  try {
    // SOSTITUISCI CON IL TUO ID SE DIVERSO
    var ss = SpreadsheetApp.openById("1RQ8Jpq0PUTVGIPIVa3NgRD4M-TNe8pKVVypVuRtniho");
    
    var usersSheet = ss.getSheetByName("Users");
    var utilsSheet = ss.getSheetByName("Utilities");
    
    if (!usersSheet || !utilsSheet) {
       return ContentService.createTextOutput(JSON.stringify({ "error": "Fogli 'Users' o 'Utilities' mancanti." })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Setup Headers se vuoti
    if (usersSheet.getLastRow() === 0) usersSheet.appendRow(["id", "username", "password", "email", "phone", "sponsorId", "parentId", "joinedAt", "level", "avatarConfig"]);
    // NOTA: Aggiunto attachmentData alla fine
    if (utilsSheet.getLastRow() === 0) utilsSheet.appendRow(["id", "userId", "type", "provider", "status", "dateAdded", "attachmentName", "attachmentData"]);

    var action = e.parameter.action;
    var result = {};

    if (action === "getUsers") {
      var rows = usersSheet.getDataRange().getValues();
      var users = [];
      
      // Lettura Utenti
      if (rows.length > 1) {
        var headers = rows[0];
        for (var i = 1; i < rows.length; i++) {
          var user = {};
          for (var j = 0; j < headers.length; j++) { user[headers[j]] = rows[i][j]; }
          try { user.avatarConfig = JSON.parse(user.avatarConfig); } catch(err) {}
          user.utilities = [];
          users.push(user);
        }
        
        // Lettura Utilities e associazione
        var utilRows = utilsSheet.getDataRange().getValues();
        if (utilRows.length > 1) {
          var utilHeaders = utilRows[0];
          // Mappa indice colonne per velocità
          var colMap = {};
          utilHeaders.forEach(function(h, idx) { colMap[h] = idx; });
          
          for (var i = 1; i < utilRows.length; i++) {
            var row = utilRows[i];
            var uId = row[colMap['userId']];
            
            var utilObj = {
              id: row[colMap['id']],
              type: row[colMap['type']],
              provider: row[colMap['provider']],
              status: row[colMap['status']],
              dateAdded: row[colMap['dateAdded']],
              attachmentName: row[colMap['attachmentName']],
              attachmentData: row[colMap['attachmentData']] || "" // Legge l'immagine Base64
            };

            var owner = users.find(function(u) { return String(u.id) === String(uId); });
            if (owner) owner.utilities.push(utilObj);
          }
        }
      }
      result = users;

    } else if (action === "register") {
      var data = JSON.parse(e.postData.contents);
      usersSheet.appendRow([data.id, data.username, data.password, data.email, data.phone, data.sponsorId, data.parentId, data.joinedAt, data.level, JSON.stringify(data.avatarConfig)]);
      result = { success: true };

    } else if (action === "addUtility") {
      var data = JSON.parse(e.postData.contents);
      // Salva tutti i campi inclusa l'immagine (attachmentData)
      utilsSheet.appendRow([data.id, data.userId, data.type, data.provider, data.status, data.dateAdded, data.attachmentName, data.attachmentData]);
      result = { success: true };
      
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

    } else if (action === "updateUtilityStatus") {
      var data = JSON.parse(e.postData.contents);
      var rows = utilsSheet.getDataRange().getValues();
      var found = false;
      // Cerca l'utenza per ID (colonna 0)
      for(var i=1; i<rows.length; i++) {
        if(String(rows[i][0]) === String(data.utilityId)) {
           // Aggiorna Status (Colonna index 4 -> E)
           // Assumiamo che l'ordine sia ["id", "userId", "type", "provider", "status", ...]
           // Status è la 5a colonna (indice 4 + 1 = 5)
           utilsSheet.getRange(i+1, 5).setValue(data.status);
           found = true;
           break;
        }
      }
      if (!found) return ContentService.createTextOutput(JSON.stringify({ "error": "Utility not found" })).setMimeType(ContentService.MimeType.JSON);
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

const TIMEOUT_MS = 15000; // Increased timeout for heavy data (images)

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
            // Controllo errori applicativi restituiti dallo script
            if (json.error) {
                console.error("GS Script Error:", json.error);
                if (json.error.includes("getSheetByName")) {
                    console.warn("Lo script non trova i fogli. Assicurati di usare .openById() nello script.");
                }
                return null;
            }
            return json;
        } catch(e) {
            console.error("Google Sheets ha restituito un errore non JSON:", text.substring(0, 100));
            return null;
        }
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
            console.warn("Google Sheets Timeout (>15s). Passaggio a Offline.");
        } else {
            console.error("GS Get Network Error", e);
        }
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
                 if (json.error.includes("getSheetByName")) {
                     return { success: false, error: "Errore Script: Fogli non trovati. Aggiorna lo script con openById." };
                 }
                 return { success: false, error: "Errore Cloud: " + json.error };
             }
             return json;
        } catch(e) {
             console.error("Google Sheets POST errore parsing:", text.substring(0, 100));
             return { success: false, error: "Risposta Server non valida (HTML/Error)" };
        }
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
             return { success: false, error: "Timeout connessione server (>15s)." };
        }
        console.error("GS Post Error", e);
        return { success: false, error: "Errore di connessione." };
    }
  }
};
