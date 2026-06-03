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

    for (let pronostico of pronostici) {
      const partita = mappaPartite[pronostico.partita_id];
      
      if (!puntiPerGiocatore[pronostico.giocatore_id]) {
        puntiPerGiocatore[pronostico.giocatore_id] = 0;
      }

      if (!partita) continue;

      let puntiGiocata = 0;

      // 1. GOL e SEGNI
      let pGolCasa = Number(pronostico.gol_casa);
      let pGolTrasf = Number(pronostico.gol_trasferta);
      let rGolCasa = Number(partita.gol_casa);
      let rGolTrasf = Number(partita.gol_trasferta);
      
      let segnoPronostico = pronostico.segno ? pronostico.segno.trim().toUpperCase() : '';
      let segnoReale = partita.segno_reale ? partita.segno_reale.trim().toUpperCase() : '';

      if (segnoPronostico === segnoReale) puntiGiocata += 1;

      let segnoImplicato = 'X';
      if (pGolCasa > pGolTrasf) segnoImplicato = '1';
      else if (pGolCasa < pGolTrasf) segnoImplicato = '2';

      let coerente = (segnoPronostico === segnoImplicato);
      let risultatoEsatto = (pGolCasa === rGolCasa && pGolTrasf === rGolTrasf);

      if (risultatoEsatto && coerente) {
        puntiGiocata += 2;
      }

      let puntiBase = puntiGiocata; 

      // 2. MARCATORI
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

      // --- 🚨 LO SCANNER CORRETTO 🚨 ---
      log(`<span style="color:#17a2b8;">--- PRONOSTICO GIOCATORE ID: ${pronostico.giocatore_id} ---</span>`);
      log(`GOL SCRITTI: <b>${pGolCasa} - ${pGolTrasf}</b> (Segno: ${segnoPronostico})`);
      log(`GOL REALI:  <b>${rGolCasa} - ${rGolTrasf}</b> (Segno: ${segnoReale})`);
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

    const { data: giocatori } = await supabase.from('giocatori').select('id');
    for (let giocatore of giocatori) {
      let totale = puntiPerGiocatore[giocatore.id] || 0;
      await supabase.from('giocatori').update({ punteggio_totale: totale }).eq('id', giocatore.id);
    }
    log('✅ Classifica aggiornata con successo.');

  } catch (error) {
    log('❌ ERRORE: ' + error.message);
  } finally {
    btnCalcola.disabled = false;
  }
});