import { supabase } from './config.js';

const btnCalcola = document.getElementById('btn-calcola');
const logArea = document.getElementById('log-area');

function log(messaggio) {
  logArea.innerHTML += `> ${messaggio}<br>`;
}

btnCalcola.addEventListener('click', async () => {
  btnCalcola.disabled = true;
  logArea.innerHTML = '> INIZIO CALCOLO PUNTEGGI...<br>';

  try {
    const { data: partiteFinite, error: errPartite } = await supabase.from('partite').select('*').eq('finita', true);
    if (errPartite) throw errPartite;
    
    const mappaPartite = {};
    partiteFinite.forEach(p => mappaPartite[p.id] = p);

    const { data: pronostici, error: errPronostici } = await supabase.from('pronostici').select('*');
    if (errPronostici) throw errPronostici;

    const puntiPerGiocatore = {}; 
    log(`Trovate ${partiteFinite.length} partite concluse e ${pronostici.length} pronostici nel DB.`);

    for (let pronostico of pronostici) {
      const partita = mappaPartite[pronostico.partita_id];
      
      if (!puntiPerGiocatore[pronostico.giocatore_id]) {
        puntiPerGiocatore[pronostico.giocatore_id] = 0;
      }

      if (!partita) continue;

      let puntiGiocata = 0;

      // --- 🛡️ SISTEMA ANTI-BUG SUI TIPI DI DATO ---
      // Forziamo i gol a essere Numeri (risolve il problema Testo vs Numero di Supabase)
      let pGolCasa = Number(pronostico.gol_casa);
      let pGolTrasf = Number(pronostico.gol_trasferta);
      let rGolCasa = Number(partita.gol_casa);
      let rGolTrasf = Number(partita.gol_trasferta);
      
      // Puliamo i segni da spazi invisibili e li facciamo sempre MAIUSCOLI (es. 'x' diventa 'X')
      let segnoPronostico = pronostico.segno ? pronostico.segno.trim().toUpperCase() : '';
      let segnoReale = partita.segno_reale ? partita.segno_reale.trim().toUpperCase() : '';

      // ----------------------------------------------------
      // REGOLA 1: SEGNO ESATTO (+1 pt)
      // ----------------------------------------------------
      if (segnoPronostico === segnoReale) {
        puntiGiocata += 1;
      }

      // ----------------------------------------------------
      // REGOLA 2: RISULTATO ESATTO (+2 pt) E COERENZA
      // ----------------------------------------------------
      // Che segno implicava il punteggio inserito dall'utente?
      let segnoImplicato = 'X';
      if (pGolCasa > pGolTrasf) segnoImplicato = '1';
      else if (pGolCasa < pGolTrasf) segnoImplicato = '2';

      let coerente = (segnoPronostico === segnoImplicato);
      let risultatoEsatto = (pGolCasa === rGolCasa && pGolTrasf === rGolTrasf);

      if (risultatoEsatto && coerente) {
        puntiGiocata += 2;
      }

      // ----------------------------------------------------
      // REGOLA 3: MARCATORI (TUTTO O NIENTE: +2, +3, +4...)
      // ----------------------------------------------------
      let predMarcatori = pronostico.marcatori ? pronostico.marcatori.split(',').map(m => m.trim().toLowerCase()).filter(m => m !== '') : [];
      let realiMarcatori = partita.marcatori_reali ? partita.marcatori_reali.toLowerCase() : "";

      if (predMarcatori.length > 0) {
        let tuttiAzzeccati = true;
        for (let marcatore of predMarcatori) {
          if (!realiMarcatori.includes(marcatore)) {
            tuttiAzzeccati = false;
            break; 
          }
        }

        if (tuttiAzzeccati) {
          for (let i = 0; i < predMarcatori.length; i++) {
            puntiGiocata += (i + 2); 
          }
        }
      }

      // ----------------------------------------------------
      // SALVATAGGIO IN SUPABASE
      // ----------------------------------------------------
      await supabase
        .from('pronostici')
        .update({ punti_guadagnati: puntiGiocata })
        .eq('giocatore_id', pronostico.giocatore_id)
        .eq('partita_id', pronostico.partita_id);

      puntiPerGiocatore[pronostico.giocatore_id] += puntiGiocata;
    }
    log('Aggiornamento singole scommesse completato.');

    // Ricalcolo classifica generale
    log('Ricalcolo classifica generale in corso...');
    const { data: giocatori } = await supabase.from('giocatori').select('id');
    
    for (let giocatore of giocatori) {
      let totale = puntiPerGiocatore[giocatore.id] || 0;
      await supabase.from('giocatori').update({ punteggio_totale: totale }).eq('id', giocatore.id);
    }

    log('✅ TUTTO FATTO! Classifica aggiornata con successo.');

  } catch (error) {
    console.error(error);
    log('❌ ERRORE: ' + error.message);
  } finally {
    btnCalcola.disabled = false;
  }
});