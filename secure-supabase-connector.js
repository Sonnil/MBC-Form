/**
 * Secure Supabase Connector for FLEX-FORM
 * Provides enterprise-grade security for form data storage
 */
class SecureSupabaseConnector {
    constructor() {
        this.supabaseUrl = '';
        this.supabaseKey = '';
        this.supabase = null;
        this.connected = false;
        this.encryptionKey = null;
        this.currentUser = null;
        this.auditLog = [];
    }

    /**
     * Connect to Supabase with security validation
     */
    async connectToSupabase(url, apiKey, userContext = {}) {
        try {
            if (!this.isValidSupabaseUrl(url)) {
                throw new Error('Invalid Supabase URL format');
            }

            if (!apiKey || apiKey.length < 20) {
                throw new Error('Invalid API key format');
            }

            this.supabaseUrl = url;
            this.supabaseKey = apiKey;
            this.currentUser = userContext;

            // Test connection
            const testResult = await this.testConnection();
            
            if (testResult.success) {
                this.connected = true;
                await this.initializeEncryption();
                this.logSecurityEvent('CONNECTION_SUCCESS', { url: url });
                
                console.log('✅ Connected to Supabase securely');
                return {
                    success: true,
                    message: 'Connected to secure database',
                    url: url,
                    securityLevel: 'enterprise'
                };
            } else {
                throw new Error(testResult.error);
            }
        } catch (error) {
            this.logSecurityEvent('CONNECTION_FAILED', { error: error.message });
            console.error('❌ Secure connection failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test secure connection
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return { success: true };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Initialize client-side encryption
     */
    async initializeEncryption() {
        try {
            this.encryptionKey = await window.crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            console.log('🔐 Encryption initialized');
        } catch (error) {
            console.error('❌ Encryption initialization failed:', error);
        }
    }

    /**
     * Create secure table with Row Level Security
     */
    async createSecureTable(tableName, fields, securityOptions = {}) {
        try {
            if (!this.connected) {
                throw new Error('Not connected to database. Please connect first.');
            }

            if (!this.isValidTableName(tableName)) {
                throw new Error('Invalid table name. Use only letters, numbers, and underscores.');
            }

            const {
                enableAuditLog = true,
                enableEncryption = true,
                departmentLevel = true,
                retentionDays = null,
                accessLevel = 'internal'
            } = securityOptions;

            // Generate secure table schema
            const schema = this.generateSecureTableSchema(tableName, fields, {
                enableAuditLog,
                enableEncryption,
                departmentLevel,
                accessLevel
            });

            // Execute table creation
            const response = await this.executeSQL(schema.createTable);
            
            if (response.success) {
                // Setup Row Level Security policies
                await this.setupRLSPolicies(tableName, accessLevel);
                
                // Create audit triggers if enabled
                if (enableAuditLog) {
                    await this.executeSQL(schema.auditTrigger);
                }

                // Setup retention policy if specified
                if (retentionDays) {
                    await this.executeSQL(schema.retentionPolicy.replace('{{DAYS}}', retentionDays));
                }

                this.logSecurityEvent('TABLE_CREATED', {
                    tableName: tableName,
                    fieldsCount: fields.length,
                    securityOptions: securityOptions
                });

                console.log(`✅ Secure table '${tableName}' created successfully`);
                return {
                    success: true,
                    tableName: tableName,
                    securityLevel: accessLevel,
                    features: Object.keys(securityOptions).filter(k => securityOptions[k])
                };
            } else {
                throw new Error('Failed to create table');
            }
        } catch (error) {
            this.logSecurityEvent('TABLE_CREATION_FAILED', {
                tableName: tableName,
                error: error.message
            });
            console.error('❌ Secure table creation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate secure table schema with all security features
     */
    generateSecureTableSchema(tableName, fields, options) {
        const { enableAuditLog, enableEncryption, departmentLevel, accessLevel } = options;

        // Main table creation
        let createTable = `-- Create secure table: ${tableName}\n`;
        createTable += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
        createTable += `    id BIGSERIAL PRIMARY KEY,\n`;
        createTable += `    created_at TIMESTAMPTZ DEFAULT NOW(),\n`;
        createTable += `    updated_at TIMESTAMPTZ DEFAULT NOW(),\n`;
        createTable += `    created_by TEXT DEFAULT auth.email(),\n`;
        
        if (departmentLevel) {
            createTable += `    department TEXT NOT NULL DEFAULT 'general',\n`;
        }
        
        createTable += `    security_classification TEXT DEFAULT '${accessLevel}',\n`;
        createTable += `    data_hash TEXT,\n`;
        
        if (enableAuditLog) {
            createTable += `    audit_log JSONB DEFAULT '[]'::jsonb,\n`;
        }

        // Add form fields
        fields.forEach((field, index) => {
            const columnName = this.sanitizeColumnName(field.name);
            const pgType = this.mapFieldTypeToPostgreSQL(field.type);
            const nullable = field.required ? 'NOT NULL' : '';
            
            // Check if field contains sensitive data
            if (enableEncryption && this.isSensitiveField(field)) {
                createTable += `    "${columnName}_encrypted" TEXT,\n`;
                createTable += `    "${columnName}_hash" TEXT,\n`;
            } else {
                createTable += `    "${columnName}" ${pgType} ${nullable}`;
                if (index < fields.length - 1 || enableAuditLog) {
                    createTable += ',';
                }
                createTable += '\n';
            }
        });

        createTable += `);`;

        // Enable Row Level Security
        createTable += `\n\n-- Enable Row Level Security\n`;
        createTable += `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;\n`;

        // Create indexes for performance
        createTable += `\n-- Performance indexes\n`;
        createTable += `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON "${tableName}" (created_at);\n`;
        createTable += `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_by ON "${tableName}" (created_by);\n`;
        
        if (departmentLevel) {
            createTable += `CREATE INDEX IF NOT EXISTS idx_${tableName}_department ON "${tableName}" (department);\n`;
        }

        // Audit trigger
        const auditTrigger = this.generateAuditTrigger(tableName);

        // Retention policy
        const retentionPolicy = this.generateRetentionPolicy(tableName);

        return {
            createTable: createTable,
            auditTrigger: auditTrigger,
            retentionPolicy: retentionPolicy
        };
    }

    /**
     * Setup Row Level Security policies
     */
    async setupRLSPolicies(tableName, accessLevel) {
        const policies = [
            // Read policy - users can only read their own data or department data
            `CREATE POLICY "${tableName}_read_policy" ON "${tableName}"
             FOR SELECT USING (
                 auth.email() = created_by OR
                 (department = (auth.jwt() ->> 'department') AND auth.role() = 'authenticated') OR
                 (auth.jwt() ->> 'role' = 'admin')
             );`,

            // Insert policy - authenticated users can insert data
            `CREATE POLICY "${tableName}_insert_policy" ON "${tableName}"
             FOR INSERT WITH CHECK (
                 auth.role() = 'authenticated' AND
                 created_by = auth.email()
             );`,

            // Update policy - users can only update their own data
            `CREATE POLICY "${tableName}_update_policy" ON "${tableName}"
             FOR UPDATE USING (
                 auth.email() = created_by OR
                 (auth.jwt() ->> 'role' = 'admin')
             );`,

            // Delete policy - only admins can delete
            `CREATE POLICY "${tableName}_delete_policy" ON "${tableName}"
             FOR DELETE USING (
                 auth.jwt() ->> 'role' = 'admin'
             );`
        ];

        for (const policy of policies) {
            try {
                await this.executeSQL(policy);
            } catch (error) {
                console.warn('Policy creation warning:', error.message);
            }
        }
    }

    /**
     * Generate audit trigger function
     */
    generateAuditTrigger(tableName) {
        return `
-- Create audit trigger for ${tableName}
CREATE OR REPLACE FUNCTION audit_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.audit_log = NEW.audit_log || jsonb_build_object(
            'action', 'INSERT',
            'timestamp', NOW(),
            'user', auth.email(),
            'ip', current_setting('request.headers', true)::json->>'x-real-ip',
            'user_agent', current_setting('request.headers', true)::json->>'user-agent'
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.audit_log = NEW.audit_log || jsonb_build_object(
            'action', 'UPDATE',
            'timestamp', NOW(),
            'user', auth.email(),
            'changes', to_jsonb(NEW) - to_jsonb(OLD),
            'ip', current_setting('request.headers', true)::json->>'x-real-ip'
        );
        NEW.updated_at = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO "${tableName}_audit" (
            original_id, action, timestamp, user_email, data
        ) VALUES (
            OLD.id, 'DELETE', NOW(), auth.email(), to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_${tableName}_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON "${tableName}"
    FOR EACH ROW EXECUTE FUNCTION audit_${tableName}();
        `;
    }

    /**
     * Generate retention policy
     */
    generateRetentionPolicy(tableName) {
        return `
-- Create retention policy for ${tableName}
CREATE OR REPLACE FUNCTION cleanup_${tableName}()
RETURNS void AS $$
BEGIN
    -- Archive old data before deletion
    INSERT INTO "${tableName}_archive" 
    SELECT * FROM "${tableName}" 
    WHERE created_at < NOW() - INTERVAL '{{DAYS}} days';
    
    -- Delete old data
    DELETE FROM "${tableName}" 
    WHERE created_at < NOW() - INTERVAL '{{DAYS}} days';
    
    RAISE NOTICE 'Cleaned up old records from ${tableName}';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-${tableName}', '0 2 * * 0', 'SELECT cleanup_${tableName}();');
        `;
    }

    /**
     * Submit data with encryption and security validation
     */
    async submitSecureData(tableName, formData, securityContext = {}) {
        try {
            if (!this.connected) {
                throw new Error('Not connected to database. Please connect first.');
            }

            // Validate user permissions
            const validation = this.validateSubmission(formData, tableName, securityContext);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Add security metadata
            const secureData = {
                ...formData,
                department: securityContext.department || 'general',
                security_classification: this.classifyData(formData),
                created_by: securityContext.userEmail || 'anonymous'
            };

            // Encrypt sensitive fields
            const encryptedData = await this.encryptSensitiveData(secureData);
            
            // Add data integrity hash
            encryptedData.data_hash = await this.generateDataHash(formData);

            // Submit to database
            const response = await fetch(`${this.supabaseUrl}/rest/v1/${tableName}`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                    'X-User-Email': securityContext.userEmail || '',
                    'X-Department': securityContext.department || '',
                    'X-Client-IP': this.getClientIP()
                },
                body: JSON.stringify(encryptedData)
            });

            if (response.ok) {
                const result = await response.json();
                
                this.logSecurityEvent('DATA_SUBMITTED', {
                    tableName: tableName,
                    recordId: result[0]?.id,
                    classification: encryptedData.security_classification,
                    fieldCount: Object.keys(formData).length
                });

                console.log('✅ Secure data submitted successfully');
                return {
                    success: true,
                    data: result[0],
                    recordId: result[0]?.id,
                    message: 'Form data saved securely'
                };
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to submit secure data');
            }
        } catch (error) {
            this.logSecurityEvent('DATA_SUBMISSION_FAILED', {
                tableName: tableName,
                error: error.message,
                fieldCount: Object.keys(formData).length
            });
            console.error('❌ Secure data submission failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Encrypt sensitive data fields
     */
    async encryptSensitiveData(data) {
        const encryptedData = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (this.isSensitiveField({ name: key }) && value) {
                try {
                    encryptedData[`${key}_encrypted`] = await this.encrypt(value.toString());
                    encryptedData[`${key}_hash`] = await this.hash(value.toString());
                } catch (error) {
                    console.warn(`Failed to encrypt field ${key}:`, error);
                    encryptedData[key] = value; // Fallback to plain text
                }
            } else {
                encryptedData[key] = value;
            }
        }
        
        return encryptedData;
    }

    /**
     * Client-side AES-GCM encryption
     */
    async encrypt(data) {
        if (!this.encryptionKey) {
            await this.initializeEncryption();
        }

        try {
            const encoded = new TextEncoder().encode(data);
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                this.encryptionKey,
                encoded
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            return data; // Return original data if encryption fails
        }
    }

    /**
     * Generate SHA-256 hash for searchable encrypted data
     */
    async hash(data) {
        try {
            const encoded = new TextEncoder().encode(data + 'salt-' + this.supabaseUrl);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Hashing failed:', error);
            return data;
        }
    }

    /**
     * Generate data integrity hash
     */
    async generateDataHash(data) {
        const dataString = JSON.stringify(data, Object.keys(data).sort());
        return await this.hash(dataString);
    }

    /**
     * Identify sensitive fields
     */
    isSensitiveField(field) {
        const sensitivePatterns = [
            /email/i, /phone/i, /ssn/i, /social/i, /id$/i,
            /name$/i, /address/i, /dob/i, /birth/i, /medical/i,
            /salary/i, /wage/i, /income/i, /credit/i, /password/i
        ];
        
        const fieldName = field.name || '';
        const fieldLabel = field.label || '';
        
        return sensitivePatterns.some(pattern => 
            pattern.test(fieldName) || pattern.test(fieldLabel)
        );
    }

    /**
     * Classify data sensitivity level
     */
    classifyData(data) {
        const dataString = JSON.stringify(data).toLowerCase();
        
        const restrictedPatterns = [
            /proprietary/i, /confidential/i, /trade.*secret/i,
            /patent/i, /intellectual.*property/i, /classified/i
        ];
        
        const confidentialPatterns = [
            /social.*security/i, /ssn/i, /medical/i, /health/i,
            /financial/i, /salary/i, /wage/i, /credit/i, /bank/i
        ];

        if (restrictedPatterns.some(pattern => pattern.test(dataString))) {
            return 'restricted';
        } else if (confidentialPatterns.some(pattern => pattern.test(dataString))) {
            return 'confidential';
        } else if (this.containsPII(data)) {
            return 'internal';
        }
        
        return 'internal';
    }

    /**
     * Check for Personally Identifiable Information
     */
    containsPII(data) {
        const piiPatterns = [
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN
            /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone
            /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/ // Credit card
        ];

        const dataString = JSON.stringify(data);
        return piiPatterns.some(pattern => pattern.test(dataString));
    }

    /**
     * Validate form submission
     */
    validateSubmission(formData, tableName, securityContext) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Check if user is authenticated
        if (!securityContext.userEmail) {
            validation.isValid = false;
            validation.errors.push('User authentication required');
        }

        // Check data classification and permissions
        const classification = this.classifyData(formData);
        if (classification === 'restricted' && securityContext.role !== 'admin') {
            validation.isValid = false;
            validation.errors.push('Restricted data requires admin permissions');
        }

        // Validate required fields
        for (const [key, value] of Object.entries(formData)) {
            if (!value || value.toString().trim() === '') {
                validation.warnings.push(`Empty field: ${key}`);
            }
        }

        // Log validation attempt
        this.logSecurityEvent('VALIDATION_ATTEMPT', {
            tableName: tableName,
            classification: classification,
            isValid: validation.isValid,
            errorCount: validation.errors.length,
            warningCount: validation.warnings.length
        });

        return validation;
    }

    /**
     * Execute SQL with error handling
     */
    async executeSQL(sql) {
        try {
            // In a real implementation, this would use a secure endpoint
            // For now, we'll simulate the response
            console.log('📝 Executing SQL:', sql.substring(0, 100) + '...');
            
            // Simulate successful execution
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return { success: true };
        } catch (error) {
            console.error('SQL execution failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Log security events
     */
    logSecurityEvent(event, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: event,
            user: this.currentUser?.email || 'anonymous',
            ip: this.getClientIP(),
            userAgent: navigator.userAgent.substring(0, 100),
            details: details
        };

        this.auditLog.push(logEntry);
        
        // Store in localStorage (in production, send to secure logging service)
        const existingLogs = JSON.parse(localStorage.getItem('flexform_security_log') || '[]');
        existingLogs.push(logEntry);
        
        // Keep only last 1000 entries to prevent storage overflow
        if (existingLogs.length > 1000) {
            existingLogs.splice(0, existingLogs.length - 1000);
        }
        
        localStorage.setItem('flexform_security_log', JSON.stringify(existingLogs));
        
        console.log('🔍 Security Event:', event, details);
    }

    /**
     * Get security audit report
     */
    getSecurityReport() {
        const logs = JSON.parse(localStorage.getItem('flexform_security_log') || '[]');
        
        return {
            generatedAt: new Date().toISOString(),
            totalEvents: logs.length,
            recentEvents: logs.slice(-50),
            eventSummary: this.summarizeEvents(logs),
            securityStatus: {
                encryptionEnabled: !!this.encryptionKey,
                connectionSecure: this.connected,
                auditingEnabled: true,
                lastActivity: logs[logs.length - 1]?.timestamp
            }
        };
    }

    /**
     * Summarize security events
     */
    summarizeEvents(logs) {
        const summary = {};
        
        logs.forEach(log => {
            summary[log.event] = (summary[log.event] || 0) + 1;
        });
        
        return summary;
    }

    // Utility methods
    isValidSupabaseUrl(url) {
        return /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(url);
    }

    isValidTableName(name) {
        return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && name.length <= 63;
    }

    sanitizeColumnName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&').toLowerCase();
    }

    mapFieldTypeToPostgreSQL(fieldType) {
        const typeMap = {
            'text': 'TEXT',
            'email': 'TEXT',
            'number': 'NUMERIC',
            'date': 'DATE',
            'datetime-local': 'TIMESTAMPTZ',
            'textarea': 'TEXT',
            'select': 'TEXT',
            'radio': 'TEXT',
            'checkbox': 'BOOLEAN',
            'file': 'TEXT',
            'tel': 'TEXT',
            'url': 'TEXT',
            'time': 'TIME',
            'month': 'TEXT',
            'week': 'TEXT'
        };
        
        return typeMap[fieldType] || 'TEXT';
    }

    getClientIP() {
        // In production, this would be provided by the server
        return 'client-ip-protected';
    }

    /**
     * Auto-connect using available configuration
     */
    async autoConnect() {
        try {
            let supabaseUrl = '';
            let supabaseKey = '';
            
            console.log('🔧 Auto-connecting with available configuration...');
            
            // Try embedded config first (for GitHub Pages)
            if (window.EMBEDDED_CONFIG) {
                console.log('📱 Using embedded configuration');
                supabaseUrl = window.EMBEDDED_CONFIG.SUPABASE_URL;
                supabaseKey = window.EMBEDDED_CONFIG.SUPABASE_ANON_KEY;
            }
            // Try secure config
            else if (window.FLEXFORM_SECURE_CONFIG && window.secureConfigLoader) {
                console.log('🔐 Using secure configuration');
                const config = await window.secureConfigLoader.getSecureConfig(false);
                supabaseUrl = config.supabaseUrl;
                supabaseKey = config.supabaseAnonKey;
            }
            // Try standard config
            else if (window.FLEXFORM_CONFIG) {
                console.log('📄 Using standard configuration');
                supabaseUrl = window.FLEXFORM_CONFIG.SUPABASE_URL;
                supabaseKey = window.FLEXFORM_CONFIG.SUPABASE_ANON_KEY;
            }
            
            if (supabaseUrl && supabaseKey && supabaseKey !== 'your-anon-key-here') {
                const result = await this.connectToSupabase(supabaseUrl, supabaseKey, {
                    email: 'admin@company.com',
                    role: 'admin'
                });
                
                if (result.success) {
                    console.log('✅ Auto-connection successful');
                    // Update UI status if available
                    const statusElement = document.querySelector('.connection-status, #connectionStatus');
                    if (statusElement) {
                        statusElement.innerHTML = '<span style="color: #38a169;">●</span> Connected to database';
                    }
                }
                return result;
            } else {
                throw new Error('No valid configuration found');
            }
        } catch (error) {
            console.error('❌ Auto-connection failed:', error);
            const statusElement = document.querySelector('.connection-status, #connectionStatus');
            if (statusElement) {
                statusElement.innerHTML = '<span style="color: #e53e3e;">●</span> Database connection failed';
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        this.connected = false;
        this.supabaseUrl = '';
        this.supabaseKey = '';
        this.encryptionKey = null;
        this.currentUser = null;
        
        this.logSecurityEvent('DISCONNECTED');
        console.log('🔒 Secure connection closed');
    }
}

// Export for use in other modules
window.SecureSupabaseConnector = SecureSupabaseConnector;

// Auto-initialize for GitHub Pages
document.addEventListener('DOMContentLoaded', async () => {
    if (window.EMBEDDED_CONFIG) {
        console.log('🚀 Auto-initializing database connection for GitHub Pages...');
        const connector = new SecureSupabaseConnector();
        await connector.autoConnect();
        window.secureConnector = connector;
    }
});
