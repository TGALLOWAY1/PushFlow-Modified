/**
 * Supabase Client.
 *
 * Singleton Supabase client for persistent storage.
 * Uses the project's anon key for anonymous access.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://igqlnqcmmysccxbaodri.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlncWxucWNtbXlzY2N4YmFvZHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjc3NzIsImV4cCI6MjA4ODg0Mzc3Mn0.QU19kB4F0V_EqvMJ2vaEPWKCeVHd_mBsiuPWb_ksN54';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
