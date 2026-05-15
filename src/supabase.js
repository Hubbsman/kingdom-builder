import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://kkmkfkcrpotenbjeluga.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbWtma2NycG90ZW5iamVsdWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODQ3NDcsImV4cCI6MjA5NDM2MDc0N30._XIeH9pIGlsdL1j2D_wrQkJF-w01P7Mfq1ED4kOiN4M"
);
