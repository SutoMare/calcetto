// Importiamo la connessione a Supabase dal file config.js
import { supabase } from './config.js';

// Selezioniamo gli elementi della pagina che ci servono
const loginForm = document.getElementById('login-form');
const userSelect = document.getElementById('user-select');
const passwordInput = document.getElementById('password-input');
const errorMessage = document.getElementById('error-message');

// Cosa succede quando premiamo "Entra nel Torneo"
loginForm.addEventListener('submit', async function(event) {
  event.preventDefault(); // Evita che la pagina si aggiorni da sola

  // Prendiamo i valori inseriti dall'utente
  const nomeScelto = userSelect.value;
  const passwordInserita = passwordInput.value;

  // Nascondiamo il messaggio di errore (nel caso fosse visibile da un tentativo precedente)
  errorMessage.style.display = 'none';

  try {
    // 1. Chiediamo a Supabase di cercare l'utente
    // Traduzione: "Dalla tabella giocatori, seleziona tutto (*) dove il nome è uguale a nomeScelto E la password è uguale a passwordInserita"
    const { data, error } = await supabase
      .from('giocatori')
      .select('*')
      // Assicurati che i nomi scritti nel value dell'HTML combacino perfettamente (maiuscole/minuscole) con la colonna 'nome' su Supabase
      .eq('nome', nomeScelto) 
      .eq('password', passwordInserita);

    if (error) {
      throw error;
    }

    // 2. Verifichiamo il risultato
    if (data && data.length > 0) {
      // LOGIN AVVENUTO CON SUCCESSO!
      console.log("Accesso consentito a:", nomeScelto);
      
      // Salviamo il nome nel "localStorage" del browser.
      // Così la pagina pronostico.html saprà chi siamo senza chiederlo di nuovo.
      localStorage.setItem('utenteLoggato', nomeScelto);
      
      // Ti porto alla pagina dei pronostici
      window.location.href = 'pronostico.html';
      
    } else {
      // LOGIN FALLITO (Nessuna riga trovata con quel nome + password)
      errorMessage.textContent = 'Password errata, riprova!';
      errorMessage.style.display = 'block';
    }

  } catch (error) {
    console.error("Errore di connessione a Supabase:", error.message);
    errorMessage.textContent = 'Errore di connessione. Riprova più tardi.';
    errorMessage.style.display = 'block';
  }
});