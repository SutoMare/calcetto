// Importiamo la connessione a Supabase
import { supabase } from './config.js';

// --- 1. FUNZIONE PER CARICARE LA CLASSIFICA ---
async function caricaClassifica() {
  const leaderboardBody = document.getElementById('leaderboard-body');

  try {
    const { data: giocatori, error } = await supabase
      .from('giocatori')
      .select('nome, punteggio_totale')
      .order('punteggio_totale', { ascending: false });

    if (error) throw error;

    leaderboardBody.innerHTML = '';

    if (!giocatori || giocatori.length === 0) {
      leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nessun giocatore registrato</td></tr>';
      return;
    }

    giocatori.forEach((giocatore, index) => {
      const posizione = index + 1; 
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>${posizione}</td>
        <td>
          <a href="giocatore.html?nome=${giocatore.nome.toLowerCase()}" class="player-link" style="text-transform: capitalize;">
            ${giocatore.nome}
          </a>
        </td>
        <td><b>${giocatore.punteggio_totale}</b></td>
      `;
      
      leaderboardBody.appendChild(tr);
    });

  } catch (error) {
    console.error("Errore nel caricamento della classifica:", error.message);
    leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Errore di caricamento classifica</td></tr>';
  }
}

// --- 2. FUNZIONE PER CARICARE LE PARTITE ---
async function caricaPartite() {
  // Selezioniamo i due contenitori HTML per le partite
  const upcomingMatches = document.getElementById('upcoming-matches');
  const pastMatches = document.getElementById('past-matches');

  try {
    // Chiediamo a Supabase TUTTE le partite
    const { data: partite, error } = await supabase
      .from('partite')
      .select('*')
      .order('id', { ascending: true }); // Le ordiniamo per ID, ma potrai cambiare l'ordine in futuro se vorrai

    if (error) throw error;

    // Svuotiamo i dati finti scritti a mano in index.html
    upcomingMatches.innerHTML = '';
    pastMatches.innerHTML = '';

    if (!partite || partite.length === 0) {
      upcomingMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessuna partita in programma.</p>';
      pastMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessun risultato disponibile.</p>';
      return;
    }

    // Dividiamo le partite nei due blocchi
    partite.forEach(partita => {
      // Creiamo il div base per la singola partita
      const divPartita = document.createElement('div');
      divPartita.className = 'match-item';

      if (partita.finita === true) {
        // SE LA PARTITA È FINITA -> Va nei "Match Passati" e mostriamo il risultato
        divPartita.innerHTML = `
          <span>${partita.squadra_casa} <b>${partita.gol_casa} - ${partita.gol_trasferta}</b> ${partita.squadra_trasferta}</span>
          <span class="badge-past">Finita</span>
        `;
        pastMatches.appendChild(divPartita);

      } else {
        // SE LA PARTITA NON È FINITA -> Va nei "Prossimi Match" e mostriamo l'orario
        divPartita.innerHTML = `
          <span>${partita.squadra_casa} vs ${partita.squadra_trasferta}</span>
          <span class="match-date">${partita.data_orario || 'Data da definire'}</span>
        `;
        upcomingMatches.appendChild(divPartita);
      }
    });

  } catch (error) {
    console.error("Errore nel caricamento delle partite:", error.message);
    upcomingMatches.innerHTML = '<p style="color:red;">Errore caricamento partite</p>';
    pastMatches.innerHTML = '<p style="color:red;">Errore caricamento partite</p>';
  }
}

// --- 3. AVVIO DELLE FUNZIONI ---
// Appena il file viene caricato dal browser, facciamo partire entrambe le funzioni in parallelo
caricaClassifica();
caricaPartite();