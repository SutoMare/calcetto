// Importiamo la connessione a Supabase
import { supabase } from './config.js';

console.log("DEBUG: index.js caricato correttamente!");

// VARIABILI DI STATO GLOBALI
let prossimePartiteGlobali = []; 
let mostraTutteLeProssime = false; 

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
    console.error("Errore nel caricamento dello storico:", error.message);
    storicoBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Errore nel caricamento dei dati</td></tr>';
  }
}

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

    // Separiamo i match
    const passate = partite.filter(p => p.finita === true);
    const future = partite.filter(p => p.finita !== true);

    // Ordiniamo le future
    future.sort((a, b) => convertiInDataJS(a.data_orario) - convertiInDataJS(b.data_orario));
    prossimePartiteGlobali = future;

    // Render match passati
    passate.forEach(partita => {
      const divPartita = document.createElement('div');
      divPartita.className = 'match-item';
      divPartita.innerHTML = `
        <span>${partita.squadra_casa} <b>${partita.gol_casa} - ${partita.gol_trasferta}</b> ${partita.squadra_trasferta}</span>
        <span class="badge-past">Finita</span>
      `;
      pastMatches.appendChild(divPartita);
    });

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
    btnToggle.style.cssText = "display:block; width:100%; margin-top:15px; padding:8px; background-color:#f0f2f5; color:#007bff; border:1px solid #ddd; border-radius:4px; font-weight:bold; cursor:pointer;";
    btnToggle.innerText = mostraTutteLeProssime ? "Mostra Meno" : ` Mostra Altri (${prossimePartiteGlobali.length - 5})`;
    
    btnToggle.onclick = () => {
      mostraTutteLeProssime = !mostraTutteLeProssime;
      renderProssimiMatch();
    };
    
    upcomingMatches.appendChild(btnToggle);
  }
}

// --- AVVIO ---
caricaClassifica();
caricaPartite();