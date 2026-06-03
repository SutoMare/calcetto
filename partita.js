import { supabase } from './config.js';

async function caricaDettaglioPartita() {
  // Prende l'ID della partita dall'indirizzo (es: partita.html?id=5)
  const urlParams = new URLSearchParams(window.location.search);
  const partitaId = urlParams.get('id');

  if (!partitaId) {
    document.getElementById('match-title').textContent = "❌ Nessuna partita selezionata.";
    document.getElementById('predictions-body').innerHTML = '';
    return;
  }

  try {
    // 1. Scarica i dati di QUESTA specifica partita
    const { data: partita, error: errPartita } = await supabase
      .from('partite')
      .select('*')
      .eq('id', partitaId)
      .single();

    if (errPartita) throw errPartita;

    // 2. Compila il riquadro in alto (Info Partita)
    document.getElementById('match-title').textContent = `⚽ ${partita.squadra_casa} vs ${partita.squadra_trasferta}`;
    
    const statusContainer = document.getElementById('match-status-container');
    const thPunti = document.getElementById('th-punti');
    const actionContainer = document.getElementById('action-container');

    if (partita.finita) {
      // Se è finita: Mostra il risultato vero, mostra la colonna punti e nasconde il bottone
      statusContainer.innerHTML = `
        <div class="match-result-box">
          <span class="badge-past">PARTITA CONCLUSA</span><br><br>
          Risultato: <b>${partita.gol_casa} - ${partita.gol_trasferta}</b><br>
          Segno: <b>${partita.segno_reale}</b><br>
          Marcatori: <b>${partita.marcatori_reali || 'Nessuno'}</b>
        </div>
      `;
      thPunti.style.display = 'table-cell'; 
    } else {
      // Se NON è finita: Mostra "In attesa" e accende il bottone "Fai pronostico"
      statusContainer.innerHTML = `<span class="badge-live">IN ATTESA</span>`;
      actionContainer.style.display = 'block';
    }

    // 3. Scarica i nomi di tutti i giocatori (ci serve per collegare l'ID al Nome)
    const { data: giocatori, error: errGiocatori } = await supabase.from('giocatori').select('id, nome');
    if (errGiocatori) throw errGiocatori;
    
    const mappaGiocatori = {};
    giocatori.forEach(g => {
      mappaGiocatori[g.id] = g.nome;
    });

    // 4. Scarica tutti i pronostici legati a QUESTA partita
    const { data: pronostici, error: errPronostici } = await supabase
      .from('pronostici')
      .select('*')
      .eq('partita_id', partitaId);

    if (errPronostici) throw errPronostici;

    const tbody = document.getElementById('predictions-body');
    tbody.innerHTML = '';

    if (pronostici.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888;">Ancora nessun pronostico per questo match.</td></tr>`;
      return;
    }

    // 5. Se la partita è finita, ORDINA i pronostici in base ai punti (dal più alto al più basso)
    if (partita.finita) {
      pronostici.sort((a, b) => {
        let puntiA = a.punti_guadagnati || 0;
        let puntiB = b.punti_guadagnati || 0;
        return puntiB - puntiA; // Ordine decrescente
      });
    }

    // 6. Crea le righe della tabella
    pronostici.forEach(p => {
      const nomeGiocatore = mappaGiocatori[p.giocatore_id] || 'Sconosciuto';
      const tr = document.createElement('tr');

      let html = `
        <td><a href="giocatore.html?nome=${nomeGiocatore}" class="player-link">${nomeGiocatore}</a></td>
        <td>
          <div class="pred-detail">Segno: <b>${p.segno}</b></div>
          <div class="pred-detail">Risultato: <b>${p.gol_casa} - ${p.gol_trasferta}</b></div>
          <div class="pred-detail">Marcatori: <b>${p.marcatori || 'Nessuno'}</b></div>
        </td>
      `;

      // Aggiungiamo la cella dei punti solo se la partita è finita
      if (partita.finita) {
        let punti = p.punti_guadagnati !== null ? p.punti_guadagnati : 0;
        html += `<td class="total-points-cell">${punti} pt</td>`;
      }

      tr.innerHTML = html;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error(error);
    document.getElementById('match-title').textContent = "❌ Errore nel caricamento.";
  }
}

// Avvia tutto all'apertura della pagina
caricaDettaglioPartita();