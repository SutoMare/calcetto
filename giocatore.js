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
      .ilike('nome', nomeGiocatore) // <-- MODIFICATO QUI
      .maybeSingle(); // <-- MODIFICATO ANCHE QUI (Evita il crash se il giocatore non esiste proprio)

    if (giocatoreError) throw giocatoreError;

    // Se il giocatore non esiste proprio nel database, gestiamo l'errore con grazia
    if (!giocatoreData) {
      document.getElementById('nome-giocatore').textContent = "Giocatore non trovato";
      storicoBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:orange;">Questo giocatore non esiste nel database.</td></tr>';
      return;
    }
    if (giocatoreError) throw giocatoreError;

    // Aggiorniamo il punteggio totale in alto nella pagina
    document.getElementById('punteggio-totale').textContent = giocatoreData.punteggio_totale + " pt";

    // 3. Chiediamo tutti i suoi pronostici usando il suo ID
    const { data: pronostici, error: pronosticiError } = await supabase
      .from('pronostici')
      .select('*')
      .eq('giocatore_id', giocatoreData.id)
      .order('created_at', { ascending: false }); 

    if (pronosticiError) throw pronosticiError;

    // 4. Chiediamo TUTTE le partite dal database
    const { data: partite, error: partiteError } = await supabase
      .from('partite')
      .select('*');

    if (partiteError) throw partiteError;

    const mappaPartite = {};
    if (partite) {
      partite.forEach(p => {
        mappaPartite[p.id] = p;
      });
    }

    storicoBody.innerHTML = '';

    if (!pronostici || pronostici.length === 0) {
      storicoBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessun pronostico effettuato finora.</td></tr>';
      return;
    }

    // 5. Creiamo le righe della tabella per ogni pronostico
    pronostici.forEach(pronostico => {
      const partita = mappaPartite[pronostico.partita_id];
      if (!partita) return; 

      const nomePartita = `⚽ ${partita.squadra_casa} vs ${partita.squadra_trasferta}`;
      const tr = document.createElement('tr');
      const risultatoPronosticato = `${pronostico.gol_casa}-${pronostico.gol_trasferta}`;
      const marcatori = pronostico.marcatori ? pronostico.marcatori : "Nessuno";

      let puntiHTML = '';
      let risultatoRealeHTML = '';
      
      // Variabili per i BADGE che aggiungeremo in parte al pronostico
      let badgeSegno = '';
      let badgeRisultato = '';
      let badgeMarcatori = '';

      if (partita.finita) {
        // ---- CALCOLO DEI BADGE VISIVI (Stessa logica dell'Admin) ----
        let pGolCasa = Number(pronostico.gol_casa);
        let pGolTrasf = Number(pronostico.gol_trasferta);
        let rGolCasa = Number(partita.gol_casa);
        let rGolTrasf = Number(partita.gol_trasferta);
        
        let segnoPronostico = pronostico.segno ? pronostico.segno.trim().toUpperCase() : '';
        let segnoReale = partita.segno_reale ? partita.segno_reale.trim().toUpperCase() : '';

        // Badge Segno
        if (segnoPronostico === segnoReale) {
          badgeSegno = ' <span class="point-badge">+1 pt</span>';
        } else {
          badgeSegno = ' <span class="no-points">(errato)</span>';
        }

        // Badge Risultato Esatto + Coerenza
        let coerente = false;
        if (pGolCasa > pGolTrasf && segnoPronostico === '1') coerente = true;
        else if (pGolCasa < pGolTrasf && segnoPronostico === '2') coerente = true;
        else if (pGolCasa === pGolTrasf && (segnoPronostico === '1' || segnoPronostico === '2')) coerente = true;

        let risultatoEsatto = (pGolCasa === rGolCasa && pGolTrasf === rGolTrasf);

        if (risultatoEsatto && coerente) {
          badgeRisultato = ' <span class="point-badge">+2 pt</span>';
        } else {
          badgeRisultato = ' <span class="no-points">(errato)</span>';
        }

        // Badge Marcatori
        let predMarcatori = pronostico.marcatori ? pronostico.marcatori.split(',').map(m => m.trim().toLowerCase()).filter(m => m !== '') : [];
        let realiMarcatori = partita.marcatori_reali ? partita.marcatori_reali.toLowerCase() : "";
        
        if (predMarcatori.length > 0) {
          let tuttiAzzeccati = true;
          for (let marcatore of predMarcatori) {
            if (!realiMarcatori.includes(marcatore)) {
              tuttiAzzeccati = false; break; 
            }
          }
          if (tuttiAzzeccati) {
            let puntiMarcatori = 0;
            for (let i = 0; i < predMarcatori.length; i++) puntiMarcatori += (i + 2); 
            badgeMarcatori = ` <span class="point-badge">+${puntiMarcatori} pt</span>`;
          } else {
            badgeMarcatori = ' <span class="no-points">(errato)</span>';
          }
        }

        // ---- CREAZIONE DELLE CELLE PER LE PARTITE FINITE ----
        puntiHTML = pronostico.punti_guadagnati > 0 
           ? `<td class="total-points-cell">${pronostico.punti_guadagnati}</td>` 
           : `<td class="total-points-cell" style="color: #999;">0</td>`;

        risultatoRealeHTML = `
          <div class="pred-detail">Segno: ${partita.segno_reale || '?'}</div>
          <div class="pred-detail">Risultato: ${partita.gol_casa !== null ? partita.gol_casa : '?'}-${partita.gol_trasferta !== null ? partita.gol_trasferta : '?'}</div>
          <div class="pred-detail">Marcatori: ${partita.marcatori_reali || 'Nessuno'}</div>
        `;
      } else {
        // Se la partita non è finita, non mostriamo badge né punti
        puntiHTML = `<td class="total-points-cell" style="color: #f39c12; font-size: 1em;">In attesa</td>`;
        risultatoRealeHTML = `<div class="pred-detail" style="color:#888;">Partita da giocare</div>`;
      }

      tr.innerHTML = `
        <td><strong>${nomePartita}</strong></td>
        <td>
          <div class="pred-detail">Segno: ${pronostico.segno}${badgeSegno}</div>
          <div class="pred-detail">Risultato: ${risultatoPronosticato}${badgeRisultato}</div>
          <div class="pred-detail">Marcatori: ${marcatori}${badgeMarcatori}</div>
        </td>
        <td>${risultatoRealeHTML}</td>
        ${puntiHTML}
      `;

      storicoBody.appendChild(tr);
    });

  } catch (error) {
    console.error("DEBUG STORICO:", error); // <-- CAMBIA QUESTO
    storicoBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Errore: ${error.message || error}</td></tr>`;
  }
}

// Facciamo partire la funzione all'apertura della pagina
caricaStoricoGiocatore();