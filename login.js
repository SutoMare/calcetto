// Importiamo la connessione a Supabase dal file config.js
import { supabase } from './config.js';

// Selezioniamo gli elementi della pagina che ci servono
const loginForm = document.getElementById('login-form');
const userSelect = document.getElementById('user-select');
const passwordInput = document.getElementById('password-input');
const errorMessage = document.getElementById('error-message');

// --- 1. NUOVA FUNZIONE: CARICAMENTO DINAMICO DEI GIOCATORI ---
async function caricaGiocatori() {
  try {
    // Chiediamo a Supabase tutti i nomi dalla tabella giocatori, in ordine alfabetico
    const { data: giocatori, error } = await supabase
      .from('giocatori')
      .select('nome')
      .order('nome', { ascending: true });

    if (error) throw error;

    // Svuotiamo il menu a tendina e inseriamo l'opzione iniziale
    userSelect.innerHTML = '<option value="" disabled selected>Seleziona chi sei...</option>';

    if (!giocatori || giocatori.length === 0) {
      const option = document.createElement('option');
      option.disabled = true;
      option.textContent = "Nessun giocatore trovato nel DB";
      userSelect.appendChild(option);
      return;
    }

    // Inseriamo dinamicamente un'opzione per ogni giocatore trovato nel database
    giocatori.forEach(giocatore => {
      const option = document.createElement('option');
      option.value = giocatore.nome; // Deve combaciare esattamente con il nome nel database!
      // Mettiamo la prima lettera maiuscola per estetica
      option.textContent = giocatore.nome.charAt(0).toUpperCase() + giocatore.nome.slice(1); 
      userSelect.appendChild(option);
    });

  } catch (error) {
    console.error("Errore nel caricamento dei giocatori:", error.message);
    userSelect.innerHTML = '<option value="" disabled selected>Errore di connessione</option>';
  }
}

// Facciamo partire il caricamento dei giocatori appena la pagina si apre
caricaGiocatori();


// --- 2. LOGICA DEL LOGIN ---
loginForm.addEventListener('submit', async function(event) {
  event.preventDefault(); // Evita che la pagina si aggiorni da sola

  // Prendiamo i valori inseriti dall'utente
  const nomeScelto = userSelect.value;
  const passwordInserita = passwordInput.value;

  // Nascondiamo il messaggio di errore
  errorMessage.style.display = 'none';

  try {
    // Chiediamo a Supabase di cercare l'utente
    const { data, error } = await supabase
      .from('giocatori')
      .select('*')
      .eq('nome', nomeScelto) 
      .eq('password', passwordInserita);

    if (error) {
      throw error;
    }

    // Verifichiamo il risultato
    if (data && data.length > 0) {
      // LOGIN AVVENUTO CON SUCCESSO
      console.log("Accesso consentito a:", nomeScelto);
      
      // Salviamo il nome nel browser
      localStorage.setItem('utenteLoggato', nomeScelto);
      
      // Ti porto alla pagina dei pronostici
      window.location.href = 'pronostico.html';
      
    } else {
      // LOGIN FALLITO
      errorMessage.textContent = 'Password errata, riprova!';
      errorMessage.style.display = 'block';
    }

  } catch (error) {
    console.error("Errore di connessione a Supabase:", error.message);
    errorMessage.textContent = 'Errore di connessione. Riprova più tardi.';
    errorMessage.style.display = 'block';
  }
});