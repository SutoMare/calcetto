import { supabase } from './config.js';

const btnCalcola = document.getElementById('btn-calcola');
const logArea = document.getElementById('log-area');

function log(messaggio) {
  logArea.innerHTML += `> ${messaggio}<br>`;
}

// --- INTERVALLO DEL TURNO ATTUALMENTE IN CORSO ---
// Le partite con data_orario al di fuori di questo intervallo appartengono a
// un turno già concluso (i cui punti sono stati congelati a mano in una delle
// colonne dedicate: r16_score, r8_score, r4_score, final_score) o
// a un turno futuro non ancora iniziato, e vanno quindi ignorate nel calcolo
// del punteggio del turno corrente.
// Aggiorna queste due date a mano a ogni cambio di turno.
const INIZIO_TURNO_CORRENTE = new Date(2026, 6, 4, 12, 0);  // placeholder
const FINE_TURNO_CORRENTE   = new Date(2026, 6, 8, 23, 59); // placeholder

// --- COLONNA DEL TURNO ATTUALMENTE IN CORSO ---
// Deve essere una tra: 'r16_score', 'r8_score', 'r4_score', 'final_score'.
// È la colonna in cui viene scritto il punteggio live (non diviso) delle
// partite che cadono nell'intervallo di date qui sopra. Aggiornala a mano
// insieme alle due date ogni volta che si passa al turno successivo: il
// valore lasciato nella colonna del turno precedente resta così "congelato".
const COLONNA_TURNO_CORRENTE = 'r8_score'; // placeholder

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

