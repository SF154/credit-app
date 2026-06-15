-- Platform-level default templates (company_id = NULL, is_default = true).
-- Idempotent: skips if defaults already exist.
DO $$
DECLARE
  credit_template_id UUID;
  cod_template_id    UUID;
  section_id         UUID;
BEGIN

  -- Skip if defaults already seeded
  IF EXISTS (SELECT 1 FROM form_templates WHERE is_default = true AND company_id IS NULL) THEN
    RAISE NOTICE 'Default templates already seeded, skipping.';
    RETURN;
  END IF;

  -- =========================================================
  -- CREDIT APPLICATION
  -- =========================================================
  INSERT INTO form_templates (id, company_id, name, type, is_default, created_by)
  VALUES (gen_random_uuid(), NULL, 'Credit Application', 'credit', true, 'system')
  RETURNING id INTO credit_template_id;

  -- Section: Business Profile
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Business Profile', 10)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'type_of_business',    'Type of Business',    'select',  true,  10, '{"options":["Sole Proprietor","Partnership","Private Company (Pty Ltd)","Public Company","Close Corporation","Trust","Other"]}'),
    (credit_template_id, section_id, 'legal_name',          'Legal Name',          'text_single', true,  20, NULL),
    (credit_template_id, section_id, 'trading_name',        'Trading Name',        'text_single', false, 30, NULL),
    (credit_template_id, section_id, 'registration_number', 'Registration Number', 'text_single', true,  40, NULL),
    (credit_template_id, section_id, 'registered_for_vat',  'Registered for VAT',  'boolean', false, 50, NULL),
    (credit_template_id, section_id, 'vat_number',          'VAT Number',          'number',  false, 60, NULL),
    (credit_template_id, section_id, 'industry',            'Industry',            'select',  false, 70, '{"options":["Agriculture","Construction","Education","Finance","Healthcare","Manufacturing","Mining","Retail","Technology","Transport","Wholesale","Other"]}');

  -- Section: Physical Address
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Physical Address', 20)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'address_line_1', 'Address Line 1', 'text_single', true,  10, NULL),
    (credit_template_id, section_id, 'address_line_2', 'Address Line 2', 'text_single', false, 20, NULL),
    (credit_template_id, section_id, 'city',           'City',           'text_single', true,  30, NULL),
    (credit_template_id, section_id, 'province',       'Province',       'text_single', true,  40, NULL),
    (credit_template_id, section_id, 'postal_code',    'Postal Code',    'text_single', true,  50, NULL);

  -- Section: Contact Information
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Contact Information', 30)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'contact_person',   'Contact Person',   'text_single', true,  10, NULL),
    (credit_template_id, section_id, 'telephone',        'Telephone',        'text_single', true,  20, NULL),
    (credit_template_id, section_id, 'email_address',    'Email Address',    'text_single', true,  30, NULL),
    (credit_template_id, section_id, 'company_website',  'Company Website',  'text_single', false, 40, NULL);

  -- Section: Banking Details
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Banking Details', 40)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'account_holder_name', 'Account Holder Name', 'text_single', true, 10, NULL),
    (credit_template_id, section_id, 'bank_name',           'Bank Name',           'text_single', true, 20, NULL),
    (credit_template_id, section_id, 'account_number',      'Account Number',      'text_single', true, 30, NULL),
    (credit_template_id, section_id, 'branch_number',       'Branch Number',       'text_single', true, 40, NULL);

  -- Section: Director Details
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Director Details', 50)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'director_1_full_name', 'Director 1 Full Name', 'text_single', true,  10, NULL),
    (credit_template_id, section_id, 'director_1_id_no',     'Director 1 ID No',     'text_single', true,  20, NULL),
    (credit_template_id, section_id, 'director_2_full_name', 'Director 2 Full Name', 'text_single', false, 30, NULL),
    (credit_template_id, section_id, 'director_2_id_no',     'Director 2 ID No',     'text_single', false, 40, NULL);

  -- Section: Auditor Details
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Auditor Details', 60)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'audit_firm_name',    'Audit Firm Name',    'text_single', false, 10, NULL),
    (credit_template_id, section_id, 'auditor_contact',    'Contact Person',     'text_single', false, 20, NULL),
    (credit_template_id, section_id, 'auditor_telephone',  'Telephone',          'text_single', false, 30, NULL),
    (credit_template_id, section_id, 'auditor_email',      'Email',              'text_single', false, 40, NULL),
    (credit_template_id, section_id, 'date_of_last_afs',   'Date of Last AFS',   'date',        false, 50, NULL);

  -- Section: Trade References
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Trade References', 70)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'trade_ref_1_business',  'Trade Reference 1 - Business Name',   'text_single', false, 10, NULL),
    (credit_template_id, section_id, 'trade_ref_1_contact',   'Trade Reference 1 - Contact Person',  'text_single', false, 20, NULL),
    (credit_template_id, section_id, 'trade_ref_1_telephone', 'Trade Reference 1 - Telephone',       'text_single', false, 30, NULL),
    (credit_template_id, section_id, 'trade_ref_1_email',     'Trade Reference 1 - Email',           'text_single', false, 40, NULL),
    (credit_template_id, section_id, 'trade_ref_2_business',  'Trade Reference 2 - Business Name',   'text_single', false, 50, NULL),
    (credit_template_id, section_id, 'trade_ref_2_contact',   'Trade Reference 2 - Contact Person',  'text_single', false, 60, NULL),
    (credit_template_id, section_id, 'trade_ref_2_telephone', 'Trade Reference 2 - Telephone',       'text_single', false, 70, NULL),
    (credit_template_id, section_id, 'trade_ref_2_email',     'Trade Reference 2 - Email',           'text_single', false, 80, NULL),
    (credit_template_id, section_id, 'trade_ref_3_business',  'Trade Reference 3 - Business Name',   'text_single', false, 90, NULL),
    (credit_template_id, section_id, 'trade_ref_3_contact',   'Trade Reference 3 - Contact Person',  'text_single', false, 100, NULL),
    (credit_template_id, section_id, 'trade_ref_3_telephone', 'Trade Reference 3 - Telephone',       'text_single', false, 110, NULL),
    (credit_template_id, section_id, 'trade_ref_3_email',     'Trade Reference 3 - Email',           'text_single', false, 120, NULL);

  -- Section: Billing Details
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Billing Details', 80)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'billing_email',            'Billing Email',             'text_single', false, 10, NULL),
    (credit_template_id, section_id, 'billing_contact_fullname', 'Contact Person Full Name',  'text_single', false, 20, NULL),
    (credit_template_id, section_id, 'billing_telephone',        'Telephone',                 'text_single', false, 30, NULL),
    (credit_template_id, section_id, 'billing_contact_email',    'Email',                     'text_single', false, 40, NULL);

  -- Section: Credit Limit
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Credit Limit', 90)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'required_credit_limit',    'Required Credit Limit',    'number',      true,  10, NULL),
    (credit_template_id, section_id, 'annual_turnover',          'Annual Turnover',          'number',      false, 20, NULL),
    (credit_template_id, section_id, 'requested_payment_terms',  'Requested Payment Terms',  'text_single', false, 30, NULL);

  -- Section: Supporting Documents
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Supporting Documents', 100)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'doc_company_registration', 'Company Registration Document', 'file', false, 10, NULL),
    (credit_template_id, section_id, 'doc_vat_registration',     'VAT Registration Document',     'file', false, 20, NULL),
    (credit_template_id, section_id, 'doc_latest_afs',           'Latest AFS',                    'file', false, 30, NULL),
    (credit_template_id, section_id, 'doc_list_of_directors',    'Official List of Directors',    'file', false, 40, NULL),
    (credit_template_id, section_id, 'doc_ids_of_directors',     'IDs of Directors',              'file', false, 50, NULL),
    (credit_template_id, section_id, 'doc_tax_clearance',        'Tax Clearance PIN',             'file', false, 60, NULL),
    (credit_template_id, section_id, 'doc_bank_confirmation',    'Bank Confirmation Letter',      'file', false, 70, NULL);

  -- Section: Terms and Conditions
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), credit_template_id, 'Terms and Conditions', 110)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (credit_template_id, section_id, 'signatory_full_name', 'Signatory Full Name', 'text_single', true, 10, NULL),
    (credit_template_id, section_id, 'signatory_id_number', 'ID Number',           'text_single', true, 20, NULL),
    (credit_template_id, section_id, 'signatory_capacity',  'Capacity',            'text_single', true, 30, NULL),
    (credit_template_id, section_id, 'date_signed',         'Date Signed',         'date',        true, 40, NULL),
    (credit_template_id, section_id, 'place_signed',        'Place Signed',        'text_single', true, 50, NULL),
    (credit_template_id, section_id, 'signature',           'Signature',           'signature',   true, 60, NULL);

  -- =========================================================
  -- COD APPLICATION
  -- =========================================================
  INSERT INTO form_templates (id, company_id, name, type, is_default, created_by)
  VALUES (gen_random_uuid(), NULL, 'COD Application', 'cod', true, 'system')
  RETURNING id INTO cod_template_id;

  -- Section: Business Profile
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), cod_template_id, 'Business Profile', 10)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (cod_template_id, section_id, 'type_of_business',    'Type of Business',    'select',      true,  10, '{"options":["Sole Proprietor","Partnership","Private Company (Pty Ltd)","Public Company","Close Corporation","Trust","Other"]}'),
    (cod_template_id, section_id, 'legal_name',          'Legal Name',          'text_single', true,  20, NULL),
    (cod_template_id, section_id, 'trading_name',        'Trading Name',        'text_single', false, 30, NULL),
    (cod_template_id, section_id, 'registration_number', 'Registration Number', 'text_single', true,  40, NULL),
    (cod_template_id, section_id, 'registered_for_vat',  'Registered for VAT',  'boolean',     false, 50, NULL),
    (cod_template_id, section_id, 'vat_number',          'VAT Number',          'number',      false, 60, NULL),
    (cod_template_id, section_id, 'industry',            'Industry',            'select',      false, 70, '{"options":["Agriculture","Construction","Education","Finance","Healthcare","Manufacturing","Mining","Retail","Technology","Transport","Wholesale","Other"]}');

  -- Section: Physical Address
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), cod_template_id, 'Physical Address', 20)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (cod_template_id, section_id, 'address_line_1', 'Address Line 1', 'text_single', true,  10, NULL),
    (cod_template_id, section_id, 'address_line_2', 'Address Line 2', 'text_single', false, 20, NULL),
    (cod_template_id, section_id, 'city',           'City',           'text_single', true,  30, NULL),
    (cod_template_id, section_id, 'province',       'Province',       'text_single', true,  40, NULL),
    (cod_template_id, section_id, 'postal_code',    'Postal Code',    'text_single', true,  50, NULL);

  -- Section: Terms and Conditions
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), cod_template_id, 'Terms and Conditions', 30)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (cod_template_id, section_id, 'signatory_full_name', 'Signatory Full Name', 'text_single', true, 10, NULL),
    (cod_template_id, section_id, 'signatory_id_number', 'ID Number',           'text_single', true, 20, NULL),
    (cod_template_id, section_id, 'signatory_capacity',  'Capacity',            'text_single', true, 30, NULL),
    (cod_template_id, section_id, 'date_signed',         'Date Signed',         'date',        true, 40, NULL),
    (cod_template_id, section_id, 'place_signed',        'Place Signed',        'text_single', true, 50, NULL),
    (cod_template_id, section_id, 'signature',           'Signature',           'signature',   true, 60, NULL);

  -- Section: Supporting Documents
  INSERT INTO form_template_sections (id, template_id, label, display_order)
  VALUES (gen_random_uuid(), cod_template_id, 'Supporting Documents', 40)
  RETURNING id INTO section_id;
  INSERT INTO form_template_fields (template_id, section_id, field_key, label, field_type, is_required, display_order, config) VALUES
    (cod_template_id, section_id, 'doc_id_of_signatory', 'ID Document (of person who signed form)', 'file', false, 10, NULL);

  RAISE NOTICE 'Default templates seeded successfully.';
END $$;
