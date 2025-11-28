
// --- CONFIGURAZIONE GOOGLE SHEETS ---
// URL fornito dall'utente per il database online
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby47789n0WFIM4PhzI0HHBArPPQMZJxF7V0xucbheQlXF7hW7qjqsqQbMF27WPZSuxo/exec';

const TIMEOUT_MS = 5000; // 5 Secondi massimo di attesa

export const googleSheetsClient = {
  async get(action: string, params: any = {}) {
    if (GOOGLE_SCRIPT_URL.includes('INSERISCI_QUI')) {
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const query = new URLSearchParams({ action, ...params }).toString();
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?${query}`, {
            method: 'GET',
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
            console.warn("Google Sheets Timeout (>5s). Passaggio a Offline.");
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
             return { success: false, error: "Timeout connessione server (>5s)." };
        }
        console.error("GS Post Error", e);
        return { success: false, error: "Errore di connessione." };
    }
  }
};