btnCalcola.addEventListener('click', async () => {
  btnCalcola.disabled = true;
  logArea.innerHTML = '> INIZIO CALCOLO PUNTEGGI...<br>';

  try {
    const { data: partiteFiniteRaw, error: errPartite } = await supabase.from('partite').select('*').eq('finita', true);
    if (errPartite) throw errPartite;

    // Consideriamo solo le partite del turno corrente: quelle di turni
    // precedenti sono già congelate a mano nelle colonne dedicate, quelle di
    // turni futuri non devono ancora contare.
    const partiteFinite = partiteFiniteRaw.filter(p => {
      const d = convertiInDataJS(p.data_orario);
      return d >= INIZIO_TURNO_CORRENTE && d <= FINE_TURNO_CORRENTE;
    });
    const partiteEscluse = partiteFiniteRaw.length - partiteFinite.length;
    if (partiteEscluse > 0) {
      log(`ℹ️ Ignorate ${partiteEscluse} partite fuori dall'intervallo del turno corrente (già congelate o non ancora in corso).`);
    }

    const mappaPartite = {};
    partiteFinite.forEach(p => mappaPartite[p.id] = p);

    const { data: pronostici, error: errPronostici } = await supabase.from('pronostici').select('*');
    if (errPronostici) throw errPronostici;

    const puntiPerGiocatore = {}; 

    for (let pronostico of pronostici) {
      const partita = mappaPartite[pronostico.partita_id];
      
      if (!puntiPerGiocatore[pronostico.giocatore_id]) {
        puntiPerGiocatore[pronostico.giocatore_id] = 0;
      }

      if (!partita) continue;

      // --- REGOLA 0: PRONOSTICO FUORI TEMPO MASSIMO ---
      // Se il pronostico è stato salvato quando la partita era già iniziata
      // (o comunque dopo l'orario di inizio), non deve valere nulla.
      const orarioPartita = convertiInDataJS(partita.data_orario);
      const orarioPronostico = pronostico.created_at ? new Date(pronostico.created_at) : null;

      if (orarioPronostico && orarioPronostico >= orarioPartita) {
        log(`<span style="color:#e74c3c;">--- PRONOSTICO GIOCATORE ID: ${pronostico.giocatore_id} ---</span>`);
        log(`⛔ Pronostico inviato alle ${orarioPronostico.toLocaleString('it-IT')}, ma la partita iniziava alle ${orarioPartita.toLocaleString('it-IT')} → 0 punti (fuori tempo massimo).`);
        log(`--------------------------`);

        await supabase.from('pronostici').update({ punti_guadagnati: 0 }).eq('giocatore_id', pronostico.giocatore_id).eq('partita_id', pronostico.partita_id);
        continue;
      }

      let puntiGiocata = 0;

      // 1. GOL e SEGNI
      let pGolCasa = Number(pronostico.gol_casa);
      let pGolTrasf = Number(pronostico.gol_trasferta);
      let rGolCasa = Number(partita.gol_casa);
      let rGolTrasf = Number(partita.gol_trasferta);
      
      let segnoPronostico = pronostico.segno ? pronostico.segno.trim().toUpperCase() : '';
      let segnoReale = partita.segno_reale ? partita.segno_reale.trim().toUpperCase() : '';

      // --- REGOLA 1: SEGNO ESATTO ---
      if (segnoPronostico === segnoReale) puntiGiocata += 1;

      // --- REGOLA 2: RISULTATO E COERENZA (Mondiale No-Pareggio) ---
      let coerente = false;
      
      if (pGolCasa > pGolTrasf && segnoPronostico === '1') {
        coerente = true; // Vittoria in casa
      } else if (pGolCasa < pGolTrasf && segnoPronostico === '2') {
        coerente = true; // Vittoria in trasferta
      } else if (pGolCasa === pGolTrasf && (segnoPronostico === '1' || segnoPronostico === '2')) {
        coerente = true; // Pareggio ai supplementari, ma il segno indica chi vince ai rigori!
      }

      let risultatoEsatto = (pGolCasa === rGolCasa && pGolTrasf === rGolTrasf);

      // Assegna il +2 solo se ha beccato i gol E la logica ha senso
      if (risultatoEsatto && coerente) {
        puntiGiocata += 2;
      }

      let puntiBase = puntiGiocata; 

      // --- REGOLA 3: MARCATORI ---
      let predMarcatori = pronostico.marcatori ? pronostico.marcatori.split(',').map(m => m.trim().toLowerCase()).filter(m => m !== '') : [];
      let realiMarcatori = partita.marcatori_reali ? partita.marcatori_reali.toLowerCase() : "";
      
      let puntiMarcatori = 0;
      let tuttiAzzeccati = false;

      if (predMarcatori.length > 0) {
        tuttiAzzeccati = true;
        for (let marcatore of predMarcatori) {
          if (!realiMarcatori.includes(marcatore)) {
            tuttiAzzeccati = false; break; 
          }
        }
        if (tuttiAzzeccati) {
          for (let i = 0; i < predMarcatori.length; i++) puntiMarcatori += (i + 2); 
        }
      }
      
      puntiGiocata += puntiMarcatori; 

      // --- LO SCANNER ---
      log(`<span style="color:#17a2b8;">--- PRONOSTICO GIOCATORE ID: ${pronostico.giocatore_id} ---</span>`);
      log(`GOL SCRITTI: <b>${pGolCasa} - ${pGolTrasf}</b> (Segno: ${segnoPronostico})`);
      log(`GOL REALI:  <b>${rGolCasa} - ${rGolTrasf}</b> (Segno: ${segnoReale})`);
      log(`> Coerente? <b>${coerente ? 'SI' : 'NO'}</b>`);
      log(`> Punti ottenuti da Segno+Risultato: <b>${puntiBase}</b>`);
      log(`MARCATORI SCRITTI: <b>${predMarcatori.length > 0 ? predMarcatori.join(', ') : 'Nessuno'}</b>`);
      log(`MARCATORI REALI: <b>${realiMarcatori || 'Nessuno'}</b>`);
      log(`> Punti ottenuti dai Marcatori: <b>${puntiMarcatori}</b>`);
      log(`<b>PUNTI TOTALI ASSEGNATI: ${puntiGiocata}</b>`);
      log(`--------------------------`);

      // 3. Salvataggio
      await supabase.from('pronostici').update({ punti_guadagnati: puntiGiocata }).eq('giocatore_id', pronostico.giocatore_id).eq('partita_id', pronostico.partita_id);

      puntiPerGiocatore[pronostico.giocatore_id] += puntiGiocata;
    }

    // puntiPerGiocatore contiene, a questo punto, il punteggio del SOLO
    // turno corrente (non diviso). Questo valore va scritto direttamente
    // nella colonna del turno attivo (COLONNA_TURNO_CORRENTE), sovrascrivendo
    // quanto c'era prima: è il modo in cui il punteggio del turno in corso
    // resta sempre aggiornato finché non si passa al turno successivo.
    const { data: giocatori, error: errGiocatori } = await supabase
      .from('giocatori')
      .select('id, r16_score, r8_score, r4_score, final_score');
    if (errGiocatori) throw errGiocatori;

    for (let giocatore of giocatori) {
      // --- PUNTEGGIO TURNO CORRENTE (visibile, non diviso) ---
      let puntiTurnoCorrente = puntiPerGiocatore[giocatore.id] || 0;

      // Valori grezzi delle 4 colonne, con quella del turno corrente
      // sovrascritta dal valore live appena calcolato.
      let raw = {
        r16_score: Number(giocatore.r16_score) || 0,
        r8_score: Number(giocatore.r8_score) || 0,
        r4_score: Number(giocatore.r4_score) || 0,
        final_score: Number(giocatore.final_score) || 0,
      };
      raw[COLONNA_TURNO_CORRENTE] = puntiTurnoCorrente;

      // --- PUNTEGGIO TOTALE ---
      // Nota: se un punteggio di turno è 0 (o non ancora impostato), la
      // divisione non crea alcun problema: 0 diviso per qualsiasi cosa resta 0.
      let puntiTotali = (raw.r16_score / 4) + (raw.r8_score / 2) + raw.r4_score + (raw.final_score * 2);

      await supabase.from('giocatori').update({
        [COLONNA_TURNO_CORRENTE]: puntiTurnoCorrente,
        punteggio_totale: puntiTotali
      }).eq('id', giocatore.id);

      log(`Giocatore ID ${giocatore.id}: ${COLONNA_TURNO_CORRENTE} (turno corrente) = ${puntiTurnoCorrente} | totale = ${puntiTotali}`);
    }
    log('✅ Classifica aggiornata con successo.');

  } catch (error) {
    log('❌ ERRORE: ' + error.message);
  } finally {
    btnCalcola.disabled = false;
  }
});