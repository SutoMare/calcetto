 // 1. Importiamo la libreria di Supabase tramite CDN (direttamente dal web)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// 2. Inserisci qui i dati del tuo progetto Supabase
// (Li trovi nella Dashboard di Supabase -> Project Settings -> API)
const supabaseUrl = 'https://auvhpajlpydpvbywkbsa.supabase.co';
const supabaseKey = 'sb_publishable_z6rqgJ1khz-8IcdzRWVoqw_7GchvHR3';

// 3. Creiamo il "client" che useremo in tutti gli altri file per parlare col database
export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase inizializzato e pronto all'uso!");


