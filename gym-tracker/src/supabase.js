import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yhjfspfgmqbhxfhipwpn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_niHm-wa-zqT4uZ8w_U668g_cj7AZktT'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
