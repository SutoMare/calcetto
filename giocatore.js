// Importiamo la connessione a Supabase
import { supabase } from './config.js';

// --- FUNZIONE PRINCIPALE ---
async function caricaStoricoGiocatore() {
  // 1. Leggiamo il nome dall'URL
  const urlParams = new URLSearchParams(window.location.search);
  const nomeGiocatore = urlParams.get('nome');

  if (!nomeGiocatore) {
    document.getElementById('nome-giocatore').textContent = "Giocatore non trovato";
    return;
  }

  // Aggiorniamo l'interfaccia di base (Nome e Foto)
  document.getElementById('nome-giocatore').textContent = nomeGiocatore;
  const fotoGiocatore = document.getElementById('foto-giocatore');
  fotoGiocatore.src = nomeGiocatore.toLowerCase() + '.jpg';
  fotoGiocatore.onerror = function() { this.src = 'default.jpg'; };

  const storicoBody = document.getElementById('storico-body');
  storicoBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Caricamento storico in corso...</td></tr>';

  try {
    // 2. Troviamo il giocatore su Supabase per avere il suo ID e Punteggio Totale
    const { data: giocatoreData, error: giocatoreError } = await supabase
      .from('giocatori')
      .select('id, punteggio_totale')
      .eq('nome', nomeGiocatore)
      .single();

    if (giocatoreError) throw giocatoreError;

    // Aggiorniamo il punteggio totale in alto nella pagina
    document.getElementById('punteggio-totale').textContent = giocatoreData.punteggio_totale + " pt";

    // 3. Chiediamo tutti i suoi pronostici usando il suo ID
    const { data: pronostici, error: pronosticiError } = await supabase
      .from('pronostici')
      .select('*')
      .eq('giocatore_id', giocatoreData.id)
      .order('created_at', { ascending: false }); // Dal più recente al più vecchio

    if (pronosticiError) throw pronosticiError;

    // 4. Chiediamo TUTTE le partite dal database per poter confrontare i risultati!
    const { data: partite, error: partiteError } = await supabase
      .from('partite')
      .select('*');

    if (partiteError) throw partiteError;

    // Trasformiamo l'array delle partite in un oggetto "dizionario" per comodità
    // (Così sarà facilissimo trovare la partita giusta usando il suo ID)
    const mappaPartite = {};
    if (partite) {
      partite.forEach(p => {
        mappaPartite[p.id] = p;
      });
    }

    // Svuotiamo la tabella per inserire i dati veri
    storicoBody.innerHTML = '';

    if (!pronostici || pronostici.length === 0) {
      storicoBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessun pronostico effettuato finora.</td></tr>';
      return;
    }

    // 5. Creiamo le righe della tabella per ogni pronostico
    pronostici.forEach(pronostico => {
      
      // Prendiamo i dati reali della partita dal database (se esiste)
      const partita = mappaPartite[pronostico.partita_id];
      if (!partita) return; // Se la partita è stata cancellata dal DB, saltiamo la riga

      const nomePartita = `⚽ ${partita.squadra_casa} vs ${partita.squadra_trasferta}`;
      const tr = document.createElement('tr');
      const risultatoPronosticato = `${pronostico.gol_casa}-${pronostico.gol_trasferta}`;
      const marcatori = pronostico.marcatori ? pronostico.marcatori : "Nessuno";

      // Logica visiva per i punti (Mostriamo quanti punti ha fatto solo se è finita)
      let puntiHTML = '';
      if (partita.finita) {
         puntiHTML = pronostico.punti_guadagnati > 0 
            ? `<td class="total-points-cell">${pronostico.punti_guadagnati}</td>` 
            : `<td class="total-points-cell" style="color: #999;">0</td>`;
      } else {
         puntiHTML = `<td class="total-points-cell" style="color: #f39c12; font-size: 1em;">In attesa</td>`;
      }

      // Costruiamo la colonna del risultato reale pescando i dati dal database
      let risultatoRealeHTML = '';
      if (partita.finita) {
        risultatoRealeHTML = `
          <div class="pred-detail">Segno: ${partita.segno_reale || '?'}</div>
          <div class="pred-detail">Risultato: ${partita.gol_casa !== null ? partita.gol_casa : '?'}-${partita.gol_trasferta !== null ? partita.gol_trasferta : '?'}</div>
          <div class="pred-detail">Marcatori: ${partita.marcatori_reali || 'Nessuno'}</div>
        `;
      } else {
        risultatoRealeHTML = `<div class="pred-detail" style="color:#888;">Partita da giocare</div>`;
      }

      tr.innerHTML = `
        <td><strong>${nomePartita}</strong></td>
        <td>
          <div class="pred-detail">Segno: ${pronostico.segno}</div>
          <div class="pred-detail">Risultato: ${risultatoPronosticato}</div>
          <div class="pred-detail">Marcatori: ${marcatori}</div>
        </td>
        <td>${risultatoRealeHTML}</td>
        ${puntiHTML}
      `;

      storicoBody.appendChild(tr);
    });

  } catch (error) {
    console.error("Errore nel caricamento dello storico:", error.message);
    storicoBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Errore nel caricamento dei dati</td></tr>';
  }
}

// Facciamo partire la funzione all'apertura della pagina
caricaStoricoGiocatore();