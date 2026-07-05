// 1. Importiamo la connessione a Supabase
import { supabase } from './config.js';

// --- CONTROLLO IDENTITÀ ---
// Leggiamo chi è l'utente dal browser (salvato durante il login)
const utenteCorrente = localStorage.getItem('utenteLoggato');

if (!utenteCorrente) {
  // Se non c'è, lo cacciamo alla pagina di login
  alert("Devi fare il login per scommettere!");
  window.location.href = "login.html";
} else {
  // Se c'è, mostriamo il suo nome nel banner dell'HTML
  document.getElementById('nome-utente-display').textContent = utenteCorrente;
}
// --- FUNZIONE AUSILIARIA: Converte la stringa "GG/MM/AAAA HH:MM" in un oggetto Date di JS
function convertiInDataJS(stringaData) {
  if (!stringaData) return new Date(8640000000000000); // Se manca la data, la sposta in fondo al futuro
  
  const [data, orario] = stringaData.split(' ');
  const [giorno, mese, anno] = data.split('/');
  const [ora, minuto] = orario.split(':');
  
  return new Date(anno, mese - 1, giorno, ora, minuto);
}

// --- CARICAMENTO DELLE PARTITE NEL MENU A TENDINA (AGGIORNATA) ---
async function caricaPartiteDisponibili() {
  const selectPartita = document.getElementById('partita');

  try {
    // Chiediamo a Supabase SOLO le partite non ancora finite, prendendo anche la data_orario
    const { data: partite, error } = await supabase
      .from('partite')
      .select('id, squadra_casa, squadra_trasferta, data_orario') // <-- Aggiunto data_orario qui
      .eq('finita', false);

    if (error) throw error;

    // Svuotiamo il menu a tendina lasciando solo l'opzione di default
    selectPartita.innerHTML = '<option value="" disabled selected>-- Scegli una partita --</option>';

    // 🕒 FILTRO: Escludiamo le partite già iniziate (data/ora nel passato rispetto ad adesso)
    const adesso = new Date();
    const partiteFuture = (partite || []).filter(partita => convertiInDataJS(partita.data_orario) > adesso);

    if (partiteFuture.length === 0) {
      const option = document.createElement('option');
      option.disabled = true;
      option.textContent = "Nessuna partita disponibile al momento";
      selectPartita.appendChild(option);
      // Disabilitiamo anche il bottone se non ci sono partite
      document.querySelector('button[type="submit"]').disabled = true;
      return;
    }

    // 🔥 ORDINAMENTO: Ordiniamo l'array delle partite dalla più vicina alla più lontana
    partiteFuture.sort((a, b) => convertiInDataJS(a.data_orario) - convertiInDataJS(b.data_orario));

    // Aggiungiamo le opzioni dinamicamente inserendo anche Giorno e Ora nel testo visibile
    partiteFuture.forEach(partita => {
      const option = document.createElement('option');
      option.value = partita.id; 
      
      // Recuperiamo la data o mostriamo un testo di fallback se non è inserita
      const infoData = partita.data_orario ? `(${partita.data_orario})` : '(Data da definire)';
      
      // Il testo combinerà l'emoji, le squadre e la data completa
      option.textContent = `⚽ ${partita.squadra_casa} vs ${partita.squadra_trasferta}   ${infoData}`;
      
      selectPartita.appendChild(option);
    });

  } catch (error) {
    console.error("Errore nel caricamento delle partite:", error.message);
    selectPartita.innerHTML = '<option value="" disabled selected>Errore di caricamento</option>';
  }
}

// Facciamo partire il caricamento delle partite appena si apre la pagina
caricaPartiteDisponibili();

// --- GESTIONE DELL'INVIO DEL FORM ---
const pronosticoForm = document.getElementById('pronostico-form');
const submitButton = document.querySelector('button[type="submit"]');

pronosticoForm.addEventListener('submit', async function(event) {
  event.preventDefault(); // Blocca il ricaricamento della pagina
  
  // Disabilitiamo il pulsante per evitare che qualcuno clicchi due volte per sbaglio
  submitButton.disabled = true;
  submitButton.textContent = "Salvataggio in corso...";

  // Raccogliamo i dati dai campi
  const partitaScelta = document.getElementById('partita').value;
  const segnoScelto = document.getElementById('segno').value;
  // Convertiamo in numeri interi per essere sicuri che Supabase li accetti bene
  const golCasa = parseInt(document.getElementById('gol-casa').value);
  const golTrasf = parseInt(document.getElementById('gol-trasferta').value);
  const marcatoriScelti = document.getElementById('marcatori').value;

  try {
    // STEP A: Troviamo l'ID numerico del giocatore partendo dal nome
    const { data: giocatoreData, error: giocatoreError } = await supabase
      .from('giocatori')
      .select('id')
      .eq('nome', utenteCorrente)
      .single(); // Usiamo single() perché sappiamo che il nome è unico

    if (giocatoreError) throw giocatoreError;
    
    const giocatoreId = giocatoreData.id;

    // STEP B: Facciamo l'UPSERT nella tabella pronostici
    const { error: upsertError } = await supabase
      .from('pronostici')
      .upsert({
        giocatore_id: giocatoreId,
        partita_id: partitaScelta,
        segno: segnoScelto,
        gol_casa: golCasa,
        gol_trasferta: golTrasf,
        marcatori: marcatoriScelti
      }, {
        onConflict: 'giocatore_id, partita_id' 
      });

    if (upsertError) throw upsertError;

    // Se arriviamo qui, è andato tutto perfettamente!
    alert("Pronostico salvato con successo!");
    
    // Riportiamo l'utente alla classifica
    window.location.href = "index.html";

  } catch (error) {
    console.error("Errore durante il salvataggio:", error.message);
    alert("Si è verificato un errore di connessione. Riprova.");
    
    // Riabilitiamo il bottone in caso di errore per fargli riprovare
    submitButton.disabled = false;
    submitButton.textContent = "Salva Pronostico";
  }
});