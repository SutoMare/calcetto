// Importiamo la connessione a Supabase
import { supabase } from './config.js';

console.log("DEBUG: index.js caricato correttamente!");

// VARIABILI DI STATO GLOBALI
let prossimePartiteGlobali = []; 
let mostraTutteLeProssime = false; 
let partitePassateGlobali = [];
let mostraTutteLePassate = false;
let giocatoriGlobali = [];
let sortKeyClassifica = 'punteggio_totale'; // colonna attiva di ordinamento

// --- INTERVALLO DEL TURNO ATTUALMENTE IN CORSO ---
const INIZIO_TURNO_CORRENTE = new Date(2026, 6, 8, 12, 0);  
const FINE_TURNO_CORRENTE   = new Date(2026, 6, 12, 12, 0);
const COLONNA_TURNO_CORRENTE = 'r4_score'; 

// --- FUNZIONE AUSILIARIA PER LE DATE ---
function convertiInDataJS(stringaData) {
  if (!stringaData) return new Date(8640000000000000); 
  
  try {
    const parti = stringaData.split(' ');
    if (parti.length < 2) return new Date(8640000000000000);
    
    const [data, orario] = parti;
    const [giorno, mese, anno] = data.split('/');
    const [ora, minuto] = orario.split(':');
    
    return new Date(anno, mese - 1, giorno, ora, minuto);
  } catch (e) {
    console.error("Errore parsing data per stringa:", stringaData, e);
    return new Date(8640000000000000);
  }
}

// --- 1. FUNZIONE PER CARICARE LA CLASSIFICA ---
async function caricaClassifica() {
  const leaderboardBody = document.getElementById('leaderboard-body');
  if (!leaderboardBody) return;

  try {
    const { data: giocatori, error } = await supabase
      .from('giocatori')
      .select(`nome, punteggio_totale, ${COLONNA_TURNO_CORRENTE}`);

    if (error) throw error;

    giocatoriGlobali = giocatori || [];
    renderClassifica();

  } catch (error) {
    console.error("Errore nel caricamento della classifica:", error.message);
    leaderboardBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Errore nel caricamento dei dati</td></tr>';
  }
}

// --- 1b. FUNZIONE DI RENDERING/ORDINAMENTO DELLA CLASSIFICA ---
function renderClassifica() {
  const leaderboardBody = document.getElementById('leaderboard-body');
  const thTotali = document.getElementById('th-punti-totali');
  const thTurno = document.getElementById('th-punti-turno');
  if (!leaderboardBody) return;

  leaderboardBody.innerHTML = '';

  if (!giocatoriGlobali || giocatoriGlobali.length === 0) {
    leaderboardBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessun giocatore registrato</td></tr>';
    return;
  }

  // Ordiniamo una copia in base alla colonna scelta (sempre decrescente)
  const giocatoriOrdinati = [...giocatoriGlobali].sort((a, b) => {
    const valA = Number(a[sortKeyClassifica]) || 0;
    const valB = Number(b[sortKeyClassifica]) || 0;
    return valB - valA;
  });

  // Aggiorniamo l'evidenziazione + freccia sulle intestazioni cliccabili
  if (thTotali && thTurno) {
    thTotali.classList.toggle('active-sort', sortKeyClassifica === 'punteggio_totale');
    thTurno.classList.toggle('active-sort', sortKeyClassifica === COLONNA_TURNO_CORRENTE);

    thTotali.innerHTML = `Punti Totali${sortKeyClassifica === 'punteggio_totale' ? ' <span class="sort-arrow">▾</span>' : ''}`;
    thTurno.innerHTML = `Punti Turno${sortKeyClassifica === COLONNA_TURNO_CORRENTE ? ' <span class="sort-arrow">▾</span>' : ''}`;
  }

  giocatoriOrdinati.forEach((giocatore, index) => {
    const posizione = index + 1;
    const tr = document.createElement('tr');
    const puntiTurno = giocatore[COLONNA_TURNO_CORRENTE] ?? 0;

    tr.innerHTML = `
      <td>${posizione}</td>
      <td>
        <a href="giocatore.html?nome=${giocatore.nome.toLowerCase()}" class="player-link" style="text-transform: capitalize;">
          ${giocatore.nome}
        </a>
      </td>
      <td><b>${giocatore.punteggio_totale}</b></td>
      <td>${puntiTurno}</td>
    `;

    leaderboardBody.appendChild(tr);
  });
}

