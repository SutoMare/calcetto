import { supabase } from './config.js';

const btnCalcola = document.getElementById('btn-calcola');
const logArea = document.getElementById('log-area');

// Funzione per scrivere a schermo i log in stile "Hacker"
function log(messaggio) {
  logArea.innerHTML += `> ${messaggio}<br>`;
}

btnCalcola.addEventListener('click', async () => {
  btnCalcola.disabled = true;
  logArea.innerHTML = '> INIZIO CALCOLO PUNTEGGI...<br>';

  try {
    // 1. Scarichiamo tutte le partite che sono state segnate come "finite" su Supabase
    const { data: partiteFinite, error: errPartite } = await supabase.from('partite').select('*').eq('finita', true);
    if (errPartite) throw errPartite;
    
    // Mettiamole in un dizionario per trovarle subito
    const mappaPartite = {};
    partiteFinite.forEach(p => mappaPartite[p.id] = p);

    // 2. Scarichiamo TUTTI i pronostici
    const { data: pronostici, error: errPronostici } = await supabase.from('pronostici').select('*');
    if (errPronostici) throw errPronostici;

    // Variabile per tenere traccia dei punti totali da dare a ciascun giocatore
    const puntiPerGiocatore = {}; 
    log(`Trovate ${partiteFinite.length} partite concluse e ${pronostici.length} pronostici nel DB.`);

    // 3. IL CUORE DEL SISTEMA: Analizziamo ogni singolo pronostico
    for (let pronostico of pronostici) {
      const partita = mappaPartite[pronostico.partita_id];
      
      // Assicuriamoci che ogni giocatore parta da 0 punti nel nostro calcolo
      if (!puntiPerGiocatore[pronostico.giocatore_id]) {
        puntiPerGiocatore[pronostico.giocatore_id] = 0;
      }

      // Se la partita relativa al pronostico non è ancora finita, non diamo punti e saltiamo
      if (!partita) continue;

      let puntiGiocata = 0;

      // ----------------------------------------------------
      // REGOLA 1: SEGNO ESATTO (+1 pt)
      // ----------------------------------------------------
      if (pronostico.segno === partita.segno_reale) {
        puntiGiocata += 1;
      }

      // ----------------------------------------------------
      // REGOLA 2: RISULTATO ESATTO (+2 pt) E COERENZA
      // ----------------------------------------------------
      // Che segno implicava il punteggio inserito dall'utente?
      let segnoImplicato = 'X';
      if (pronostico.gol_casa > pronostico.gol_trasferta) segnoImplicato = '1';
      else if (pronostico.gol_casa < pronostico.gol_trasferta) segnoImplicato = '2';

      let coerente = (pronostico.segno === segnoImplicato);
      let risultatoEsatto = (pronostico.gol_casa === partita.gol_casa && pronostico.gol_trasferta === partita.gol_trasferta);

      // Come hai richiesto: prendi i punti SOLO se hai azzeccato il risultato esatto E sei stato coerente
      if (risultatoEsatto && coerente) {
        puntiGiocata += 2;
      }

      // ----------------------------------------------------
      // REGOLA 3: MARCATORI (TUTTO O NIENTE: +2, +3, +4...)
      // ----------------------------------------------------
      // Puliamo i testi: rimuoviamo gli spazi vuoti e mettiamo tutto minuscolo
      let predMarcatori = pronostico.marcatori ? pronostico.marcatori.split(',').map(m => m.trim().toLowerCase()).filter(m => m !== '') : [];
      let realiMarcatori = partita.marcatori_reali ? partita.marcatori_reali.toLowerCase() : "";

      if (predMarcatori.length > 0) {
        let tuttiAzzeccati = true;
        
        // Controlliamo che OGNI marcatore previsto sia contenuto nella lista dei marcatori reali
        for (let marcatore of predMarcatori) {
          if (!realiMarcatori.includes(marcatore)) {
            tuttiAzzeccati = false;
            break; // Sbagliato uno, persi tutti! (Tutto o niente)
          }
        }

        if (tuttiAzzeccati) {
          // Assegniamo i punti a salire: il 1° vale 2, il 2° vale 3, il 3° vale 4...
          for (let i = 0; i < predMarcatori.length; i++) {
            puntiGiocata += (i + 2); 
          }
        }
      }

      // Salviamo i punti guadagnati per questa singola partita su Supabase
      await supabase
        .from('pronostici')
        .update({ punti_guadagnati: puntiGiocata })
        .eq('giocatore_id', pronostico.giocatore_id)
        .eq('partita_id', pronostico.partita_id);

      // Aggiungiamo i punti al "Sacco" totale di questo giocatore
      puntiPerGiocatore[pronostico.giocatore_id] += puntiGiocata;
    }
    log('Aggiornamento singole scommesse completato.');

    // 4. AGGIORNIAMO LA CLASSIFICA GENERALE (Tabella Giocatori)
    log('Ricalcolo classifica generale in corso...');
    const { data: giocatori } = await supabase.from('giocatori').select('id');
    
    for (let giocatore of giocatori) {
      let totale = puntiPerGiocatore[giocatore.id] || 0;
      await supabase.from('giocatori').update({ punteggio_totale: totale }).eq('id', giocatore.id);
    }

    log('✅ TUTTO FATTO! Classifica aggiornata con successo.');
    log('Puoi tornare al sito e controllare i risultati.');

  } catch (error) {
    console.error(error);
    log('❌ ERRORE: ' + error.message);
  } finally {
    // Riattiviamo il bottone
    btnCalcola.disabled = false;
  }
});