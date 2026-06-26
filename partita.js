import { supabase } from './config.js';

async function caricaDettaglioPartita() {
  const urlParams = new URLSearchParams(window.location.search);
  const partitaId = urlParams.get('id');

  if (!partitaId) {
    document.getElementById('match-title').textContent = "❌ Nessuna partita selezionata.";
    document.getElementById('predictions-body').innerHTML = '';
    return;
  }

  try {
    const { data: partita, error: errPartita } = await supabase.from('partite').select('*').eq('id', partitaId).single();
    if (errPartita) throw errPartita;

    document.getElementById('match-title').textContent = `⚽ ${partita.squadra_casa} vs ${partita.squadra_trasferta}`;
    
    const statusContainer = document.getElementById('match-status-container');
    const actionContainer = document.getElementById('action-container');
    const thPunti = document.getElementById('th-punti');

    if (partita.finita) {
      statusContainer.innerHTML = `
        <div class="match-result-box">
          <span class="badge-past">PARTITA CONCLUSA</span><br><br>
          Risultato: <b>${partita.gol_casa} - ${partita.gol_trasferta}</b><br>
          Vincitore: <b>${partita.segno_reale}</b><br>
          Marcatori: <b>${partita.marcatori_reali || 'Nessuno'}</b>
        </div>
      `;
      // Accendiamo la colonna "Punti Totali"
      thPunti.style.display = 'table-cell';
    } else {
      statusContainer.innerHTML = `<span class="badge-live">IN ATTESA</span>`;
      actionContainer.style.display = 'block';
    }

    const { data: giocatori, error: errGiocatori } = await supabase.from('giocatori').select('id, nome');
    if (errGiocatori) throw errGiocatori;
    
    const mappaGiocatori = {};
    giocatori.forEach(g => mappaGiocatori[g.id] = g.nome);

    const { data: pronostici, error: errPronostici } = await supabase.from('pronostici').select('*').eq('partita_id', partitaId);
    if (errPronostici) throw errPronostici;

    const tbody = document.getElementById('predictions-body');
    tbody.innerHTML = '';

    if (pronostici.length === 0) {
      // Calcoliamo quante colonne unire in base allo stato della partita
      const colspan = partita.finita ? 5 : 4;
      tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: #888; padding: 20px;">Ancora nessun pronostico per questo match.</td></tr>`;
      return;
    }

    // Se la partita è finita, ordiniamo i giocatori dal punteggio più alto al più basso
    if (partita.finita) {
      pronostici.sort((a, b) => (b.punti_guadagnati || 0) - (a.punti_guadagnati || 0));
    }

    // Costruiamo la tabella riga per riga
    pronostici.forEach(p => {
      const nomeGiocatore = mappaGiocatori[p.giocatore_id] || 'Sconosciuto';
      const tr = document.createElement('tr');

      let htmlRiga = `
        <td><a href="giocatore.html?nome=${nomeGiocatore}" class="player-link">${nomeGiocatore}</a></td>
        <td><b>${p.segno || '?'}</b></td>
        <td><b>${p.gol_casa !== null ? p.gol_casa : '?'} - ${p.gol_trasferta !== null ? p.gol_trasferta : '?'}</b></td>
        <td style="text-transform: capitalize;">${p.marcatori || '-'}</td>
      `;

      // Aggiungiamo la cella dei punti solo se la partita è terminata
      if (partita.finita) {
        let punti = p.punti_guadagnati !== null ? p.punti_guadagnati : 0;
        htmlRiga += `<td class="total-points-cell">${punti} pt</td>`;
      }

      tr.innerHTML = htmlRiga;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error(error);
    document.getElementById('match-title').textContent = "❌ Errore nel caricamento.";
  }
}

caricaDettaglioPartita();