// Colleghiamo il click sulle intestazioni della classifica per cambiare l'ordinamento
document.addEventListener('DOMContentLoaded', () => {
  const thTotali = document.getElementById('th-punti-totali');
  const thTurno = document.getElementById('th-punti-turno');

  if (thTotali) {
    thTotali.addEventListener('click', () => {
      sortKeyClassifica = 'punteggio_totale';
      renderClassifica();
    });
  }
  if (thTurno) {
    thTurno.addEventListener('click', () => {
      sortKeyClassifica = COLONNA_TURNO_CORRENTE;
      renderClassifica();
    });
  }
});

// --- 2. FUNZIONE PER CARICARE LE PARTITE ---
async function caricaPartite() {
  const upcomingMatches = document.getElementById('upcoming-matches');
  const pastMatches = document.getElementById('past-matches');

  if (!upcomingMatches || !pastMatches) {
    console.error("DEBUG CRITICO: Contenitori HTML non trovati!");
    return;
  }

  try {
    console.log("DEBUG: Chiamata a Supabase in corso...");
    const { data: partite, error } = await supabase
      .from('partite')
      .select('*');

    if (error) throw error;

    console.log("DEBUG: Dati ricevuti da Supabase:", partite);

    upcomingMatches.innerHTML = '';
    pastMatches.innerHTML = '';

    if (!partite || partite.length === 0) {
      upcomingMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessuna partita in programma.</p>';
      pastMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessun risultato disponibile.</p>';
      return;
    }

    // Le partite passate si mostrano SEMPRE tutte, anche quelle di turni
    // precedenti: la soglia del turno corrente si applica solo alle prossime,
    // per non far ricomparire tra le "upcoming" partite di un turno già finito.
    const passate = partite.filter(p => p.finita === true);
    const future = partite.filter(p => p.finita !== true && convertiInDataJS(p.data_orario) >= INIZIO_TURNO_CORRENTE);

    // Ordiniamo le passate dalla più recente
    passate.sort((a, b) => convertiInDataJS(b.data_orario) - convertiInDataJS(a.data_orario));
    partitePassateGlobali = passate;

    // Ordiniamo le future
    future.sort((a, b) => convertiInDataJS(a.data_orario) - convertiInDataJS(b.data_orario));
    prossimePartiteGlobali = future;

    // Render match passati
    renderPartitePassate();

    // Render match futuri
    renderProssimiMatch();

  } catch (error) {
    console.error("Errore nel caricamento delle partite:", error.message);
    upcomingMatches.innerHTML = '<p style="color:red;">Errore caricamento partite</p>';
    pastMatches.innerHTML = '<p style="color:red;">Errore caricamento partite</p>';
  }
}

// --- 3. FUNZIONE RENDERING PROSSIMI MATCH ---
function renderProssimiMatch() {
  const upcomingMatches = document.getElementById('upcoming-matches');
  if (!upcomingMatches) return;
  
  upcomingMatches.innerHTML = ''; 

  if (prossimePartiteGlobali.length === 0) {
    upcomingMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessuna partita in programma.</p>';
    return;
  }

  const partiteDaMostrare = mostraTutteLeProssime 
    ? prossimePartiteGlobali 
    : prossimePartiteGlobali.slice(0, 5);

  partiteDaMostrare.forEach(partita => {
    const divPartita = document.createElement('div');
    divPartita.className = 'match-item';
    divPartita.innerHTML = `
      <a href="partita.html?id=${partita.id}" style="text-decoration: none; color: inherit;">
        <strong>${partita.squadra_casa} vs ${partita.squadra_trasferta}</strong>
      </a>
      <span class="match-date">${partita.data_orario || 'Data da definire'}</span>
    `;
    upcomingMatches.appendChild(divPartita);
  });

  if (prossimePartiteGlobali.length > 5) {
    const btnToggle = document.createElement('button');
    btnToggle.className = 'btn-toggle';
    btnToggle.innerText = mostraTutteLeProssime ? "Mostra Meno" : ` Mostra Altri (${prossimePartiteGlobali.length - 5})`;
    
    btnToggle.onclick = () => {
      mostraTutteLeProssime = !mostraTutteLeProssime;
      renderProssimiMatch();
    };
    
    upcomingMatches.appendChild(btnToggle);
  }
}

