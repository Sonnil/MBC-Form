// FLEX-FORM - Dynamic Form Builder with Dataverse Integration
class FlexFormBuilder {
    constructor() {
        this.fields = [];
        this.templates = this.loadTemplates();
        this.currentFieldId = 0;
        // Remove old configuration (now handled in databaseConfig above)
        
        // Initialize Secure Database connector
        this.secureConnector = new SecureSupabaseConnector();
        
        // Update configuration structure
        this.databaseConfig = {
            type: 'supabase',
            url: '',
            tableName: '',
            connected: false,
            securityLevel: 'enterprise'
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedTemplates();
        this.setupDragAndDrop();
    }

    bindEvents() {
        // Field type buttons
        document.querySelectorAll('.field-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldType = e.currentTarget.dataset.type;
                this.openFieldConfig(fieldType);
            });
        });

        // Template controls
        document.getElementById('saveTemplate').addEventListener('click', () => this.saveTemplate());
        document.getElementById('loadTemplate').addEventListener('click', () => this.loadTemplate());
        document.getElementById('clearForm').addEventListener('click', () => this.clearForm());

        // Dataverse controls
        document.getElementById('connectDatabase').addEventListener('click', () => this.connectToDatabase());

        // Form actions
        document.getElementById('previewForm').addEventListener('click', () => this.previewForm());
        document.getElementById('exportForm').addEventListener('click', () => this.exportForm());
        document.getElementById('submitToDatabase').addEventListener('click', () => this.submitToSecureDatabase());

        // Modal controls
        document.getElementById('saveFieldConfig').addEventListener('click', () => this.saveFieldConfig());
        document.getElementById('cancelFieldConfig').addEventListener('click', () => this.closeModal('fieldConfigModal'));
        document.getElementById('closePreview').addEventListener('click', () => this.closeModal('previewModal'));

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Close modal with X button
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        // Template selection
        document.getElementById('templateSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadSpecificTemplate(e.target.value);
            }
        });
    }

    openFieldConfig(fieldType) {
        this.currentFieldType = fieldType;
        this.currentFieldId = Date.now(); // Generate unique ID
        
        // Reset form
        document.getElementById('fieldLabel').value = '';
        document.getElementById('fieldName').value = '';
        document.getElementById('fieldPlaceholder').value = '';
        document.getElementById('fieldRequired').checked = false;
        document.getElementById('fieldOptions').value = '';

        // Show/hide options config for select, radio, checkbox
        const optionsConfig = document.getElementById('optionsConfig');
        if (['select', 'radio', 'checkbox'].includes(fieldType)) {
            optionsConfig.style.display = 'block';
        } else {
            optionsConfig.style.display = 'none';
        }

        // Set default values
        document.getElementById('fieldLabel').value = this.getDefaultLabel(fieldType);
        document.getElementById('fieldName').value = this.getDefaultName(fieldType);
        document.getElementById('fieldPlaceholder').value = this.getDefaultPlaceholder(fieldType);

        this.openModal('fieldConfigModal');
    }

    getDefaultLabel(fieldType) {
        const labels = {
            text: 'Text Input',
            email: 'Email Address',
            number: 'Number',
            date: 'Date',
            select: 'Dropdown',
            radio: 'Radio Selection',
            checkbox: 'Checkbox',
            textarea: 'Text Area',
            file: 'File Upload'
        };
        return labels[fieldType] || 'Field';
    }

    getDefaultName(fieldType) {
        return fieldType + '_' + this.currentFieldId;
    }

    getDefaultPlaceholder(fieldType) {
        const placeholders = {
            text: 'Enter text...',
            email: 'Enter email address...',
            number: 'Enter number...',
            date: 'Select date...',
            textarea: 'Enter your message...',
            file: 'Choose file...'
        };
        return placeholders[fieldType] || '';
    }

    saveFieldConfig() {
        const label = document.getElementById('fieldLabel').value.trim();
        const name = document.getElementById('fieldName').value.trim();
        const placeholder = document.getElementById('fieldPlaceholder').value.trim();
        const required = document.getElementById('fieldRequired').checked;
        const options = document.getElementById('fieldOptions').value.trim();

        if (!label) {
            this.showMessage('Please enter a field label', 'error');
            return;
        }

        if (!name) {
            this.showMessage('Please enter a field name', 'error');
            return;
        }

        const field = {
            id: this.currentFieldId,
            type: this.currentFieldType,
            label: label,
            name: name,
            placeholder: placeholder,
            required: required,
            options: options ? options.split('\n').map(opt => opt.trim()).filter(opt => opt) : []
        };

        this.addFieldToForm(field);
        this.closeModal('fieldConfigModal');
    }

    addFieldToForm(field) {
        this.fields.push(field);
        this.renderField(field);
        this.updateEmptyState();
    }

    renderField(field) {
        const formCanvas = document.getElementById('formCanvas');
        const fieldElement = document.createElement('div');
        fieldElement.className = 'form-field';
        fieldElement.dataset.fieldId = field.id;

        const fieldHTML = this.generateFieldHTML(field);
        fieldElement.innerHTML = fieldHTML;

        // Add event listeners for field controls
        const editBtn = fieldElement.querySelector('.field-control-btn.edit');
        const deleteBtn = fieldElement.querySelector('.field-control-btn.delete');

        editBtn.addEventListener('click', () => this.editField(field.id));
        deleteBtn.addEventListener('click', () => this.deleteField(field.id));

        formCanvas.appendChild(fieldElement);
    }

    generateFieldHTML(field) {
        const requiredAttr = field.required ? 'required' : '';
        const requiredLabel = field.required ? ' <span style="color: red;">*</span>' : '';

        let inputHTML = '';

        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
            case 'date':
                inputHTML = `<input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" ${requiredAttr}>`;
                break;
            
            case 'textarea':
                inputHTML = `<textarea name="${field.name}" placeholder="${field.placeholder}" ${requiredAttr}></textarea>`;
                break;
            
            case 'select':
                const selectOptions = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
                inputHTML = `<select name="${field.name}" ${requiredAttr}>
                    <option value="">Choose an option...</option>
                    ${selectOptions}
                </select>`;
                break;
            
            case 'radio':
                const radioOptions = field.options.map((opt, index) => 
                    `<div class="radio-option">
                        <input type="radio" id="${field.name}_${index}" name="${field.name}" value="${opt}" ${requiredAttr}>
                        <label for="${field.name}_${index}">${opt}</label>
                    </div>`
                ).join('');
                inputHTML = `<div class="radio-group">${radioOptions}</div>`;
                break;
            
            case 'checkbox':
                if (field.options.length > 0) {
                    const checkboxOptions = field.options.map((opt, index) => 
                        `<div class="checkbox-option">
                            <input type="checkbox" id="${field.name}_${index}" name="${field.name}[]" value="${opt}">
                            <label for="${field.name}_${index}">${opt}</label>
                        </div>`
                    ).join('');
                    inputHTML = `<div class="checkbox-group">${checkboxOptions}</div>`;
                } else {
                    inputHTML = `<div class="checkbox-option">
                        <input type="checkbox" id="${field.name}" name="${field.name}" value="1">
                        <label for="${field.name}">${field.label}</label>
                    </div>`;
                }
                break;
            
            case 'file':
                inputHTML = `<input type="file" name="${field.name}" ${requiredAttr}>`;
                break;
        }

        return `
            <div class="field-header">
                <div class="field-label">${field.label}${requiredLabel}</div>
                <div class="field-controls">
                    <button class="field-control-btn edit" title="Edit Field">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="field-control-btn delete" title="Delete Field">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="field-control-btn move" title="Move Field">
                        <i class="fas fa-grip-vertical"></i>
                    </button>
                </div>
            </div>
            ${inputHTML}
        `;
    }

    editField(fieldId) {
        const field = this.fields.find(f => f.id === fieldId);
        if (!field) return;

        this.currentFieldType = field.type;
        this.currentFieldId = fieldId;
        this.editingField = true;

        // Populate form with current values
        document.getElementById('fieldLabel').value = field.label;
        document.getElementById('fieldName').value = field.name;
        document.getElementById('fieldPlaceholder').value = field.placeholder;
        document.getElementById('fieldRequired').checked = field.required;
        document.getElementById('fieldOptions').value = field.options.join('\n');

        // Show/hide options config
        const optionsConfig = document.getElementById('optionsConfig');
        if (['select', 'radio', 'checkbox'].includes(field.type)) {
            optionsConfig.style.display = 'block';
        } else {
            optionsConfig.style.display = 'none';
        }

        this.openModal('fieldConfigModal');
    }

    deleteField(fieldId) {
        if (confirm('Are you sure you want to delete this field?')) {
            this.fields = this.fields.filter(f => f.id !== fieldId);
            const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
            if (fieldElement) {
                fieldElement.remove();
            }
            this.updateEmptyState();
        }
    }

    updateEmptyState() {
        const formCanvas = document.getElementById('formCanvas');
        const emptyState = formCanvas.querySelector('.empty-state');
        const hasFields = formCanvas.querySelectorAll('.form-field').length > 0;

        if (hasFields && emptyState) {
            emptyState.remove();
        } else if (!hasFields && !emptyState) {
            formCanvas.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plus-circle"></i>
                    <p>Click on field types to start building your form</p>
                </div>
            `;
        }
    }

    setupDragAndDrop() {
        // This would require SortableJS library for full drag and drop functionality
        // For now, we'll implement basic reordering through buttons
    }

    async saveTemplate() {
        const templateName = prompt('Enter a name for this template:');
        if (!templateName) return;

        const template = {
            form_type: 'template',
            form_name: templateName,
            form_title: document.getElementById('formTitle').value,
            form_description: document.getElementById('formDescription').value,
            form_fields: JSON.stringify(this.fields),
            created_at: new Date().toISOString(),
            is_template: true
        };

        // Save to localStorage (backup)
        this.templates[templateName] = {
            name: templateName,
            title: template.form_title,
            description: template.form_description,
            fields: [...this.fields],
            created: template.created_at
        };
        this.saveTemplates();

        // Save to database
        if (window.supabaseClient) {
            try {
                const { error } = await window.supabaseClient
                    .from('form_submissions')
                    .insert([template]);

                if (error) {
                    console.error('Database save error:', error);
                    this.showMessage(`Template "${templateName}" saved locally only (database error)`, 'warning');
                } else {
                    this.showMessage(`Template "${templateName}" saved to database successfully!`, 'success');
                }
            } catch (dbError) {
                console.error('Database connection error:', dbError);
                this.showMessage(`Template "${templateName}" saved locally only (no database connection)`, 'warning');
            }
        } else {
            this.showMessage(`Template "${templateName}" saved locally only (no database connection)`, 'warning');
        }

        this.loadSavedTemplates();
    }
    loadTemplate() {
        const templateSelect = document.getElementById('templateSelect');
        const selectedTemplate = templateSelect.value;
        
        if (!selectedTemplate) {
            this.showMessage('Please select a template to load', 'error');
            return;
        }

        this.loadSpecificTemplate(selectedTemplate);
    }

    loadSpecificTemplate(templateName) {
        const template = this.templates[templateName];
        if (!template) {
            this.showMessage('Template not found', 'error');
            return;
        }

        if (this.fields.length > 0) {
            if (!confirm('This will replace the current form. Continue?')) {
                return;
            }
        }

        this.clearForm();
        
        document.getElementById('formTitle').value = template.title || '';
        document.getElementById('formDescription').value = template.description || '';
        
        this.fields = [...template.fields];
        this.renderAllFields();
        
        this.showMessage(`Template "${templateName}" loaded successfully!`, 'success');
    }

    renderAllFields() {
        const formCanvas = document.getElementById('formCanvas');
        formCanvas.innerHTML = '';
        
        this.fields.forEach(field => {
            this.renderField(field);
        });
        
        this.updateEmptyState();
    }

    clearForm() {
        this.fields = [];
        const formCanvas = document.getElementById('formCanvas');
        formCanvas.innerHTML = '';
        document.getElementById('formTitle').value = 'Dynamic Form';
        document.getElementById('formDescription').value = '';
        this.updateEmptyState();
    }

    loadSavedTemplates() {
        const templateSelect = document.getElementById('templateSelect');
        templateSelect.innerHTML = '<option value="">Select a template...</option>';
        
        Object.keys(this.templates).forEach(templateName => {
            const option = document.createElement('option');
            option.value = templateName;
            option.textContent = templateName;
            templateSelect.appendChild(option);
        });
    }

    loadTemplates() {
        const saved = localStorage.getItem('flexform_templates');
        if (saved) {
            return JSON.parse(saved);
        }
        
        // If no saved templates, return empty object
        // The default templates will be loaded by the DOMContentLoaded event
        return {};
    }

    saveTemplates() {
        localStorage.setItem('flexform_templates', JSON.stringify(this.templates));
    }

    async connectToDatabase() {
        const url = document.getElementById('databaseUrl').value.trim();
        const apiKey = document.getElementById('databaseKey').value.trim();
        const tableName = document.getElementById('tableName').value.trim();
        const department = document.getElementById('userDepartment').value.trim() || 'general';
        const userEmail = document.getElementById('userEmail').value.trim();
        const statusElement = document.getElementById('connectionStatus');

        if (!url || !apiKey || !tableName) {
            statusElement.innerHTML = '<div class="status error">Please provide database URL, API key, and table name</div>';
            return;
        }

        if (!userEmail) {
            statusElement.innerHTML = '<div class="status error">User email required for security audit</div>';
            return;
        }

        statusElement.innerHTML = '<div class="status">🔐 Establishing secure connection... <span class="loading"></span></div>';

        try {
            const userContext = {
                email: userEmail,
                department: department,
                role: 'user'
            };

            const result = await this.secureConnector.connectToSupabase(url, apiKey, userContext);
            
            if (result.success) {
                this.databaseConfig = {
                    type: 'supabase',
                    url: url,
                    tableName: tableName,
                    connected: true,
                    securityLevel: result.securityLevel || 'enterprise'
                };
                
                statusElement.innerHTML = `
                    <div class="status connected">
                        ✅ Secure connection established!<br>
                        🛡️ Security Level: ${result.securityLevel}<br>
                        🔐 Encryption: Enabled<br>
                        📊 Audit Logging: Active
                    </div>
                `;
                this.showMessage('Connected to secure database successfully!', 'success');
            } else {
                statusElement.innerHTML = `<div class="status error">Connection failed: ${result.error}</div>`;
                this.showMessage(`Connection failed: ${result.error}`, 'error');
            }
        } catch (error) {
            statusElement.innerHTML = `<div class="status error">Connection failed: ${error.message}</div>`;
            this.showMessage(`Connection failed: ${error.message}`, 'error');
        }
    }

    previewForm() {
        const previewContainer = document.getElementById('previewContainer');
        const formTitle = document.getElementById('formTitle').value || 'Dynamic Form';
        const formDescription = document.getElementById('formDescription').value;

        let previewHTML = `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: white; border-radius: 10px;">
                <h2 style="color: #2d3748; margin-bottom: 10px;">${formTitle}</h2>
                ${formDescription ? `<p style="color: #4a5568; margin-bottom: 30px;">${formDescription}</p>` : ''}
                <form id="previewForm">
        `;

        this.fields.forEach(field => {
            previewHTML += `
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2d3748;">
                        ${field.label}${field.required ? ' <span style="color: red;">*</span>' : ''}
                    </label>
                    ${this.generatePreviewFieldHTML(field)}
                </div>
            `;
        });

        previewHTML += `
                    <button type="submit" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 600; cursor: pointer;">
                        Submit Form
                    </button>
                </form>
            </div>
        `;

        previewContainer.innerHTML = previewHTML;

        // Add form submission handler for preview
        document.getElementById('previewForm').addEventListener('submit', (e) => {
            e.preventDefault();
            alert('This is a preview. In the actual form, this would submit to Dataverse.');
        });

        this.openModal('previewModal');
    }

    generatePreviewFieldHTML(field) {
        const requiredAttr = field.required ? 'required' : '';
        const style = 'width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 1rem;';

        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
            case 'date':
                return `<input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" style="${style}" ${requiredAttr}>`;
            
            case 'textarea':
                return `<textarea name="${field.name}" placeholder="${field.placeholder}" style="${style} min-height: 100px; resize: vertical;" ${requiredAttr}></textarea>`;
            
            case 'select':
                const selectOptions = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
                return `<select name="${field.name}" style="${style}" ${requiredAttr}>
                    <option value="">Choose an option...</option>
                    ${selectOptions}
                </select>`;
            
            case 'radio':
                return field.options.map((opt, index) => 
                    `<div style="margin-bottom: 8px;">
                        <input type="radio" id="preview_${field.name}_${index}" name="${field.name}" value="${opt}" ${requiredAttr}>
                        <label for="preview_${field.name}_${index}" style="margin-left: 8px;">${opt}</label>
                    </div>`
                ).join('');
            
            case 'checkbox':
                if (field.options.length > 0) {
                    return field.options.map((opt, index) => 
                        `<div style="margin-bottom: 8px;">
                            <input type="checkbox" id="preview_${field.name}_${index}" name="${field.name}[]" value="${opt}">
                            <label for="preview_${field.name}_${index}" style="margin-left: 8px;">${opt}</label>
                        </div>`
                    ).join('');
                } else {
                    return `<div>
                        <input type="checkbox" id="preview_${field.name}" name="${field.name}" value="1">
                        <label for="preview_${field.name}" style="margin-left: 8px;">${field.label}</label>
                    </div>`;
                }
            
            case 'file':
                return `<input type="file" name="${field.name}" style="${style}" ${requiredAttr}>`;
            
            default:
                return `<input type="text" name="${field.name}" placeholder="${field.placeholder}" style="${style}" ${requiredAttr}>`;
        }
    }

    exportForm() {
        const formData = {
            title: document.getElementById('formTitle').value || 'Dynamic Form',
            description: document.getElementById('formDescription').value,
            fields: this.fields,
            sharepointConfig: this.sharepointConfig,
            exported: new Date().toISOString()
        };

        const dataStr = JSON.stringify(formData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${formData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_form.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showMessage('Form exported successfully!', 'success');
    }

    async submitToSharePoint() {
        if (!this.sharepointConfig.connected) {
            this.showMessage('Please connect to Dataverse first', 'error');
            return;
        }

        if (this.fields.length === 0) {
            this.showMessage('Please add some fields to the form first', 'error');
            return;
        }

        const submitBtn = document.getElementById('submitToSharePoint');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="loading"></span> Creating in Dataverse...';
        submitBtn.disabled = true;

        try {
            // Create list in SharePoint
            const listResult = await this.sharepointConnector.createList(
                this.sharepointConfig.listName, 
                this.fields
            );
            
            if (listResult.success) {
                this.showMessage('Form structure created in SharePoint successfully!', 'success');
                
                // Generate integrated form HTML for deployment
                this.generateIntegratedSharePointForm();
            } else {
                throw new Error('Failed to create SharePoint list structure');
            }
            
        } catch (error) {
            this.showMessage('Error creating form in Dataverse: ' + error.message, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    generateIntegratedSharePointForm() {
        const formConfig = {
            title: document.getElementById('formTitle').value || 'Dynamic Form',
            description: document.getElementById('formDescription').value,
            fields: this.fields,
            listName: this.sharepointConfig.listName
        };
        
        // Generate integrated form using Dataverse connector
        const formHTML = this.sharepointConnector.generateIntegratedForm(formConfig);
        
        // Download the generated form
        const blob = new Blob([formHTML], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${formConfig.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_integrated_form.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    generateDataverseForm() {
        // This would generate the actual HTML form that integrates with Dataverse
        const formTitle = document.getElementById('formTitle').value || 'Dynamic Form';
        const formDescription = document.getElementById('formDescription').value;
        
        let formHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${formTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #0078d4; color: white; padding: 12px 30px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #106ebe; }
        .required { color: red; }
    </style>
</head>
<body>
    <h1>${formTitle}</h1>
    ${formDescription ? `<p>${formDescription}</p>` : ''}
    
    <form id="dataverseForm" action="#" method="POST">
`;

        this.fields.forEach(field => {
            formHTML += `
        <div class="form-group">
            <label for="${field.name}">
                ${field.label}${field.required ? ' <span class="required">*</span>' : ''}
            </label>
            ${this.generateDataverseFieldHTML(field)}
        </div>
`;
        });

        formHTML += `
        <button type="submit">Submit to Dataverse</button>
    </form>

    <script>
        document.getElementById('dataverseForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Collect form data
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            
            // Submit to Dataverse (implement actual API call here)
            console.log('Submitting to Dataverse:', data);
            alert('Form submitted successfully!');
        });
    </script>
</body>
</html>`;

        // Download the generated form
        const blob = new Blob([formHTML], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${formTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_dataverse_form.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    generateDataverseFieldHTML(field) {
        const requiredAttr = field.required ? 'required' : '';

        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
            case 'date':
                return `<input type="${field.type}" id="${field.name}" name="${field.name}" placeholder="${field.placeholder}" ${requiredAttr}>`;
            
            case 'textarea':
                return `<textarea id="${field.name}" name="${field.name}" placeholder="${field.placeholder}" ${requiredAttr}></textarea>`;
            
            case 'select':
                const selectOptions = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
                return `<select id="${field.name}" name="${field.name}" ${requiredAttr}>
                    <option value="">Choose an option...</option>
                    ${selectOptions}
                </select>`;
            
            case 'radio':
                return field.options.map((opt, index) => 
                    `<div>
                        <input type="radio" id="${field.name}_${index}" name="${field.name}" value="${opt}" ${requiredAttr}>
                        <label for="${field.name}_${index}">${opt}</label>
                    </div>`
                ).join('');
            
            case 'checkbox':
                if (field.options.length > 0) {
                    return field.options.map((opt, index) => 
                        `<div>
                            <input type="checkbox" id="${field.name}_${index}" name="${field.name}[]" value="${opt}">
                            <label for="${field.name}_${index}">${opt}</label>
                        </div>`
                    ).join('');
                } else {
                    return `<div>
                        <input type="checkbox" id="${field.name}" name="${field.name}" value="1">
                        <label for="${field.name}">${field.label}</label>
                    </div>`;
                }
            
            case 'file':
                return `<input type="file" id="${field.name}" name="${field.name}" ${requiredAttr}>`;
            
            default:
                return `<input type="text" id="${field.name}" name="${field.name}" placeholder="${field.placeholder}" ${requiredAttr}>`;
        }
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = 'auto';
        
        if (modalId === 'fieldConfigModal') {
            this.editingField = false;
        }
    }

    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;

        // Insert at top of form builder
        const formBuilder = document.querySelector('.form-builder');
        formBuilder.insertBefore(messageEl, formBuilder.firstChild);

        // Remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const flexForm = new FlexFormBuilder();
    
    // Refresh templates after initialization to ensure new templates are visible
    setTimeout(() => {
        flexForm.templates = flexForm.loadTemplates();
        flexForm.loadSavedTemplates();
    }, 100);
});

// Add some default templates
document.addEventListener('DOMContentLoaded', () => {
    const defaultTemplates = {
        'Contact Form': {
            name: 'Contact Form',
            title: 'Contact Us',
            description: 'Get in touch with us',
            fields: [
                {
                    id: 1,
                    type: 'text',
                    label: 'Full Name',
                    name: 'full_name',
                    placeholder: 'Enter your full name',
                    required: true,
                    options: []
                },
                {
                    id: 2,
                    type: 'email',
                    label: 'Email Address',
                    name: 'email',
                    placeholder: 'Enter your email',
                    required: true,
                    options: []
                },
                {
                    id: 3,
                    type: 'text',
                    label: 'Subject',
                    name: 'subject',
                    placeholder: 'Enter subject',
                    required: true,
                    options: []
                },
                {
                    id: 4,
                    type: 'textarea',
                    label: 'Message',
                    name: 'message',
                    placeholder: 'Enter your message',
                    required: true,
                    options: []
                }
            ],
            created: new Date().toISOString()
        },
        'Survey Form': {
            name: 'Survey Form',
            title: 'Customer Satisfaction Survey',
            description: 'Help us improve our services',
            fields: [
                {
                    id: 1,
                    type: 'text',
                    label: 'Name',
                    name: 'name',
                    placeholder: 'Your name (optional)',
                    required: false,
                    options: []
                },
                {
                    id: 2,
                    type: 'select',
                    label: 'How did you hear about us?',
                    name: 'source',
                    placeholder: '',
                    required: true,
                    options: ['Social Media', 'Search Engine', 'Friend Referral', 'Advertisement', 'Other']
                },
                {
                    id: 3,
                    type: 'radio',
                    label: 'Overall Satisfaction',
                    name: 'satisfaction',
                    placeholder: '',
                    required: true,
                    options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied']
                },
                {
                    id: 4,
                    type: 'checkbox',
                    label: 'Which services have you used?',
                    name: 'services',
                    placeholder: '',
                    required: false,
                    options: ['Consulting', 'Development', 'Support', 'Training']
                },
                {
                    id: 5,
                    type: 'textarea',
                    label: 'Additional Comments',
                    name: 'comments',
                    placeholder: 'Any additional feedback...',
                    required: false,
                    options: []
                }
            ],
            created: new Date().toISOString()
        },
        'Gemba Information Request': {
            name: 'Gemba Information Request',
            title: 'Framingham Gemba - Preliminary Information Request',
            description: 'Comprehensive event reporting and documentation form for Gemba scheduling',
            fields: [
                {
                    id: 1,
                    type: 'text',
                    label: 'Short Description / Title of Event',
                    name: 'event_title',
                    placeholder: 'Enter brief description of the event',
                    required: true,
                    options: []
                },
                {
                    id: 2,
                    type: 'email',
                    label: 'Contact / Organizer',
                    name: 'contact_organizer',
                    placeholder: 'Enter a valid email address',
                    required: true,
                    options: []
                },
                {
                    id: 3,
                    type: 'text',
                    label: 'Related SOP(s)/batch record/procedure/standard/EWI/form etc. and step #',
                    name: 'related_documents',
                    placeholder: 'List relevant SOPs, batch records, procedures, standards, and step numbers',
                    required: true,
                    options: []
                },
                {
                    id: 4,
                    type: 'file',
                    label: 'Associated Documentation',
                    name: 'documentation',
                    placeholder: 'Upload supporting documentation or evidence',
                    required: false,
                    options: []
                },
                {
                    id: 5,
                    type: 'text',
                    label: 'Batch Association (include RF if available)',
                    name: 'batch_association',
                    placeholder: 'Are any batches impacted by this event? List batch and part number(s)',
                    required: true,
                    options: []
                },
                {
                    id: 6,
                    type: 'text',
                    label: 'Who is directly involved?',
                    name: 'directly_involved',
                    placeholder: 'List personnel directly involved in the event',
                    required: true,
                    options: []
                },
                {
                    id: 7,
                    type: 'text',
                    label: 'Who discovered event? How was it detected?',
                    name: 'event_discovery',
                    placeholder: 'Describe who found the event and detection method',
                    required: true,
                    options: []
                },
                {
                    id: 8,
                    type: 'textarea',
                    label: 'What happened?',
                    name: 'what_happened',
                    placeholder: 'What was the observation? What did we deviate from? What is the problem statement? Provide as much detail as possible.',
                    required: true,
                    options: []
                },
                {
                    id: 9,
                    type: 'text',
                    label: 'Where (building/room #/lab)?',
                    name: 'event_location',
                    placeholder: 'Specify exact location where event occurred',
                    required: true,
                    options: []
                },
                {
                    id: 10,
                    type: 'date',
                    label: 'When did the event occur?',
                    name: 'occurrence_date',
                    placeholder: '',
                    required: true,
                    options: []
                },
                {
                    id: 11,
                    type: 'text',
                    label: 'Time of Occurrence',
                    name: 'occurrence_time',
                    placeholder: 'Enter time (e.g., 14:30, 2:30 PM)',
                    required: true,
                    options: []
                },
                {
                    id: 12,
                    type: 'date',
                    label: 'When was the event detected?',
                    name: 'detection_date',
                    placeholder: '',
                    required: true,
                    options: []
                },
                {
                    id: 13,
                    type: 'text',
                    label: 'Time of Detection',
                    name: 'detection_time',
                    placeholder: 'Enter time (e.g., 14:30, 2:30 PM)',
                    required: true,
                    options: []
                },
                {
                    id: 14,
                    type: 'textarea',
                    label: 'Expected Results',
                    name: 'expected_results',
                    placeholder: 'List specific requirements and the document they\'re listed in. For example, per FBL-CST-012345 step 4.1, the temperature must be between 25-30C.',
                    required: true,
                    options: []
                },
                {
                    id: 15,
                    type: 'textarea',
                    label: 'Immediate actions before Gemba',
                    name: 'immediate_actions',
                    placeholder: 'For example, equipment tagged out of service, emergency WO opened.',
                    required: true,
                    options: []
                },
                {
                    id: 16,
                    type: 'textarea',
                    label: 'Justification (if > 24 hours)',
                    name: 'justification',
                    placeholder: 'Provide justification if Gemba is scheduled more than 24 hours after event',
                    required: true,
                    options: []
                },
                {
                    id: 17,
                    type: 'date',
                    label: 'GEMBA scheduled Date',
                    name: 'gemba_date',
                    placeholder: '',
                    required: true,
                    options: []
                },
                {
                    id: 18,
                    type: 'select',
                    label: 'GEMBA scheduled Time',
                    name: 'gemba_time',
                    placeholder: '',
                    required: false,
                    options: [
                        '2400', '2430', '0100', '0130', '0200', '0230', '0300', '0330',
                        '0400', '0430', '0500', '0530', '0600', '0630', '0700', '0730',
                        '0800', '0830', '0900', '0930', '1000', '1030', '1100', '1130',
                        '1200', '1230', '1300', '1330', '1400', '1430', '1500', '1530',
                        '1600', '1630', '1700', '1730', '1800', '1830', '1900', '1930',
                        '2000', '2030', '2100', '2130', '2200', '2230', '2300', '2330'
                    ]
                }
            ],
            created: new Date().toISOString()
        },
        'Gemba Intake Form': {
            name: 'Gemba Intake Form',
            title: 'Deviation Intake Form',
            description: 'Complete form using information from Preliminary Info form and Gemba meeting - Upload to SmartSheet immediately following the Gemba',
            fields: [
                // Team Information
                {
                    id: 1,
                    type: 'text',
                    label: 'Gemba Coach',
                    name: 'gemba_coach',
                    placeholder: 'Enter Gemba Coach name',
                    required: true,
                    options: []
                },
                {
                    id: 2,
                    type: 'text',
                    label: 'Gemba Facilitator',
                    name: 'gemba_facilitator',
                    placeholder: 'Enter Gemba Facilitator name',
                    required: true,
                    options: []
                },
                {
                    id: 3,
                    type: 'text',
                    label: 'Gemba Scribe',
                    name: 'gemba_scribe',
                    placeholder: 'Enter Gemba Scribe name',
                    required: true,
                    options: []
                },
                {
                    id: 4,
                    type: 'textarea',
                    label: 'Impacted/Discovering Department Reps',
                    name: 'department_reps',
                    placeholder: 'List department representatives present',
                    required: true,
                    options: []
                },
                
                // SME Attendees
                {
                    id: 5,
                    type: 'checkbox',
                    label: 'Required SMEs Present at Start of Gemba',
                    name: 'smes_present',
                    placeholder: '',
                    required: false,
                    options: ['Manufacturing', 'Automation (DOT) / MES', 'QA Digital Compliance', 'Contamination Control', 'Facilities / Engineering', 'Cleaners', 'MSAT', 'Company Subject Matter Expert(s)', 'QA Ops & QA CDI', 'Other']
                },
                {
                    id: 6,
                    type: 'text',
                    label: 'Other SMEs',
                    name: 'other_smes',
                    placeholder: 'Specify other SMEs if selected',
                    required: false,
                    options: []
                },
                
                // Event Details
                {
                    id: 7,
                    type: 'text',
                    label: 'Title (Product - Lot - Building - Description)',
                    name: 'title',
                    placeholder: 'Include Product line, batch if applicable, Building, Deviating Event',
                    required: true,
                    options: []
                },
                {
                    id: 8,
                    type: 'textarea',
                    label: 'Team',
                    name: 'team',
                    placeholder: 'Add Owner, Quality Approver. For Significant Deviations: Investigation Leader and Contributors',
                    required: true,
                    options: []
                },
                {
                    id: 9,
                    type: 'textarea',
                    label: 'Description',
                    name: 'description',
                    placeholder: 'Tell the story of the event (Problem Statement) - concise while clearly describing the deviating situation',
                    required: true,
                    options: []
                },
                {
                    id: 10,
                    type: 'textarea',
                    label: 'Additional Information',
                    name: 'additional_info',
                    placeholder: 'Key elements: dates/timeframe, procedures/batch records, excursion values, GPS team from GEMBA',
                    required: false,
                    options: []
                },
                
                // 5W Analysis
                {
                    id: 11,
                    type: 'textarea',
                    label: 'Why (Expected Results vs What Happened)',
                    name: 'why',
                    placeholder: 'Document the expected results with details to describe the deviation',
                    required: true,
                    options: []
                },
                {
                    id: 12,
                    type: 'textarea',
                    label: 'Who (People Involved)',
                    name: 'who',
                    placeholder: 'Who noticed the problem? Which employees performed the action? Which shifts? Who was contacted?',
                    required: true,
                    options: []
                },
                {
                    id: 13,
                    type: 'textarea',
                    label: 'How (Process Description)',
                    name: 'how',
                    placeholder: 'How did the process step come about and how did it deviate from routine? How do we normally work vs what went differently?',
                    required: true,
                    options: []
                },
                {
                    id: 14,
                    type: 'textarea',
                    label: 'How - Additional Information',
                    name: 'how_additional',
                    placeholder: 'Compare what went differently. What steps led to the problem? For Non-Significant Events: document the most assignable cause',
                    required: false,
                    options: []
                },
                {
                    id: 15,
                    type: 'textarea',
                    label: 'How Much (Magnitude of Deviation)',
                    name: 'how_much',
                    placeholder: 'Quantity of product, number of process steps, batches, occurrences, procedures impacted, volume, vials, etc.',
                    required: true,
                    options: []
                },
                
                // Location and Process
                {
                    id: 16,
                    type: 'select',
                    label: 'Reporter Entity',
                    name: 'reporter_entity',
                    placeholder: '',
                    required: true,
                    options: ['MA BioCampus']
                },
                {
                    id: 17,
                    type: 'text',
                    label: 'Department',
                    name: 'department',
                    placeholder: 'Select department responsible for the impacted process',
                    required: true,
                    options: []
                },
                {
                    id: 18,
                    type: 'select',
                    label: 'Owning Entity',
                    name: 'owning_entity',
                    placeholder: '',
                    required: true,
                    options: ['MA BioCampus']
                },
                {
                    id: 19,
                    type: 'text',
                    label: 'Building',
                    name: 'building',
                    placeholder: 'Select building where event took place',
                    required: true,
                    options: []
                },
                {
                    id: 20,
                    type: 'text',
                    label: 'Room',
                    name: 'room',
                    placeholder: 'Select room where event took place',
                    required: true,
                    options: []
                },
                {
                    id: 21,
                    type: 'text',
                    label: 'Process',
                    name: 'process',
                    placeholder: 'Select the impacted process',
                    required: true,
                    options: []
                },
                {
                    id: 22,
                    type: 'text',
                    label: 'Operation',
                    name: 'operation',
                    placeholder: 'Select the step (operation) of the process',
                    required: true,
                    options: []
                },
                
                // Timing
                {
                    id: 23,
                    type: 'datetime-local',
                    label: 'Date Detected',
                    name: 'date_detected',
                    placeholder: '',
                    required: true,
                    options: []
                },
                {
                    id: 24,
                    type: 'textarea',
                    label: 'Event Raised Late Justification',
                    name: 'late_justification',
                    placeholder: 'If event generated outside 24 hour requirement, document rationale and no impact statement',
                    required: false,
                    options: []
                },
                {
                    id: 25,
                    type: 'select',
                    label: 'Date Occurred Known',
                    name: 'date_occurred_known',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                
                // Asset and Product
                {
                    id: 26,
                    type: 'select',
                    label: 'Asset Concerned',
                    name: 'asset_concerned',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                {
                    id: 27,
                    type: 'select',
                    label: 'Product Concerned',
                    name: 'product_concerned',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                
                // Product Impact Section (conditional)
                {
                    id: 28,
                    type: 'text',
                    label: 'Product (Part Number)',
                    name: 'product',
                    placeholder: 'Part Number for product; use DS part number if not specific step related',
                    required: false,
                    options: []
                },
                {
                    id: 29,
                    type: 'text',
                    label: 'Batch',
                    name: 'batch',
                    placeholder: 'Select batch code(s) - Only for Significant deviations',
                    required: false,
                    options: []
                },
                {
                    id: 30,
                    type: 'select',
                    label: 'Impact',
                    name: 'impact',
                    placeholder: '',
                    required: false,
                    options: ['Impacted', 'Not Impacted']
                },
                {
                    id: 31,
                    type: 'textarea',
                    label: 'Impact Rationale',
                    name: 'impact_rationale',
                    placeholder: 'QA Field: Document QA Forward Processing Statement. Title as such and initial/date',
                    required: false,
                    options: []
                },
                {
                    id: 32,
                    type: 'select',
                    label: 'Handling Unit Impacted',
                    name: 'handling_unit_impacted',
                    placeholder: '',
                    required: false,
                    options: ['Yes', 'No']
                },
                {
                    id: 33,
                    type: 'textarea',
                    label: 'Comment (Batch for NS events)',
                    name: 'comment_batch',
                    placeholder: 'Record batch here for Non-Significant events',
                    required: false,
                    options: []
                },
                {
                    id: 34,
                    type: 'textarea',
                    label: 'Comment (Further Processing Decision)',
                    name: 'comment_processing',
                    placeholder: 'Under what conditions can processing continue? Justification for no restrictions',
                    required: false,
                    options: []
                },
                {
                    id: 35,
                    type: 'textarea',
                    label: 'Comment (QI Status)',
                    name: 'comment_qi_status',
                    placeholder: 'When product in QI status, determine target date for removal',
                    required: false,
                    options: []
                },
                
                // Actions
                {
                    id: 36,
                    type: 'select',
                    label: 'Immediate Action Needed',
                    name: 'immediate_action_needed',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                {
                    id: 37,
                    type: 'textarea',
                    label: 'Actions Required',
                    name: 'actions_required',
                    placeholder: 'List immediate actions taken to contain/temporarily solve the problem',
                    required: false,
                    options: []
                },
                
                // Clinical and Third Party
                {
                    id: 38,
                    type: 'select',
                    label: 'Clinical Study Concerned',
                    name: 'clinical_study_concerned',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                {
                    id: 39,
                    type: 'select',
                    label: 'Third Party Concerned',
                    name: 'third_party_concerned',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                
                // Third Party Details (conditional)
                {
                    id: 40,
                    type: 'text',
                    label: 'TP Complaint Title',
                    name: 'tp_complaint_title',
                    placeholder: 'Structure as: TP complaint for QE-XXXXX',
                    required: false,
                    options: []
                },
                {
                    id: 41,
                    type: 'textarea',
                    label: 'TP Description of Complaint',
                    name: 'tp_description',
                    placeholder: 'Include specification document, when issue found (pre/post-use inspection), PO number',
                    required: false,
                    options: []
                },
                {
                    id: 42,
                    type: 'text',
                    label: 'Specification Document #',
                    name: 'spec_document',
                    placeholder: '',
                    required: false,
                    options: []
                },
                {
                    id: 43,
                    type: 'select',
                    label: 'Issue Detected When',
                    name: 'issue_detected_when',
                    placeholder: '',
                    required: false,
                    options: ['Pre-use inspection', 'Post-use inspection']
                },
                {
                    id: 44,
                    type: 'text',
                    label: 'PO Number',
                    name: 'po_number',
                    placeholder: 'Materials Management to provide',
                    required: false,
                    options: []
                },
                {
                    id: 45,
                    type: 'text',
                    label: 'Third Party',
                    name: 'third_party',
                    placeholder: 'Refer to specification document and core material',
                    required: false,
                    options: []
                },
                {
                    id: 46,
                    type: 'text',
                    label: 'Core Material(s)',
                    name: 'core_materials',
                    placeholder: 'Materials Management to identify Core Material Number',
                    required: false,
                    options: []
                },
                
                // References and Comments
                {
                    id: 47,
                    type: 'text',
                    label: 'External References',
                    name: 'external_references',
                    placeholder: 'Include references to external documents, audit reports, contractor documents, etc.',
                    required: false,
                    options: []
                },
                {
                    id: 48,
                    type: 'textarea',
                    label: 'Comments',
                    name: 'comments',
                    placeholder: 'Document owner conclusion information. Contact RA Liaison if potential dossier violation',
                    required: true,
                    options: []
                },
                
                // Criticality Assessment
                {
                    id: 49,
                    type: 'select',
                    label: 'Impacted or Potential Impact on Product',
                    name: 'product_impact_question',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                {
                    id: 50,
                    type: 'select',
                    label: 'Safety, Patients, Data Reliability',
                    name: 'safety_question',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                {
                    id: 51,
                    type: 'select',
                    label: 'Is The Event Indicative Of A Trend',
                    name: 'trend_question',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                {
                    id: 52,
                    type: 'select',
                    label: 'Impact GxP And/Or Regulatory Compliance',
                    name: 'gxp_question',
                    placeholder: '',
                    required: true,
                    options: ['Yes', 'No']
                },
                {
                    id: 53,
                    type: 'select',
                    label: 'Overall Criticality Assessment',
                    name: 'overall_criticality',
                    placeholder: '',
                    required: true,
                    options: ['Significant', 'Non-Significant']
                },
                
                // Action Items
                {
                    id: 54,
                    type: 'textarea',
                    label: 'Action Item 1 Description',
                    name: 'action_item_1_desc',
                    placeholder: 'Describe required action',
                    required: false,
                    options: []
                },
                {
                    id: 55,
                    type: 'text',
                    label: 'Action Item 1 Owner',
                    name: 'action_item_1_owner',
                    placeholder: 'Assign owner',
                    required: false,
                    options: []
                },
                {
                    id: 56,
                    type: 'date',
                    label: 'Action Item 1 Due Date',
                    name: 'action_item_1_due',
                    placeholder: '',
                    required: false,
                    options: []
                },
                {
                    id: 57,
                    type: 'textarea',
                    label: 'Action Item 2 Description',
                    name: 'action_item_2_desc',
                    placeholder: 'Describe required action',
                    required: false,
                    options: []
                },
                {
                    id: 58,
                    type: 'text',
                    label: 'Action Item 2 Owner',
                    name: 'action_item_2_owner',
                    placeholder: 'Assign owner',
                    required: false,
                    options: []
                },
                {
                    id: 59,
                    type: 'date',
                    label: 'Action Item 2 Due Date',
                    name: 'action_item_2_due',
                    placeholder: '',
                    required: false,
                    options: []
                },
                {
                    id: 60,
                    type: 'textarea',
                    label: 'Action Item 3 Description',
                    name: 'action_item_3_desc',
                    placeholder: 'Describe required action',
                    required: false,
                    options: []
                },
                {
                    id: 61,
                    type: 'text',
                    label: 'Action Item 3 Owner',
                    name: 'action_item_3_owner',
                    placeholder: 'Assign owner',
                    required: false,
                    options: []
                },
                {
                    id: 62,
                    type: 'date',
                    label: 'Action Item 3 Due Date',
                    name: 'action_item_3_due',
                    placeholder: '',
                    required: false,
                    options: []
                }
            ],
            created: new Date().toISOString()
        }
    };

    // Save default templates and merge with existing ones
    const existing = localStorage.getItem('flexform_templates');
    let allTemplates = defaultTemplates;
    
    if (existing) {
        const existingTemplates = JSON.parse(existing);
        // Merge existing templates with default templates, giving priority to existing ones
        allTemplates = { ...defaultTemplates, ...existingTemplates };
    }
    
    localStorage.setItem('flexform_templates', JSON.stringify(allTemplates));
});
