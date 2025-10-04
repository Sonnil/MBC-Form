// Auto-configuration for FLEX-FORM User Portal
// SECURITY: This file contains sensitive configuration
// DO NOT commit actual API keys to version control

window.FLEXFORM_CONFIG = {
    // Replace with your actual Supabase URL
    SUPABASE_URL: 'https://rctzljfqsafjmbljeyrb.supabase.co',
    
    // Replace with your actual ANON/PUBLIC key from Supabase Dashboard > Settings > API
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjdHpsamZxc2Fmam1ibGpleXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTY5NDAsImV4cCI6MjA3NTA5Mjk0MH0.cwIecLyT7z3eQhUl0HWimrWZUDCkO6-jSdxO8xBLcuc',
    
    // Optional: Service key for admin operations (DO NOT expose in browser)
    // SUPABASE_SERVICE_KEY: 'your-service-key-here', // Only for server-side usage
    
    AUTO_CONNECT: true,
    DEFAULT_USER: {
        email: 'user@company.com',
        department: 'general'
    }
};

// Instructions:
// 1. Go to your Supabase dashboard: https://supabase.com/dashboard
// 2. Select your project
// 3. Go to Settings > API
// 4. Copy your Project URL to SUPABASE_URL
// 5. Copy your anon/public key to SUPABASE_ANON_KEY
// 6. Save this file (do not commit real keys to git)