// --- 4. FUNZIONE RENDERING PARTITE PASSATE ---
function renderPartitePassate() {
  const pastMatches = document.getElementById('past-matches');
  if (!pastMatches) return;

  pastMatches.innerHTML = '';

  if (partitePassateGlobali.length === 0) {
    pastMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessun risultato disponibile.</p>';
    return;
  }

  const partiteDaMostrare = mostraTutteLePassate
    ? partitePassateGlobali
    : partitePassateGlobali.slice(0, 5);

  partiteDaMostrare.forEach(partita => {
    const divPartita = document.createElement('div');
    divPartita.className = 'match-item';
    divPartita.innerHTML = `
      <a href="partita.html?id=${partita.id}" style="text-decoration: none; color: inherit; display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span>${partita.squadra_casa} <b>${partita.gol_casa} - ${partita.gol_trasferta}</b> ${partita.squadra_trasferta}</span>
        <span class="badge-past">Finita</span>
      </a>
    `;
    pastMatches.appendChild(divPartita);
  });

  if (partitePassateGlobali.length > 5) {
    const btnToggle = document.createElement('button');
    btnToggle.className = 'btn-toggle';
    btnToggle.innerText = mostraTutteLePassate ? "Mostra Meno" : ` Mostra Altri (${partitePassateGlobali.length - 5})`;

    btnToggle.onclick = () => {
      mostraTutteLePassate = !mostraTutteLePassate;
      renderPartitePassate();
    };

    pastMatches.appendChild(btnToggle);
  }
}

// --- 5. FUNZIONE PER CARICARE I VINCITORI DI OGNI TURNO ---
async function caricaVincitoriTurni() {
  const roundWinnersBody = document.getElementById('round-winners-body');
  if (!roundWinnersBody) return;

  // Elenco dei turni: colonna nel DB + etichetta da mostrare.
  const turni = [
    { colonna: 'r16_score', etichetta: 'Sedicesimi' },
    { colonna: 'r8_score', etichetta: 'Ottavi' },
    { colonna: 'r4_score', etichetta: 'Quarti' },
    { colonna: 'semi_score', etichetta: 'Semifinale' },
    { colonna: 'final_score', etichetta: 'Finale' },
  ];

  try {
    const { data: giocatori, error } = await supabase
      .from('giocatori')
      .select('nome, r16_score, r8_score, r4_score, semi_score, final_score');

    if (error) throw error;

    roundWinnersBody.innerHTML = '';

    if (!giocatori || giocatori.length === 0) {
      roundWinnersBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nessun dato disponibile</td></tr>';
      return;
    }

    turni.forEach(turno => {
      // Troviamo il punteggio massimo per questo turno tra tutti i giocatori.
      let punteggioMax = -Infinity;
      giocatori.forEach(g => {
        const val = Number(g[turno.colonna]) || 0;
        if (val > punteggioMax) punteggioMax = val;
      });

      // Tutti i giocatori che hanno raggiunto quel massimo (gestisce i pari merito).
      const vincitori = giocatori
        .filter(g => (Number(g[turno.colonna]) || 0) === punteggioMax)
        .map(g => g.nome);

      const tr = document.createElement('tr');
      const nomiVincitori = punteggioMax <= 0 || vincitori.length === 0
        ? '—'
        : vincitori.map(n => `<span style="text-transform: capitalize;">${n}</span>`).join(', ');

      tr.innerHTML = `
        <td>${turno.etichetta}</td>
        <td>${nomiVincitori}</td>
        <td><b>${punteggioMax > -Infinity ? punteggioMax : 0}</b></td>
      `;

      roundWinnersBody.appendChild(tr);
    });

  } catch (error) {
    console.error("Errore nel caricamento dei vincitori per turno:", error.message);
    roundWinnersBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Errore nel caricamento dei dati</td></tr>';
  }
}

// --- AVVIO ---
caricaClassifica();
caricaPartite();
caricaVincitoriTurni();