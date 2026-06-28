// VARIABILI DI STATO GLOBALI (servono a gestire il bottone "Mostra altri")
let prossimePartiteGlobali = []; // Salverà l'elenco completo ordinato delle prossime partite
let mostraTutteLeProssime = false; // Stato per capire se la lista è espansa o ridotta

// --- FUNZIONE AUSILIARIA: Converte la stringa "GG/MM/AAAA HH:MM" in un oggetto Date di JS
function convertiInDataJS(stringaData) {
  if (!stringaData) return new Date(8640000000000000); // Se non c'è data, la mette in fondo al futuro
  
  const [data, orario] = stringaData.split(' ');
  const [giorno, mese, anno] = data.split('/');
  const [ora, minuto] = orario.split(':');
  
  // I mesi in JavaScript partono da 0 (Gennaio = 0, Giugno = 5, ecc.)
  return new Date(anno, mese - 1, giorno, ora, minuto);
}

// --- 2. FUNZIONE PER CARICARE LE PARTITE (AGGIORNATA) ---
async function caricaPartite() {
  const upcomingMatches = document.getElementById('upcoming-matches');
  const pastMatches = document.getElementById('past-matches');

  try {
    // 1. Chiediamo a Supabase tutte le partite
    const { data: partite, error } = await supabase
      .from('partite')
      .select('*');

    if (error) throw error;

    upcomingMatches.innerHTML = '';
    pastMatches.innerHTML = '';

    if (!partite || partite.length === 0) {
      upcomingMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessuna partita in programma.</p>';
      pastMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessun risultato disponibile.</p>';
      return;
    }

    // 2. Separiamo subito i match passati da quelli futuri
    const passate = partite.filter(p => p.finita === true);
    const future = partite.filter(p => p.finita !== true);

    // 3. ORDINAMENTO PER DATA: Ordiniamo le prossime partite (dalla più vicina alla più lontana)
    future.sort((a, b) => convertiInDataJS(a.data_orario) - convertiInDataJS(b.data_orario));

    // Salivamo la lista ordinata nella variabile globale per riutilizzarla al click del bottone
    prossimePartiteGlobali = future;

    // 4. Rendering dei MATCH PASSATI (rimane invariato)
    passate.forEach(partita => {
      const divPartita = document.createElement('div');
      divPartita.className = 'match-item';
      divPartita.innerHTML = `
        <span>${partita.squadra_casa} <b>${partita.gol_casa} - ${partita.gol_trasferta}</b> ${partita.squadra_trasferta}</span>
        <span class="badge-past">Finita</span>
      `;
      pastMatches.appendChild(divPartita);
    });

    // 5. Rendering dei PROSSIMI MATCH (con logica del limite a 5)
    renderProssimiMatch();

  } catch (error) {
    console.error("Errore nel caricamento delle partite:", error.message);
    upcomingMatches.innerHTML = '<p style="color:red;">Errore caricamento partite</p>';
    pastMatches.innerHTML = '<p style="color:red;">Errore caricamento partite</p>';
  }
}

// --- NUOVA FUNZIONE: Disegna la lista dei prossimi match (tagliata a 5 o completa)
function renderProssimiMatch() {
  const upcomingMatches = document.getElementById('upcoming-matches');
  upcomingMatches.innerHTML = ''; // Svuota il contenitore

  if (prossimePartiteGlobali.length === 0) {
    upcomingMatches.innerHTML = '<p style="color: #666; padding: 10px 0;">Nessuna partita in programma.</p>';
    return;
  }

  // Se 'mostraTutteLeProssime' è false prendiamo solo le prime 5, altrimenti tutte
  const partiteDaMostrare = mostraTutteLeProssime 
    ? prossimePartiteGlobali 
    : prossimePartiteGlobali.slice(0, 5);

  // Stampiamo le partite filtrate
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

  // Se ci sono più di 5 partite in totale, aggiungiamo il pulsante di espansione/riduzione
  if (prossimePartiteGlobali.length > 5) {
    const btnToggle = document.createElement('button');
    btnToggle.style.cssText = `
      display: block;
      width: 100%;
      margin-top: 15px;
      padding: 8px;
      background-color: #f0f2f5;
      color: #007bff;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
    `;
    
    // Cambiamo il testo del bottone a seconda dello stato
    btnToggle.innerText = mostraTutteLeProssime ? "⬆️ Mostra Meno" : `⬇️ Mostra Altri (${prossimePartiteGlobali.length - 5})`;
    
    // Gestore dell'evento click sul bottone
    btnToggle.onclick = () => {
      mostraTutteLeProssime = !mostraTutteLeProssime; // Inverte lo stato
      renderProssimiMatch(); // Ridibuja solo la sezione dei prossimi match
    };
    
    upcomingMatches.appendChild(btnToggle);
  }
}